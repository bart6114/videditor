#!/usr/bin/env node

/**
 * Automated Upload → Transcription Test Script
 *
 * Tests the complete flow:
 * 1. Authenticate with Clerk
 * 2. Upload test video to R2
 * 3. Signal upload completion
 * 4. Poll for transcription completion
 *
 * Usage:
 *   npm run test:upload
 *
 * Environment variables required:
 *   CLERK_SECRET_KEY - From .env.local
 *   NEXT_PUBLIC_WORKER_URL - Worker API URL (default: http://localhost:8787)
 *   TEST_USER_ID - Optional test user ID (default: test_user_123)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID || 'test_user_123';
const TEST_VIDEO_PATH = path.join(__dirname, 'test-video.mp4');
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_WAIT_TIME_MS = 300000; // 5 minutes max

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

function logWait(message) {
  log(`⏳ ${message}`, 'yellow');
}

// Generate a simple test JWT for local testing
function generateTestToken() {
  // For local testing, we'll create a minimal JWT structure
  // In production, you'd use actual Clerk authentication
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify({
    sub: TEST_USER_ID,
    email: 'test@example.com',
    name: 'Test User',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64');

  return `${header}.${payload}.fake_signature_for_testing`;
}

async function apiCall(endpoint, options = {}) {
  const token = generateTestToken();
  const url = `${WORKER_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API call failed: ${response.status} ${response.statusText}\n${text}`);
  }

  return response.json();
}

async function createTestVideo() {
  // Check if test video already exists
  if (fs.existsSync(TEST_VIDEO_PATH)) {
    logInfo(`Using existing test video: ${TEST_VIDEO_PATH}`);
    return TEST_VIDEO_PATH;
  }

  logWait('Test video not found. Please create a small test video at:');
  log(`  ${TEST_VIDEO_PATH}`, 'gray');
  log('  Or use: scripts/create-test-video.sh', 'gray');
  throw new Error('Test video not found');
}

async function getVideoDuration(filePath) {
  // Simple duration check - just return a placeholder
  // In a real implementation, you'd use ffprobe or similar
  return 10.5; // 10.5 seconds
}

async function uploadVideo(filePath) {
  const stats = fs.statSync(filePath);
  const fileName = path.basename(filePath);

  logInfo(`Preparing to upload: ${fileName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  // Step 1: Request presigned upload URL
  const { projectId, uploadUrl, objectKey } = await apiCall('/api/upload', {
    method: 'POST',
    body: JSON.stringify({
      filename: fileName,
      fileSize: stats.size,
      contentType: 'video/mp4',
    }),
  });

  logSuccess(`Created project: ${projectId}`);
  log(`  Object key: ${objectKey}`, 'gray');

  // Step 2: Upload to R2
  const fileBuffer = fs.readFileSync(filePath);
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: fileBuffer,
    headers: {
      'Content-Type': 'video/mp4',
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`R2 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  logSuccess(`Uploaded to R2 (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  // Step 3: Signal upload completion
  const duration = await getVideoDuration(filePath);
  await apiCall('/api/upload/complete', {
    method: 'POST',
    body: JSON.stringify({ projectId, duration }),
  });

  logSuccess('Upload completion verified and transcription queued');

  return projectId;
}

async function pollForCompletion(projectId) {
  const startTime = Date.now();
  let lastStatus = '';
  let lastProgress = 0;

  while (true) {
    const elapsed = Date.now() - startTime;

    if (elapsed > MAX_WAIT_TIME_MS) {
      throw new Error('Timeout waiting for transcription to complete');
    }

    // Get project details
    const project = await apiCall(`/api/projects/${projectId}`);

    const status = project.project?.status || 'unknown';
    const progress = project.project?.progress || 0;

    // Log status changes
    if (status !== lastStatus || progress !== lastProgress) {
      if (status === 'processing') {
        logWait(`Status: processing (preparing for transcription)`);
      } else if (status === 'transcribing') {
        logWait(`Status: transcribing (${progress}%)`);
      } else if (status === 'completed') {
        logSuccess(`Transcription complete (${(elapsed / 1000).toFixed(1)}s total)`);
        return project;
      } else if (status === 'error') {
        throw new Error(`Transcription failed: ${project.project?.errorMessage || 'Unknown error'}`);
      } else {
        logInfo(`Status: ${status}`);
      }

      lastStatus = status;
      lastProgress = progress;
    }

    if (status === 'completed') {
      return project;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('Upload → Transcription Test', 'blue');
  console.log('='.repeat(60) + '\n');

  try {
    // Validate environment
    if (!CLERK_SECRET_KEY && !process.env.CI) {
      logWait('Warning: CLERK_SECRET_KEY not set. Using test token (local only)');
    }

    logInfo(`Worker URL: ${WORKER_URL}`);
    logInfo(`Test User ID: ${TEST_USER_ID}\n`);

    // Step 1: Prepare test video
    const videoPath = await createTestVideo();

    // Step 2: Upload video
    log('\n[Step 1/2] Uploading video...', 'blue');
    const projectId = await uploadVideo(videoPath);

    // Step 3: Poll for completion
    log('\n[Step 2/2] Waiting for transcription...', 'blue');
    const result = await pollForCompletion(projectId);

    // Display results
    console.log('\n' + '='.repeat(60));
    logSuccess('All tests passed!');
    console.log('='.repeat(60));

    if (result.transcription) {
      console.log('\nTranscription preview:');
      const preview = result.transcription.text.substring(0, 200);
      log(`"${preview}${result.transcription.text.length > 200 ? '...' : ''}"`, 'gray');
      log(`\nFull length: ${result.transcription.text.length} characters`, 'gray');

      if (result.transcription.segments) {
        const segments = JSON.parse(result.transcription.segments);
        log(`Segments: ${segments.length}`, 'gray');
      }
    } else {
      logWait('Note: Transcription text not yet available');
    }

    console.log('\n');
    process.exit(0);
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    logError('Test failed!');
    console.log('='.repeat(60));
    logError(error.message);

    if (error.stack) {
      log('\nStack trace:', 'gray');
      log(error.stack, 'gray');
    }

    console.log('\n');
    process.exit(1);
  }
}

// Run the test
main();
