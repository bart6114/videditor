import { Env } from '../env';
import { generateVideoKey, createR2Client, generatePresignedUploadUrl } from '../../lib/r2';
import { corsResponse, corsError } from '../utils/cors';
import { createDb } from '../../db';
import { createProject } from '../../db/queries/projects';

interface UploadRequest {
  filename: string;
  fileSize: number;
  contentType: string;
}

/**
 * Handle video upload request
 * Generates presigned URL for direct R2 upload
 */
export async function handleUploadRequest(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return corsError('Method not allowed', { status: 405, env });
  }

  try {
    const body = await request.json() as UploadRequest;
    const { filename, fileSize, contentType } = body;

    // Validate input
    if (!filename || !fileSize) {
      return corsError('Missing required fields', { status: 400, env });
    }

    // Check file size limit (1GB)
    const MAX_FILE_SIZE = 1024 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return corsError('File size exceeds 1GB limit', { status: 400, env });
    }

    // Generate project ID first (needed for R2 object key)
    const projectId = crypto.randomUUID();

    // Generate R2 object key with project ID
    const objectKey = generateVideoKey(userId, projectId, filename, env.ENVIRONMENT);

    // Create R2 client and generate presigned URL for direct upload
    const r2Client = createR2Client(
      env.R2_ACCOUNT_ID,
      env.R2_ACCESS_KEY_ID,
      env.R2_SECRET_ACCESS_KEY
    );

    const bucketName = 'videditor-videos'; // Or use env.R2_BUCKET_NAME if available
    const uploadUrl = await generatePresignedUploadUrl(
      r2Client,
      bucketName,
      objectKey,
      contentType, // Pass actual content type for signature matching
      3600 // 1 hour expiration
    );
    const db = createDb(env.DB);
    await createProject(db, {
      id: projectId,
      userId,
      title: filename,
      videoUrl: objectKey,
      duration: 0,
      fileSize,
      status: 'uploading',
    });

    return corsResponse(
      {
        projectId,
        uploadUrl, // Full presigned URL for direct client upload
        objectKey,
      },
      { status: 200, env }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Upload failed',
      { status: 500, env }
    );
  }
}
