import { Env, VideoProcessingMessage } from '../../env';
import { uploadToStream } from '../../../lib/stream';
import { Project } from '../../../types/d1';

/**
 * Process Stream upload job
 * Uploads video from R2 to Cloudflare Stream
 */
export async function processStreamUpload(
  env: Env,
  message: VideoProcessingMessage
): Promise<void> {
  const { projectId } = message;

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

    // Update status
    await env.DB.prepare(
      `UPDATE projects SET status = 'processing', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    // Generate public R2 URL for Stream to fetch from
    const r2Object = await env.VIDEOS_BUCKET.get(project.video_url);
    if (!r2Object) {
      throw new Error('Video not found in R2');
    }

    // Create a temporary public URL using R2's signed URL
    // Note: In production, you'd use a custom domain with R2 public bucket
    // For now, we'll use Stream's direct upload API instead

    // Upload to Stream
    const streamVideo = await uploadToStream(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_STREAM_API_KEY,
      `https://your-r2-bucket.your-domain.com/${project.video_url}`, // Replace with actual R2 public URL
      {
        projectId: project.id,
        userId: project.user_id,
        title: project.title,
      }
    );

    // Update project with Stream ID
    await env.DB.prepare(
      `UPDATE projects
       SET stream_id = ?,
           status = 'completed',
           duration = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(streamVideo.uid, streamVideo.duration || project.duration, projectId)
      .run();

    console.log('Stream upload completed:', streamVideo.uid);
  } catch (error) {
    console.error('Stream upload failed:', error);

    // Update project status to error
    await env.DB.prepare(
      `UPDATE projects
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(error instanceof Error ? error.message : 'Stream upload failed', projectId)
      .run();

    throw error;
  }
}
