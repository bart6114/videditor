import { Env } from '../env';
import { corsResponse, corsError } from '../utils/cors';

/**
 * Handle direct upload to worker (development mode only)
 * Accepts streaming file upload and writes directly to local R2 binding
 * This allows development uploads to stay in local R2 instead of production
 */
export async function handleDirectUpload(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  if (request.method !== 'PUT') {
    return corsError('Method not allowed', { status: 405, env });
  }

  // Only allow in development mode for security
  if (env.ENVIRONMENT !== 'development') {
    return corsError('Direct upload only available in development', { status: 403, env });
  }

  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('projectId');
    const objectKey = url.searchParams.get('key');

    if (!projectId || !objectKey) {
      return corsError('Missing projectId or key parameter', { status: 400, env });
    }

    // Security: Verify object key belongs to this user
    // Object keys follow pattern: videditor-dev/{userId}/videos/{projectId}/{filename}
    if (!objectKey.includes(userId)) {
      console.error('[DIRECT-UPLOAD] Security violation: userId mismatch', {
        objectKey,
        userId,
      });
      return corsError('Unauthorized: Invalid upload path', { status: 403, env });
    }

    const contentType = request.headers.get('Content-Type') || 'video/mp4';

    console.log('[DIRECT-UPLOAD] Uploading to local R2:', {
      projectId,
      objectKey,
      contentType,
      userId,
    });

    // Stream upload directly to R2 binding (local storage in dev mode)
    // Using request.body as ReadableStream prevents loading entire file into memory
    await env.VIDEOS_BUCKET.put(objectKey, request.body, {
      httpMetadata: {
        contentType,
      },
    });

    console.log('[DIRECT-UPLOAD] ✓ Successfully uploaded to local R2:', {
      projectId,
      objectKey,
    });

    // Return success (matching presigned URL response behavior)
    return corsResponse({ success: true }, { status: 200, env });
  } catch (error) {
    console.error('[DIRECT-UPLOAD] Upload error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Direct upload failed',
      { status: 500, env }
    );
  }
}
