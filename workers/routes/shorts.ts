import { Env, ShortCutMessage } from '../env';
import { corsResponse, corsError } from '../utils/cors';
import { createDb } from '../../db';
import { getProjectById } from '../../db/queries/projects';
import {
  createShort as createShortQuery,
  getShortById,
  deleteShort as deleteShortQuery,
} from '../../db/queries/shorts';
import { createJob } from '../../db/queries/jobs';

interface CreateShortRequest {
  projectId: string;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
}

/**
 * Handle shorts-related requests
 */
export async function handleShortsRequest(
  request: Request,
  env: Env,
  userId: string,
  pathname: string
): Promise<Response> {
  // POST /api/shorts - Create new short
  if (pathname === '/api/shorts' && request.method === 'POST') {
    return createShort(request, env, userId);
  }

  // GET /api/shorts/:id - Get short details
  const shortIdMatch = pathname.match(/^\/api\/shorts\/([^/]+)$/);
  if (shortIdMatch && request.method === 'GET') {
    return getShort(env, userId, shortIdMatch[1]);
  }

  // DELETE /api/shorts/:id - Delete short
  if (shortIdMatch && request.method === 'DELETE') {
    return deleteShort(env, userId, shortIdMatch[1]);
  }

  // POST /api/shorts/:id/download - Generate download link
  const downloadMatch = pathname.match(/^\/api\/shorts\/([^/]+)\/download$/);
  if (downloadMatch && request.method === 'POST') {
    return downloadShort(env, userId, downloadMatch[1]);
  }

  return corsError('Not found', { status: 404, env });
}

async function createShort(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as CreateShortRequest;
    const { projectId, title, description, startTime, endTime } = body;
    const db = createDb(env.DB);

    // Validate input
    if (!projectId || !title || startTime === undefined || endTime === undefined) {
      return corsError('Missing required fields', { status: 400, env });
    }

    if (startTime >= endTime) {
      return corsError('Start time must be before end time', { status: 400, env });
    }

    // Verify project ownership
    const project = await getProjectById(db, projectId, userId);
    if (!project) {
      return corsError('Project not found', { status: 404, env });
    }

    // Create short record
    const shortId = crypto.randomUUID();
    await createShortQuery(db, {
      id: shortId,
      projectId,
      title,
      description,
      startTime,
      endTime,
      status: 'pending',
    });

    // Create processing job
    const jobId = crypto.randomUUID();
    await createJob(db, {
      id: jobId,
      projectId,
      type: 'video_cut',
      status: 'pending',
      progress: 0,
      metadata: JSON.stringify({ shortId }),
    });

    // Queue video cutting job
    const message: ShortCutMessage = {
      type: 'cut_video',
      projectId,
      shortId,
      startTime,
      endTime,
    };

    await env.VIDEO_QUEUE.send(message);

    return corsResponse(
      {
        success: true,
        shortId,
        jobId,
        message: 'Short creation job queued',
      },
      { status: 201, env }
    );
  } catch (error) {
    console.error('Create short error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Failed to create short',
      { status: 500, env }
    );
  }
}

async function getShort(env: Env, userId: string, shortId: string): Promise<Response> {
  try {
    const db = createDb(env.DB);

    // Get short and verify ownership through project
    const short = await getShortById(db, shortId, userId);
    if (!short) {
      return corsError('Short not found', { status: 404, env });
    }

    return corsResponse({ short }, { status: 200, env });
  } catch (error) {
    console.error('Get short error:', error);
    return corsError('Failed to get short', { status: 500, env });
  }
}

async function deleteShort(env: Env, userId: string, shortId: string): Promise<Response> {
  try {
    const db = createDb(env.DB);

    // Verify ownership
    const short = await getShortById(db, shortId, userId);
    if (!short) {
      return corsError('Short not found', { status: 404, env });
    }

    // Delete from Stream if exists
    if (short.streamClipId) {
      try {
        const { deleteStreamVideo } = await import('../../lib/stream');
        await deleteStreamVideo(
          env.CLOUDFLARE_ACCOUNT_ID,
          env.CLOUDFLARE_STREAM_API_KEY,
          short.streamClipId
        );
      } catch (error) {
        console.error('Failed to delete clip from Stream:', error);
      }
    }

    // Delete from database
    await deleteShortQuery(db, shortId, userId);

    return corsResponse({ success: true }, { status: 200, env });
  } catch (error) {
    console.error('Delete short error:', error);
    return corsError('Failed to delete short', { status: 500, env });
  }
}

async function downloadShort(env: Env, userId: string, shortId: string): Promise<Response> {
  try {
    const db = createDb(env.DB);

    // Get short and verify ownership
    const short = await getShortById(db, shortId, userId);
    if (!short) {
      return corsError('Short not found', { status: 404, env });
    }

    if (short.status !== 'completed' || !short.videoUrl) {
      return corsError('Short is not ready for download', { status: 400, env });
    }

    // Return the Stream playback URL (already public)
    return corsResponse(
      {
        downloadUrl: short.videoUrl,
      },
      { status: 200, env }
    );
  } catch (error) {
    console.error('Download short error:', error);
    return corsError('Failed to generate download link', { status: 500, env });
  }
}
