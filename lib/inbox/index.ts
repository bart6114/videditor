import { getDb } from '@server/db';
import { createInboxMessage as createInboxMessageQuery, createBulkInboxMessages } from '@server/db/queries/inbox';
import type { InboxMessageType } from '@shared/index';
import type { InboxMessage } from '@server/db/schema';

type CreateInboxMessageInput = {
  userId: string;
  type: InboxMessageType;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
};

/**
 * Creates a new inbox message for a user.
 * Use this helper from API routes and other server-side code.
 */
export async function createInboxMessage(input: CreateInboxMessageInput): Promise<InboxMessage> {
  const db = getDb();
  return createInboxMessageQuery(db, {
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl ?? null,
    actionLabel: input.actionLabel ?? null,
  });
}

type BroadcastMessageInput = {
  userIds: string[];
  type: InboxMessageType;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
};

/**
 * Creates the same inbox message for multiple users (announcements).
 */
export async function broadcastInboxMessage(input: BroadcastMessageInput): Promise<InboxMessage[]> {
  const db = getDb();
  return createBulkInboxMessages(db, input.userIds, {
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl ?? null,
    actionLabel: input.actionLabel ?? null,
  });
}

/**
 * Pre-built notification helpers for common events
 */
export const notifications = {
  /**
   * Notify user when a video has been published to YouTube
   */
  async videoPublishedToYouTube(userId: string, projectTitle: string, youtubeUrl: string) {
    return createInboxMessage({
      userId,
      type: 'info',
      title: `Video published to YouTube`,
      body: `Your video "${projectTitle}" has been successfully published to YouTube.`,
      actionUrl: youtubeUrl,
      actionLabel: 'View on YouTube',
    });
  },

  /**
   * Notify user when a video has been published to Instagram
   */
  async videoPublishedToInstagram(userId: string, projectTitle: string, instagramUrl: string) {
    return createInboxMessage({
      userId,
      type: 'info',
      title: `Reel published to Instagram`,
      body: `Your video "${projectTitle}" has been successfully published to Instagram.`,
      actionUrl: instagramUrl,
      actionLabel: 'View on Instagram',
    });
  },

  /**
   * Notify user when transcription is complete
   */
  async transcriptionComplete(userId: string, projectId: string, projectTitle: string) {
    return createInboxMessage({
      userId,
      type: 'info',
      title: `Transcription ready`,
      body: `The transcription for "${projectTitle}" is now complete and ready for review.`,
      actionUrl: `/projects/${projectId}`,
      actionLabel: 'View Project',
    });
  },

  /**
   * Notify user when a job has failed
   */
  async jobFailed(userId: string, projectId: string, projectTitle: string, errorMessage: string) {
    return createInboxMessage({
      userId,
      type: 'error',
      title: `Processing failed`,
      body: `There was an error processing "${projectTitle}": ${errorMessage}`,
      actionUrl: `/projects/${projectId}`,
      actionLabel: 'View Project',
    });
  },
};
