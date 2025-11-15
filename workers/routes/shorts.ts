import { Env, ShortCutMessage } from '../env';
import { Short } from '../../types/d1';

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

  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createShort(
  request: Request,
  env: Env,
  userId: string
): Promise<Response> {
  try {
    const body = await request.json() as CreateShortRequest;
    const { projectId, title, description, startTime, endTime } = body;

    // Validate input
    if (!projectId || !title || startTime === undefined || endTime === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (startTime >= endTime) {
      return new Response(
        JSON.stringify({ error: 'Start time must be before end time' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify project ownership
    const project = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first();

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create short record
    const shortId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO shorts (id, project_id, title, description, start_time, end_time, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))`
    )
      .bind(shortId, projectId, title, description, startTime, endTime)
      .run();

    // Create processing job
    const jobId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO processing_jobs (id, project_id, type, status, progress, metadata, created_at, updated_at)
       VALUES (?, ?, 'video_cut', 'pending', 0, ?, datetime('now'), datetime('now'))`
    )
      .bind(jobId, projectId, JSON.stringify({ shortId }))
      .run();

    // Queue video cutting job
    const message: ShortCutMessage = {
      type: 'cut_video',
      projectId,
      shortId,
      startTime,
      endTime,
    };

    await env.VIDEO_QUEUE.send(message);

    return new Response(
      JSON.stringify({
        success: true,
        shortId,
        jobId,
        message: 'Short creation job queued',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create short error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to create short',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function getShort(env: Env, userId: string, shortId: string): Promise<Response> {
  try {
    // Get short and verify ownership through project
    const short = await env.DB.prepare(
      `SELECT s.* FROM shorts s
       JOIN projects p ON s.project_id = p.id
       WHERE s.id = ? AND p.user_id = ?`
    )
      .bind(shortId, userId)
      .first<Short>();

    if (!short) {
      return new Response(JSON.stringify({ error: 'Short not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ short }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get short error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to get short' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function deleteShort(env: Env, userId: string, shortId: string): Promise<Response> {
  try {
    // Verify ownership
    const short = await env.DB.prepare(
      `SELECT s.* FROM shorts s
       JOIN projects p ON s.project_id = p.id
       WHERE s.id = ? AND p.user_id = ?`
    )
      .bind(shortId, userId)
      .first<Short>();

    if (!short) {
      return new Response(JSON.stringify({ error: 'Short not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete from Stream if exists
    if (short.stream_clip_id) {
      try {
        const { deleteStreamVideo } = await import('../../lib/stream');
        await deleteStreamVideo(
          env.CLOUDFLARE_ACCOUNT_ID,
          env.CLOUDFLARE_STREAM_API_KEY,
          short.stream_clip_id
        );
      } catch (error) {
        console.error('Failed to delete clip from Stream:', error);
      }
    }

    // Delete from database
    await env.DB.prepare('DELETE FROM shorts WHERE id = ?')
      .bind(shortId)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete short error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete short' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function downloadShort(env: Env, userId: string, shortId: string): Promise<Response> {
  try {
    // Get short and verify ownership
    const short = await env.DB.prepare(
      `SELECT s.* FROM shorts s
       JOIN projects p ON s.project_id = p.id
       WHERE s.id = ? AND p.user_id = ?`
    )
      .bind(shortId, userId)
      .first<Short>();

    if (!short) {
      return new Response(JSON.stringify({ error: 'Short not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (short.status !== 'completed' || !short.video_url) {
      return new Response(
        JSON.stringify({ error: 'Short is not ready for download' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Return the Stream playback URL (already public)
    return new Response(
      JSON.stringify({
        downloadUrl: short.video_url,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Download short error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate download link' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
