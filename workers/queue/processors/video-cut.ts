import { Env, ShortCutMessage } from '../../env';
import { Project, Short } from '../../../types/d1';
import { createStreamClip } from '../../../lib/stream';
import {
  logInfo,
  logError,
  logAPICall,
  createErrorMetadata,
  createSuccessMetadata,
} from '../../utils/logger';

/**
 * Process video cut job
 * Creates a clip using Cloudflare Stream API
 */
export async function processVideoCut(
  env: Env,
  message: ShortCutMessage,
  attempt: number = 1
): Promise<void> {
  const { projectId, userId, shortId, startTime, endTime } = message;
  const startProcessing = Date.now();

  try {
    const context = {
      type: 'cut_video',
      projectId,
      userId,
      shortId,
      attempt,
      startTime,
      endTime,
      clipDuration: endTime - startTime,
    };

    logInfo('Starting video cut', context);
    // Get project
    const project = await env.DB.prepare(
      'SELECT * FROM projects WHERE id = ?'
    )
      .bind(projectId)
      .first<Project>();

    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.stream_id) {
      throw new Error('Project must be uploaded to Stream first');
    }

    // Get short
    const short = await env.DB.prepare(
      'SELECT * FROM shorts WHERE id = ?'
    )
      .bind(shortId)
      .first<Short>();

    if (!short) {
      throw new Error('Short not found');
    }

    // Update status
    await env.DB.prepare(
      `UPDATE shorts SET status = 'processing', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(shortId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'processing', progress = 30, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'video_cut' AND status = 'pending'`
    )
      .bind(projectId)
      .run();

    // Create clip using Stream API
    logAPICall('Cloudflare Stream', 'createClip', 'start', {
      ...context,
      streamId: project.stream_id,
    });

    const clip = await createStreamClip(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_STREAM_API_KEY,
      project.stream_id,
      startTime,
      endTime,
      {
        shortId: short.id,
        projectId: project.id,
        title: short.title,
      }
    );

    logAPICall('Cloudflare Stream', 'createClip', 'success', {
      ...context,
      clipId: clip.uid,
    });

    // Update short with clip details
    const clipUrl = clip.playback?.hls || `https://customer-${env.CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${clip.uid}/manifest/video.m3u8`;

    await env.DB.prepare(
      `UPDATE shorts
       SET stream_clip_id = ?,
           video_url = ?,
           status = 'completed',
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(clip.uid, clipUrl, shortId)
      .run();

    const duration = Date.now() - startProcessing;
    const successMetadata = createSuccessMetadata({
      ...context,
      duration,
      clipId: clip.uid,
    });

    // Update processing job
    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'completed', progress = 100, metadata = ?, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'video_cut'`
    )
      .bind(successMetadata, projectId)
      .run();

    logInfo('Video cut completed', {
      ...context,
      clipId: clip.uid,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startProcessing;

    const errorContext = {
      type: 'cut_video',
      projectId,
      userId,
      shortId,
      attempt,
      startTime,
      endTime,
      clipDuration: endTime - startTime,
      duration,
    };

    logError('Video cut failed', error, errorContext);
    logAPICall('Cloudflare Stream', 'createClip', 'error', errorContext);

    const errorMessage = error instanceof Error ? error.message : 'Video cut failed';
    const errorMetadata = createErrorMetadata(error, errorContext);

    // Update status to error
    await env.DB.prepare(
      `UPDATE shorts
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(errorMessage, shortId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'error',
           error_message = ?,
           metadata = ?,
           updated_at = datetime('now')
       WHERE project_id = ? AND type = 'video_cut'`
    )
      .bind(errorMessage, errorMetadata, projectId)
      .run();

    throw error;
  }
}
