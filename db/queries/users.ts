import { eq } from 'drizzle-orm';
import type { DB } from '../index';
import { users, type NewUser } from '../schema';

/**
 * Ensure user exists in database (upsert pattern)
 * Creates user if doesn't exist, updates metadata if exists
 *
 * @param db - Drizzle database instance
 * @param userId - Clerk user ID
 * @param email - User email (optional - some auth providers don't provide email)
 * @param fullName - User full name (optional)
 * @param imageUrl - User avatar URL (optional)
 */
export async function ensureUserExists(
  db: DB,
  userId: string,
  email?: string,
  fullName?: string,
  imageUrl?: string
): Promise<void> {
  await db
    .insert(users)
    .values({
      id: userId,
      email: email ?? null,
      fullName: fullName ?? null,
      imageUrl: imageUrl ?? null,
    })
    .onConflictDoNothing({ target: users.id });

  // Build update set dynamically - only update fields that are provided
  // This prevents overwriting existing email with null when user logs in via provider without email
  const updateSet: Record<string, unknown> = {
    fullName: fullName ?? null,
    imageUrl: imageUrl ?? null,
    updatedAt: new Date(),
  };

  // Only update email if explicitly provided
  if (email !== undefined) {
    updateSet.email = email;
  }

  await db
    .update(users)
    .set(updateSet)
    .where(eq(users.id, userId));
}

/**
 * Get user by ID
 */
export async function getUserById(db: DB, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(db: DB, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

/**
 * Create new user
 */
export async function createUser(db: DB, user: NewUser) {
  const [created] = await db.insert(users).values(user).returning();
  return created;
}
