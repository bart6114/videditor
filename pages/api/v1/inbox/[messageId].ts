import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getMessageById, markMessageAsRead, deleteMessage } from '@server/db/queries/inbox';
import type { InboxMessageData } from '@shared/index';

const updateMessageSchema = z.object({
  isRead: z.boolean(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { messageId } = req.query;

  if (typeof messageId !== 'string') {
    return failure(res, 400, 'Invalid message ID');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  // GET - Get single message
  if (req.method === 'GET') {
    const message = await getMessageById(db, messageId, authResult.userId);

    if (!message) {
      return failure(res, 404, 'Message not found');
    }

    const messageData: InboxMessageData = {
      id: message.id,
      type: message.type,
      title: message.title,
      body: message.body,
      actionUrl: message.actionUrl,
      actionLabel: message.actionLabel,
      isRead: message.isRead,
      createdAt: message.createdAt.toISOString(),
      readAt: message.readAt?.toISOString() ?? null,
    };

    return success(res, { message: messageData });
  }

  // PATCH - Update message (mark as read)
  if (req.method === 'PATCH') {
    const parsed = updateMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      return failure(res, 400, 'Invalid payload', parsed.error.flatten());
    }

    if (parsed.data.isRead) {
      const updated = await markMessageAsRead(db, messageId, authResult.userId);

      if (!updated) {
        return failure(res, 404, 'Message not found');
      }

      const messageData: InboxMessageData = {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        body: updated.body,
        actionUrl: updated.actionUrl,
        actionLabel: updated.actionLabel,
        isRead: updated.isRead,
        createdAt: updated.createdAt.toISOString(),
        readAt: updated.readAt?.toISOString() ?? null,
      };

      return success(res, { message: messageData });
    }

    // For now, we don't support marking as unread
    return failure(res, 400, 'Only marking as read is supported');
  }

  // DELETE - Delete message
  if (req.method === 'DELETE') {
    const deleted = await deleteMessage(db, messageId, authResult.userId);

    if (!deleted) {
      return failure(res, 404, 'Message not found');
    }

    return success(res, { deleted: true });
  }

  return failure(res, 405, 'Method not allowed');
}
