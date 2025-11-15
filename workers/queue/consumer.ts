import { Env, VideoProcessingMessage, ShortCutMessage } from '../env';
import { processTranscription } from './processors/transcription';
import { processAnalysis } from './processors/analysis';
import { processVideoCut } from './processors/video-cut';
import { processStreamUpload } from './processors/stream-upload';

/**
 * Handle messages from the queue
 */
export async function handleQueueMessage(
  batch: MessageBatch<unknown>,
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const body = message.body as VideoProcessingMessage | ShortCutMessage;

      console.log('Processing queue message:', body.type);

      switch (body.type) {
        case 'upload_to_stream':
          await processStreamUpload(env, body as VideoProcessingMessage);
          break;

        case 'transcribe':
          await processTranscription(env, body as VideoProcessingMessage);
          break;

        case 'analyze':
          await processAnalysis(env, body as VideoProcessingMessage);
          break;

        case 'cut_video':
          await processVideoCut(env, body as ShortCutMessage);
          break;

        default:
          console.error('Unknown message type:', (body as { type: string }).type);
      }

      // Acknowledge message
      message.ack();
    } catch (error) {
      console.error('Queue message processing error:', error);
      // Retry by not acknowledging
      message.retry();
    }
  }
}
