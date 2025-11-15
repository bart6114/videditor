import { Env } from './env';
import { JobTracker } from './durable-objects/JobTracker';
import { handleUploadRequest } from './routes/upload';
import { handleProjectsRequest } from './routes/projects';
import { handleTranscribeRequest } from './routes/transcribe';
import { handleAnalyzeRequest } from './routes/analyze';
import { handleShortsRequest } from './routes/shorts';
import { handleWebhookRequest } from './routes/webhooks';
import { verifyClerkAuth } from './utils/auth';

export { JobTracker };

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      // Public routes (no auth required)
      if (url.pathname.startsWith('/api/webhooks/')) {
        return handleWebhookRequest(request, env, url.pathname);
      }

      // Protected routes (require Clerk auth)
      const userId = await verifyClerkAuth(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Route handling
      if (url.pathname.startsWith('/api/upload')) {
        return handleUploadRequest(request, env, userId);
      }

      if (url.pathname.startsWith('/api/projects')) {
        return handleProjectsRequest(request, env, userId, url.pathname);
      }

      if (url.pathname.startsWith('/api/transcribe')) {
        return handleTranscribeRequest(request, env, userId);
      }

      if (url.pathname.startsWith('/api/analyze')) {
        return handleAnalyzeRequest(request, env, userId);
      }

      if (url.pathname.startsWith('/api/shorts')) {
        return handleShortsRequest(request, env, userId, url.pathname);
      }

      // 404 Not Found
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal server error',
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  },

  // Queue consumer
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    const { handleQueueMessage } = await import('./queue/consumer');
    await handleQueueMessage(batch, env);
  },
};
