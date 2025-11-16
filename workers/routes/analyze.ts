import { Env, VideoProcessingMessage } from '../env';
import { corsResponse, corsError } from '../utils/cors';
import { createDb } from '../../db';
import { getProjectById, updateProjectStatus } from '../../db/queries/projects';
import { getTranscriptionByProjectId } from '../../db/queries/transcriptions';
import { createJob } from '../../db/queries/jobs';

interface AnalyzeRequest {
  projectId: string;
  shortsCount?: number;
  customPrompt?: string;
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
    return corsError('Method not allowed', { status: 405, env });
  }

  try {
    const body = await request.json() as AnalyzeRequest;
    const { projectId, shortsCount = 3, customPrompt } = body;
    const db = createDb(env.DB);

    // Verify project ownership
    const project = await getProjectById(db, projectId, userId);
    if (!project) {
      return corsError('Project not found', { status: 404, env });
    }

    // Check if transcription exists
    const transcription = await getTranscriptionByProjectId(db, projectId);
    if (!transcription) {
      return corsError('Transcription required for analysis', { status: 400, env });
    }

    // Update project status
    await updateProjectStatus(db, projectId, 'analyzing');

    // Create processing job
    const jobId = crypto.randomUUID();
    await createJob(db, {
      id: jobId,
      projectId,
      type: 'analysis',
      status: 'pending',
      progress: 0,
    });

    // Validate shortsCount
    if (shortsCount < 1 || shortsCount > 10) {
      return corsError('shortsCount must be between 1 and 10', { status: 400, env });
    }

    // Queue analysis job
    const message: VideoProcessingMessage = {
      type: 'analyze',
      projectId,
      userId,
      metadata: {
        shortsCount,
        customPrompt,
      },
    };

    await env.VIDEO_QUEUE.send(message);

    return corsResponse(
      {
        success: true,
        jobId,
        message: 'Analysis job queued',
      },
      { status: 200, env }
    );
  } catch (error) {
    console.error('Analyze error:', error);
    return corsError(
      error instanceof Error ? error.message : 'Analysis failed',
      { status: 500, env }
    );
  }
}
