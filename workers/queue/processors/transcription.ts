import { Env, VideoProcessingMessage } from '../../env';
import { Project, TranscriptSegment } from '../../../types/d1';

/**
 * Process transcription job
 * Uses Workers AI (Whisper) to transcribe audio directly from R2
 */
export async function processTranscription(
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

    if (!project.video_url) {
      throw new Error('Project video URL not found');
    }

    // Update status
    await env.DB.prepare(
      `UPDATE projects SET status = 'transcribing', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'processing', progress = 10, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'transcription' AND status = 'pending'`
    )
      .bind(projectId)
      .run();

    // Fetch video from R2
    const r2Object = await env.VIDEOS_BUCKET.get(project.video_url);

    if (!r2Object) {
      throw new Error('Video file not found in R2 storage');
    }

    // Get video data as array buffer
    const audioBlob = await r2Object.arrayBuffer();

    // Process in chunks (Whisper works best with ~30s chunks)
    const duration = project.duration || 0;
    const chunkDuration = 30; // seconds
    const chunks = Math.ceil(duration / chunkDuration);

    const segments: TranscriptSegment[] = [];
    let fullText = '';

    for (let i = 0; i < Math.min(chunks, 10); i++) { // Limit to 10 chunks for now
      // Update progress
      const progress = 10 + (i / chunks) * 80;
      await env.DB.prepare(
        `UPDATE processing_jobs
         SET progress = ?, updated_at = datetime('now')
         WHERE project_id = ? AND type = 'transcription'`
      )
        .bind(progress, projectId)
        .run();

      // For simplicity, we'll transcribe the whole audio at once
      // In production, you'd chunk it properly
      if (i === 0) {
        const result = await env.AI.run('@cf/openai/whisper', {
          audio: Array.from(new Uint8Array(audioBlob)),
        }) as {
          text: string;
          words?: Array<{ word: string; start: number; end: number }>;
        };

        fullText = result.text;

        // Create segments from words if available
        if (result.words) {
          let currentSegment: TranscriptSegment = {
            start: 0,
            end: 0,
            text: '',
          };
          let segmentWords: string[] = [];

          for (const word of result.words) {
            segmentWords.push(word.word);

            // Create a new segment every 10 seconds or 50 words
            if (
              word.end - currentSegment.start >= 10 ||
              segmentWords.length >= 50
            ) {
              currentSegment.end = word.end;
              currentSegment.text = segmentWords.join(' ');
              segments.push(currentSegment);

              currentSegment = {
                start: word.end,
                end: word.end,
                text: '',
              };
              segmentWords = [];
            }
          }

          // Add final segment
          if (segmentWords.length > 0) {
            currentSegment.text = segmentWords.join(' ');
            currentSegment.end = result.words[result.words.length - 1].end;
            segments.push(currentSegment);
          }
        } else {
          // No word-level timestamps, create single segment
          segments.push({
            start: 0,
            end: duration,
            text: fullText,
          });
        }

        break; // Process only first chunk for now
      }
    }

    // Save transcription
    const transcriptionId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO transcriptions (id, project_id, text, segments, language, created_at)
       VALUES (?, ?, ?, ?, 'en', datetime('now'))`
    )
      .bind(transcriptionId, projectId, fullText, JSON.stringify(segments))
      .run();

    // Update project and job status
    await env.DB.prepare(
      `UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
    )
      .bind(projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'completed', progress = 100, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'transcription'`
    )
      .bind(projectId)
      .run();

    console.log('Transcription completed for project:', projectId);
  } catch (error) {
    console.error('Transcription failed:', error);

    // Update status to error
    await env.DB.prepare(
      `UPDATE projects
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(error instanceof Error ? error.message : 'Transcription failed', projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE project_id = ? AND type = 'transcription'`
    )
      .bind(error instanceof Error ? error.message : 'Transcription failed', projectId)
      .run();

    throw error;
  }
}
