import { Env, VideoProcessingMessage } from '../env';
import { Project } from '../../types/d1';

interface TranscribeRequest {
  projectId: string;
}

/**
 * Handle transcription request
 * Queues the project for transcription processing
 */
export async function handleTranscribeRequest(
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
    const body = await request.json() as TranscribeRequest;
    const { projectId } = body;

    // Verify project ownership
    const project = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?'
    )
      .bind(projectId, userId)
      .first<Project>();

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if transcription already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM transcriptions WHERE project_id = ?'
    )
      .bind(projectId)
      .first();

    if (existing) {
      return new Response(
        JSON.stringify({ error: 'Transcription already exists' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update project status
    await env.DB.prepare(
      `UPDATE projects SET status = 'transcribing', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    // Create processing job
    const jobId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO processing_jobs (id, project_id, type, status, progress, created_at, updated_at)
       VALUES (?, ?, 'transcription', 'pending', 0, datetime('now'), datetime('now'))`
    )
      .bind(jobId, projectId)
      .run();

    // Queue transcription job
    const message: VideoProcessingMessage = {
      type: 'transcribe',
      projectId,
      userId,
    };

    await env.VIDEO_QUEUE.send(message);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: 'Transcription job queued',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Transcribe error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Transcription failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
