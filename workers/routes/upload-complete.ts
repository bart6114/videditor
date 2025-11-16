import { Env, VideoProcessingMessage } from '../env';
import { corsResponse, corsError } from '../utils/cors';
import { createDb } from '../../db';
import { createProject, getProjectById, updateProject } from '../../db/queries/projects';
import { createJob } from '../../db/queries/jobs';

interface UploadCompleteRequest {
  projectId: string;
  duration: number;
  filename: string;
  objectKey: string;
}

/**
 * Verify R2 object exists with retry logic
 * Handles eventual consistency by retrying with exponential backoff
 */
async function verifyR2ObjectWithRetry(
  bucket: R2Bucket,
  key: string,
  maxAttempts = 5,
  initialDelayMs = 100
): Promise<R2Object | null> {
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[R2-VERIFY] Attempt ${attempt}/${maxAttempts}: Checking bucket.head('${key}')`);
    const obj = await bucket.head(key);

    if (obj) {
      const elapsed = Date.now() - startTime;
      console.log(`[R2-VERIFY] ✓ Object found after ${attempt} attempt(s) (${elapsed}ms):`, {
        key,
        size: obj.size,
        uploaded: obj.uploaded,
      });
      return obj;
    }

    if (attempt < maxAttempts) {
      const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[R2-VERIFY] ✗ Object not found (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const elapsed = Date.now() - startTime;
  console.error(`[R2-VERIFY] ✗ Object NOT FOUND after ${maxAttempts} attempts (${elapsed}ms): ${key}`);
  return null;
}

/**
 * Handle upload completion
 * Verifies R2 upload, creates project in database, and triggers transcription
 */
export async function handleUploadComplete(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return corsError('Method not allowed', { status: 405, env });
  }

  try {
    const body = await request.json() as UploadCompleteRequest;
    const { projectId, duration, filename, objectKey } = body;

    // Validate input
    if (!projectId || !duration || !filename || !objectKey) {
      return corsError('Missing required fields', { status: 400, env });
    }

    // Debug logging before verification
    console.log('[UPLOAD-COMPLETE] Starting R2 verification:', {
      projectId,
      objectKey,
      bucketBinding: 'VIDEOS_BUCKET',
      environment: env.ENVIRONMENT,
      filename,
    });

    // Verify R2 upload exists BEFORE creating project (with retry for eventual consistency)
    // Works for both dev (local R2 via /api/upload/direct) and prod (production R2 via presigned URL)
    const r2Object = await verifyR2ObjectWithRetry(env.VIDEOS_BUCKET, objectKey);
    if (!r2Object) {
      // Upload not found in R2 after retries - do NOT create project
      console.error(`[UPLOAD-COMPLETE] Upload verification failed for ${objectKey}: file not found in R2 after retries`);
      return corsError('Upload verification failed: file not found in R2 after retries', { status: 400, env });
    }

    console.log('[UPLOAD-COMPLETE] R2 verification successful:', {
      projectId,
      objectKey,
      fileSize: r2Object.size,
      environment: env.ENVIRONMENT,
    });

    const db = createDb(env.DB);

    // Create project in database AFTER successful R2 verification
    await createProject(db, {
      id: projectId,
      userId,
      title: filename.replace(/\.[^/.]+$/, ''), // Remove file extension for title
      videoUrl: objectKey,
      duration,
      fileSize: r2Object.size,
      status: 'processing',
    });

    // Create processing job for transcription
    const jobId = crypto.randomUUID();
    await createJob(db, {
      id: jobId,
      projectId,
      type: 'transcription',
      status: 'pending',
      progress: 0,
    });

    // Queue transcription message
    const message: VideoProcessingMessage = {
      type: 'transcribe',
      projectId,
      userId,
      metadata: {
        jobId,
        duration,
      },
    };

    await env.VIDEO_QUEUE.send(message);

    return corsResponse(
      {
        success: true,
        status: 'processing',
        message: 'Upload verified and transcription queued',
      },
      { status: 200, env }
    );
  } catch (error) {
    console.error('Upload completion error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Upload completion failed',
      { status: 500, env }
    );
  }
}
