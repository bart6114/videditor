import { eq, and, desc, count, lt } from 'drizzle-orm';
import type { DB } from '../index';
import { inboxMessages, type NewInboxMessage, type InboxMessage } from '../schema';

/**
 * List inbox messages for a user (newest first)
 */
export async function listUserInboxMessages(
  db: DB,
  userId: string,
  limit: number = 50
): Promise<InboxMessage[]> {
  return db
    .select()
    .from(inboxMessages)
    .where(eq(inboxMessages.userId, userId))
    .orderBy(desc(inboxMessages.createdAt))
    .limit(limit);
}

/**
 * Get unread message count for a user
 */
export async function getUnreadMessageCount(db: DB, userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(inboxMessages)
    .where(and(eq(inboxMessages.userId, userId), eq(inboxMessages.isRead, false)));
  return result?.count ?? 0;
}

/**
 * Get a single message by ID (with user ownership verification)
 */
export async function getMessageById(
  db: DB,
  messageId: string,
  userId: string
): Promise<InboxMessage | null> {
  const [message] = await db
    .select()
    .from(inboxMessages)
    .where(and(eq(inboxMessages.id, messageId), eq(inboxMessages.userId, userId)))
    .limit(1);
  return message ?? null;
}

/**
 * Create a new inbox message
 */
export async function createInboxMessage(
  db: DB,
  message: Omit<NewInboxMessage, 'id' | 'createdAt' | 'isRead'>
): Promise<InboxMessage> {
  const id = `msg_${crypto.randomUUID()}`;
  const [created] = await db
    .insert(inboxMessages)
    .values({
      ...message,
      id,
      isRead: false,
    })
    .returning();
  return created;
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(
  db: DB,
  messageId: string,
  userId: string
): Promise<InboxMessage | null> {
  const [updated] = await db
    .update(inboxMessages)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(inboxMessages.id, messageId), eq(inboxMessages.userId, userId)))
    .returning();
  return updated ?? null;
}

/**
 * Mark all messages as read for a user
 */
export async function markAllMessagesAsRead(db: DB, userId: string): Promise<number> {
  const result = await db
    .update(inboxMessages)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(inboxMessages.userId, userId), eq(inboxMessages.isRead, false)));
  return result.rowCount ?? 0;
}

/**
 * Delete a message
 */
export async function deleteMessage(
  db: DB,
  messageId: string,
  userId: string
): Promise<{ id: string } | null> {
  const [deleted] = await db
    .delete(inboxMessages)
    .where(and(eq(inboxMessages.id, messageId), eq(inboxMessages.userId, userId)))
    .returning({ id: inboxMessages.id });
  return deleted ?? null;
}

/**
 * Delete messages older than a specified date (for retention cleanup)
 */
export async function deleteOldMessages(db: DB, olderThan: Date): Promise<number> {
  const result = await db
    .delete(inboxMessages)
    .where(lt(inboxMessages.createdAt, olderThan));
  return result.rowCount ?? 0;
}

/**
 * Create inbox messages for multiple users (for announcements)
 */
export async function createBulkInboxMessages(
  db: DB,
  userIds: string[],
  message: Omit<NewInboxMessage, 'id' | 'userId' | 'createdAt' | 'isRead'>
): Promise<InboxMessage[]> {
  const messages = userIds.map((userId) => ({
    id: `msg_${crypto.randomUUID()}`,
    userId,
    ...message,
    isRead: false,
  }));

  if (messages.length === 0) {
    return [];
  }

  return db.insert(inboxMessages).values(messages).returning();
}
