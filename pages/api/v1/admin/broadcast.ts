import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { success, failure } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { isUserAdmin, getAllUserIds } from '@server/db/queries/users';
import { broadcastInboxMessage } from '@/lib/inbox';
import { INBOX_MESSAGE_TYPES, type InboxMessageType } from '@shared/index';

type BroadcastRequest = {
  type: InboxMessageType;
  title: string;
  body: string;
  actionUrl?: string;
  actionLabel?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  // Check if user is admin
  const isAdmin = await isUserAdmin(db, authResult.userId);
  if (!isAdmin) {
    return failure(res, 403, 'Admin access required');
  }

  // Validate request body
  const body = req.body as BroadcastRequest;

  if (!body.type || !INBOX_MESSAGE_TYPES.includes(body.type)) {
    return failure(res, 400, 'Invalid message type. Must be one of: error, info, announcement');
  }

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    return failure(res, 400, 'Title is required');
  }

  if (body.title.length > 255) {
    return failure(res, 400, 'Title must be 255 characters or less');
  }

  if (!body.body || typeof body.body !== 'string' || body.body.trim().length === 0) {
    return failure(res, 400, 'Body is required');
  }

  if (body.actionUrl && body.actionUrl.length > 2048) {
    return failure(res, 400, 'Action URL must be 2048 characters or less');
  }

  if (body.actionLabel && body.actionLabel.length > 100) {
    return failure(res, 400, 'Action label must be 100 characters or less');
  }

  // Get all user IDs
  const userIds = await getAllUserIds(db);

  if (userIds.length === 0) {
    return success(res, { messageCount: 0 });
  }

  // Broadcast message to all users
  const messages = await broadcastInboxMessage({
    userIds,
    type: body.type,
    title: body.title.trim(),
    body: body.body.trim(),
    actionUrl: body.actionUrl?.trim(),
    actionLabel: body.actionLabel?.trim(),
  });

  return success(res, { messageCount: messages.length });
}
