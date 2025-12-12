import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { listUserInboxMessages, getUnreadMessageCount } from '@server/db/queries/inbox';
import type { InboxMessageData } from '@shared/index';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  // Get messages and unread count in parallel
  const [messages, unreadCount] = await Promise.all([
    listUserInboxMessages(db, authResult.userId),
    getUnreadMessageCount(db, authResult.userId),
  ]);

  // Transform to API response format
  const messageData: InboxMessageData[] = messages.map((msg) => ({
    id: msg.id,
    type: msg.type,
    title: msg.title,
    body: msg.body,
    actionUrl: msg.actionUrl,
    actionLabel: msg.actionLabel,
    isRead: msg.isRead,
    createdAt: msg.createdAt.toISOString(),
    readAt: msg.readAt?.toISOString() ?? null,
  }));

  return success(res, {
    messages: messageData,
    unreadCount,
  });
}
