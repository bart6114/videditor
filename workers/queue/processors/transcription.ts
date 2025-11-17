import { Env, VideoProcessingMessage } from '../../env';
import { Project, TranscriptSegment } from '../../../types/d1';
import {
  logInfo,
  logError,
  logAICall,
  createErrorMetadata,
  createSuccessMetadata,
} from '../../utils/logger';

/**
 * Process transcription job
 * Uses Workers AI (Whisper) to transcribe audio from Cloudflare Stream
 */
export async function processTranscription(
  env: Env,
  message: VideoProcessingMessage,
  attempt: number = 1
): Promise<void> {
  const { projectId, userId } = message;
  const startTime = Date.now();

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

    if (!project.video_uid) {
      throw new Error('Project video UID not found');
    }

    const context = {
      type: 'transcribe',
      projectId,
      userId,
      attempt,
      videoUid: project.video_uid,
      duration: project.duration,
    };

    logInfo('Starting transcription', context);

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

    // Create audio download from Stream
    logInfo('Requesting audio download from Stream', { ...context });
    const { createAudioDownload, pollAudioDownload } = await import('../../../lib/stream');

    await createAudioDownload(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_API_TOKEN,
      project.video_uid
    );

    // Poll for audio download to be ready
    logInfo('Polling for audio download readiness', { ...context });
    const audioDownloadUrl = await pollAudioDownload(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_API_TOKEN,
      project.video_uid
    );

    // Fetch audio file (M4A format)
    logInfo('Downloading audio from Stream', { ...context, audioUrl: audioDownloadUrl });
    const audioResponse = await fetch(audioDownloadUrl);

    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
    }

    // Get audio data as array buffer
    const audioBlob = await audioResponse.arrayBuffer();
    const audioSizeMB = (audioBlob.byteLength / 1024 / 1024).toFixed(2);

    logInfo('Audio downloaded from Stream', {
      ...context,
      audioSize: `${audioSizeMB}MB`,
      contentType: audioResponse.headers.get('content-type') || 'unknown',
    });

    // Process in chunks (Whisper works best with ~30s chunks)
    const videoDuration = project.duration || 0;
    const chunkDuration = 30; // seconds
    const chunks = Math.ceil(videoDuration / chunkDuration);

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
        const audioArray = Array.from(new Uint8Array(audioBlob));

        logAICall('@cf/openai/whisper', 'start', {
          ...context,
          chunkIndex: i + 1,
          totalChunks: Math.min(chunks, 10),
          inputSize: audioArray.length,
          audioSizeMB,
        });

        try {
          const result = await env.AI.run('@cf/openai/whisper', {
            audio: audioArray,
          }) as {
            text: string;
            words?: Array<{ word: string; start: number; end: number }>;
          };

          fullText = result.text;

          logAICall('@cf/openai/whisper', 'success', {
            ...context,
            chunkIndex: i + 1,
            totalChunks: Math.min(chunks, 10),
            outputSize: result.text.length,
            hasWords: !!result.words,
            wordCount: result.words?.length || 0,
          });
        } catch (aiError) {
          logAICall('@cf/openai/whisper', 'error', {
            ...context,
            chunkIndex: i + 1,
            totalChunks: Math.min(chunks, 10),
            inputSize: audioArray.length,
            audioSizeMB,
          });

          // Re-throw with additional context
          throw new Error(
            `Whisper AI failed (chunk ${i + 1}/${Math.min(chunks, 10)}, ${audioSizeMB}MB): ${
              aiError instanceof Error ? aiError.message : String(aiError)
            }`
          );
        }

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
            end: videoDuration,
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

    const processingDuration = Date.now() - startTime;
    const successMetadata = createSuccessMetadata({
      ...context,
      duration: processingDuration,
      segmentsCount: segments.length,
      textLength: fullText.length,
    });

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'completed', progress = 100, metadata = ?, updated_at = datetime('now')
       WHERE project_id = ? AND type = 'transcription'`
    )
      .bind(successMetadata, projectId)
      .run();

    logInfo('Transcription completed', {
      ...context,
      duration: `${processingDuration}ms`,
      segmentsCount: segments.length,
      textLength: fullText.length,
    });
  } catch (error) {
    const processingDuration = Date.now() - startTime;

    const errorContext = {
      type: 'transcribe',
      projectId,
      userId,
      attempt,
      duration: processingDuration,
    };

    logError('Transcription failed', error, errorContext);

    const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    const errorMetadata = createErrorMetadata(error, errorContext);

    // Update status to error
    await env.DB.prepare(
      `UPDATE projects
       SET status = 'error',
           error_message = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(errorMessage, projectId)
      .run();

    await env.DB.prepare(
      `UPDATE processing_jobs
       SET status = 'error',
           error_message = ?,
           metadata = ?,
           updated_at = datetime('now')
       WHERE project_id = ? AND type = 'transcription'`
    )
      .bind(errorMessage, errorMetadata, projectId)
      .run();

    throw error;
  }
}
