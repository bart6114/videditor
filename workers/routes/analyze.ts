import { Env, VideoProcessingMessage } from '../env';
import { Project } from '../../types/d1';

interface AnalyzeRequest {
  projectId: string;
}

/**
 * Handle analysis request
 * Queues the project for AI analysis to generate short suggestions
 */
export async function handleAnalyzeRequest(
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
    const body = await request.json() as AnalyzeRequest;
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

    // Check if transcription exists
    const transcription = await env.DB.prepare(
      'SELECT id FROM transcriptions WHERE project_id = ?'
    )
      .bind(projectId)
      .first();

    if (!transcription) {
      return new Response(
        JSON.stringify({ error: 'Transcription required for analysis' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Update project status
    await env.DB.prepare(
      `UPDATE projects SET status = 'analyzing', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    // Create processing job
    const jobId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO processing_jobs (id, project_id, type, status, progress, created_at, updated_at)
       VALUES (?, ?, 'analysis', 'pending', 0, datetime('now'), datetime('now'))`
    )
      .bind(jobId, projectId)
      .run();

    // Queue analysis job
    const message: VideoProcessingMessage = {
      type: 'analyze',
      projectId,
      userId,
    };

    await env.VIDEO_QUEUE.send(message);

    return new Response(
      JSON.stringify({
        success: true,
        jobId,
        message: 'Analysis job queued',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Analyze error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Analysis failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
