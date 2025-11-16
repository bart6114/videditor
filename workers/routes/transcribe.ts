import { Env, VideoProcessingMessage } from '../env';
import { corsResponse, corsError } from '../utils/cors';
import { createDb } from '../../db';
import { getProjectById } from '../../db/queries/projects';
import { getTranscriptionByProjectId } from '../../db/queries/transcriptions';
import { updateProjectStatus } from '../../db/queries/projects';
import { createJob } from '../../db/queries/jobs';

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
    return corsError('Method not allowed', { status: 405, env });
  }

  try {
    const body = await request.json() as TranscribeRequest;
    const { projectId } = body;
    const db = createDb(env.DB);

    // Verify project ownership
    const project = await getProjectById(db, projectId, userId);
    if (!project) {
      return corsError('Project not found', { status: 404, env });
    }

    // Check if transcription already exists
    const existing = await getTranscriptionByProjectId(db, projectId);
    if (existing) {
      return corsError('Transcription already exists', { status: 400, env });
    }

    // Update project status
    await updateProjectStatus(db, projectId, 'transcribing');

    // Create processing job
    const jobId = crypto.randomUUID();
    await createJob(db, {
      id: jobId,
      projectId,
      type: 'transcription',
      status: 'pending',
      progress: 0,
    });

    // Queue transcription job
    const message: VideoProcessingMessage = {
      type: 'transcribe',
      projectId,
      userId,
    };

    await env.VIDEO_QUEUE.send(message);

    return corsResponse(
      {
        success: true,
        jobId,
        message: 'Transcription job queued',
      },
      { status: 200, env }
    );
  } catch (error) {
    console.error('Transcribe error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Transcription failed',
      { status: 500, env }
    );
  }
}
