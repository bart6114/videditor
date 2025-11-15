import { Env, ShortCutMessage } from '../../env';
import { Project, Short } from '../../../types/d1';
import { createStreamClip } from '../../../lib/stream';

/**
 * Process video cut job
 * Creates a clip using Cloudflare Stream API
 */
export async function processVideoCut(
  env: Env,
  message: ShortCutMessage
): Promise<void> {
  const { projectId, shortId, startTime, endTime } = message;

  try {
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

    // Update processing job
    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'completed', progress = 100, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'video_cut'`
    )
      .bind(projectId)
      .run();

    console.log('Video cut completed:', clip.uid, 'for short:', shortId);
  } catch (error) {
    console.error('Video cut failed:', error);

    // Update status to error
    await env.DB.prepare(
      `UPDATE shorts
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(error instanceof Error ? error.message : 'Video cut failed', shortId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE project_id = ? AND type = 'video_cut'`
    )
      .bind(error instanceof Error ? error.message : 'Video cut failed', projectId)
      .run();

    throw error;
  }
}
