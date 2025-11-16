import { eq, and, desc } from 'drizzle-orm';
import type { DB } from '../index';
import { shorts, projects, type NewShort, type Short } from '../schema';

/**
 * Get shorts by project ID
 */
export async function getShortsByProjectId(db: DB, projectId: string) {
  return db
    .select()
    .from(shorts)
    .where(eq(shorts.projectId, projectId))
    .orderBy(desc(shorts.createdAt))
    .all();
}

/**
 * Get short by ID (with ownership verification via project)
 */
export async function getShortById(db: DB, shortId: string, userId: string) {
  const result = await db
    .select({
      short: shorts,
      project: projects,
    })
    .from(shorts)
    .innerJoin(projects, eq(shorts.projectId, projects.id))
    .where(and(eq(shorts.id, shortId), eq(projects.userId, userId)))
    .get();

  return result ? { ...result.short, project: result.project } : null;
}

/**
 * Create short
 */
export async function createShort(db: DB, short: NewShort) {
  return db.insert(shorts).values(short).run();
}

/**
 * Update short
 */
export async function updateShort(db: DB, shortId: string, updates: Partial<Short>) {
  return db
    .update(shorts)
    .set({
      ...updates,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(shorts.id, shortId))
    .run();
}

/**
 * Delete short (with ownership verification via project)
 */
export async function deleteShort(db: DB, shortId: string, userId: string) {
  // First verify ownership
  const short = await getShortById(db, shortId, userId);
  if (!short) {
    return null;
  }

  // Delete the short
  return db.delete(shorts).where(eq(shorts.id, shortId)).run();
}

/**
 * Update short status
 */
export async function updateShortStatus(
  db: DB,
  shortId: string,
  status: Short['status'],
  errorMessage?: string
) {
  return db
    .update(shorts)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(shorts.id, shortId))
    .run();
}
