import { Env } from '../env';
import { generateVideoKey, createR2Client, generatePresignedUploadUrl } from '../../lib/r2';
import { corsResponse, corsError } from '../utils/cors';

interface UploadPresignRequest {
  filename: string;
  fileSize: number;
  contentType: string;
}

/**
 * Handle presigned URL generation for video upload
 * Does NOT create project in database - that happens after successful R2 upload
 */
export async function handleUploadPresignRequest(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'POST') {
    return corsError('Method not allowed', { status: 405, env });
  }

  try {
    const body = await request.json() as UploadPresignRequest;
    const { filename, fileSize, contentType } = body;

    // Validate input
    if (!filename || !fileSize) {
      return corsError('Missing required fields', { status: 400, env });
    }

    // Check file size limit
    // Development: 100MB (Cloudflare Worker request limit)
    // Production: 1GB (presigned URL direct to R2)
    const MAX_FILE_SIZE = env.ENVIRONMENT === 'development'
      ? 100 * 1024 * 1024  // 100MB for dev
      : 1024 * 1024 * 1024; // 1GB for prod

    if (fileSize > MAX_FILE_SIZE) {
      const limitMB = env.ENVIRONMENT === 'development' ? '100MB' : '1GB';
      return corsError(`File size exceeds ${limitMB} limit in ${env.ENVIRONMENT} mode`, { status: 400, env });
    }

    // Generate project ID (will be used after successful upload)
    const projectId = crypto.randomUUID();

    // Generate R2 object key with project ID
    const objectKey = generateVideoKey(userId, projectId, filename, env.ENVIRONMENT);

    let uploadUrl: string;

    // Development: Use direct Worker upload to local R2 binding
    if (env.ENVIRONMENT === 'development') {
      // Get worker base URL from the incoming request
      const url = new URL(request.url);
      const workerBaseUrl = `${url.protocol}//${url.host}`;

      // Create upload URL that points to direct upload endpoint
      uploadUrl = `${workerBaseUrl}/api/upload/direct?projectId=${encodeURIComponent(projectId)}&key=${encodeURIComponent(objectKey)}`;

      console.log('[UPLOAD-PRESIGN] Development mode: Returning Worker direct upload URL:', {
        projectId,
        objectKey,
        uploadUrl,
        environment: env.ENVIRONMENT,
        fileSize,
        contentType,
      });
    } else {
      // Production: Generate presigned URL for direct R2 upload (bypasses Worker)
      const r2Client = createR2Client(
        env.R2_ACCOUNT_ID,
        env.R2_ACCESS_KEY_ID,
        env.R2_SECRET_ACCESS_KEY
      );

      const bucketName = env.R2_BUCKET_NAME || 'videditor-videos';
      uploadUrl = await generatePresignedUploadUrl(
        r2Client,
        bucketName,
        objectKey,
        contentType,
        3600 // 1 hour expiration
      );

      console.log('[UPLOAD-PRESIGN] Production mode: Presigned URL generated:', {
        projectId,
        objectKey,
        bucketName,
        accountId: env.R2_ACCOUNT_ID,
        environment: env.ENVIRONMENT,
        fileSize,
        contentType,
        urlHost: new URL(uploadUrl).host,
      });
    }

    // NOTE: Project is NOT created in database here
    // It will be created in /upload/complete after R2 verification

    return corsResponse(
      {
        projectId,
        uploadUrl,
        objectKey,
        filename, // Return filename for client reference
      },
      { status: 200, env }
    );
  } catch (error) {
    console.error('Upload presign error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Presign URL generation failed',
      { status: 500, env }
    );
  }
}
