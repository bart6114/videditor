import { Env } from './env';
import { JobTracker } from './durable-objects/JobTracker';
import { handleUploadRequest } from './routes/upload';
import { handleUploadPresignRequest } from './routes/upload-presign';
import { handleDirectUpload } from './routes/upload-direct';
import { handleUploadComplete } from './routes/upload-complete';
import { handleProjectsRequest } from './routes/projects';
import { handleTranscribeRequest } from './routes/transcribe';
import { handleAnalyzeRequest } from './routes/analyze';
import { handleShortsRequest } from './routes/shorts';
import { handleWebhookRequest } from './routes/webhooks';
import { verifyClerkAuth } from './utils/auth';
import { getCorsHeaders, corsError } from './utils/cors';

export { JobTracker };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(env),
      });
    }

    try {
      // Public routes (no auth required)
      if (url.pathname.startsWith('/api/webhooks/')) {
        return handleWebhookRequest(request, env, url.pathname);
      }

      // Protected routes (require Clerk auth)
      const user = await verifyClerkAuth(request, env);
      if (!user) {
        return corsError('Unauthorized', { status: 401, env });
      }

      // Ensure user exists in D1 (upsert from Clerk JWT)
      const { ensureUserExists } = await import('./utils/auth');
      await ensureUserExists(env, user.userId, user.email, user.fullName, user.imageUrl);

      // Route handling
      if (url.pathname === '/api/upload/presign') {
        return handleUploadPresignRequest(request, env, user.userId);
      }

      if (url.pathname === '/api/upload/direct') {
        return handleDirectUpload(request, env, user.userId);
      }

      if (url.pathname === '/api/upload/complete') {
        return handleUploadComplete(request, env, user.userId);
      }

      if (url.pathname.startsWith('/api/upload')) {
        return handleUploadRequest(request, env, user.userId);
      }

      if (url.pathname.startsWith('/api/projects')) {
        return handleProjectsRequest(request, env, user.userId, url.pathname);
      }

      if (url.pathname.startsWith('/api/transcribe')) {
        return handleTranscribeRequest(request, env, user.userId);
      }

      if (url.pathname.startsWith('/api/analyze')) {
        return handleAnalyzeRequest(request, env, user.userId);
      }

      if (url.pathname.startsWith('/api/shorts')) {
        return handleShortsRequest(request, env, user.userId, url.pathname);
      }

      // 404 Not Found
      return corsError('Not found', { status: 404, env });
    } catch (error) {
      console.error('Worker error:', error);
      return corsError(
        error instanceof Error ? error.message : 'Internal server error',
        { status: 500, env }
      );
    }
  },

  // Queue consumer
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const { handleQueueMessage } = await import('./queue/consumer');
    await handleQueueMessage(batch, env);
  },
};
