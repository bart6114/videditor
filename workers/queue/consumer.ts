import { Env, VideoProcessingMessage, ShortCutMessage } from '../env';
import { processTranscription } from './processors/transcription';
import { processAnalysis } from './processors/analysis';
import { processVideoCut } from './processors/video-cut';
import { processStreamUpload } from './processors/stream-upload';
import { logInfo, logError } from '../utils/logger';

/**
 * Handle messages from the queue
 */
export async function handleQueueMessage(
  batch: MessageBatch<unknown>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const startTime = Date.now();
    let body: VideoProcessingMessage | ShortCutMessage | undefined;

    try {
      body = message.body as VideoProcessingMessage | ShortCutMessage;

      // Extract retry attempt (Cloudflare Queues track this internally)
      // The attempts property may not be directly accessible, so we'll track it via metadata
      const attempt = (message as any).attempts || 1;

      // Build context for logging
      const context = {
        type: body.type,
        projectId: 'projectId' in body ? body.projectId : undefined,
        userId: 'userId' in body ? body.userId : undefined,
        attempt,
      };

      logInfo('Starting queue message processing', context);

      switch (body.type) {
        case 'upload_to_stream':
          await processStreamUpload(env, body as VideoProcessingMessage, attempt);
          break;

        case 'transcribe':
          await processTranscription(env, body as VideoProcessingMessage, attempt);
          break;

        case 'analyze':
          await processAnalysis(env, body as VideoProcessingMessage, attempt);
          break;

        case 'cut_video':
          await processVideoCut(env, body as ShortCutMessage, attempt);
          break;

        default:
          console.error('Unknown message type:', (body as { type: string }).type);
      }

      const duration = Date.now() - startTime;
      logInfo('Queue message processing completed', {
        ...context,
        duration: `${duration}ms`,
      });

      // Acknowledge message
      message.ack();
    } catch (error) {
      const duration = Date.now() - startTime;

      // Build error context
      const errorContext = {
        type: body?.type,
        projectId: 'projectId' in (body || {}) ? (body as any).projectId : undefined,
        userId: 'userId' in (body || {}) ? (body as any).userId : undefined,
        attempt: (message as any).attempts || 1,
        duration: `${duration}ms`,
      };

      logError('Queue message processing failed', error, errorContext);

      // Retry by not acknowledging
      message.retry();
    }
  }
}
