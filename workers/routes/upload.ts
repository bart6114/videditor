import { Env } from '../env';
import { generateVideoKey } from '../../lib/r2';

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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json() as UploadRequest;
    const { filename, fileSize, contentType } = body;

    // Validate input
    if (!filename || !fileSize) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check file size limit (500MB)
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 500MB limit' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate R2 object key
    const objectKey = generateVideoKey(userId, filename);

    // Generate presigned URL for upload
    const uploadUrl = await env.VIDEOS_BUCKET.createMultipartUpload(objectKey);

    // Create project record in D1
    const projectId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO projects (id, user_id, title, video_url, duration, file_size, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'uploading', datetime('now'), datetime('now'))`
    )
      .bind(projectId, userId, filename, objectKey, 0, fileSize)
      .run();

    return new Response(
      JSON.stringify({
        projectId,
        uploadUrl: uploadUrl.key, // This will be used for multipart upload
        objectKey,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Upload failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
