import { eq } from 'drizzle-orm';
import type { DB } from '../index';
import { users, type NewUser } from '../schema';

/**
 * Ensure user exists in database (upsert pattern)
 * Creates user if doesn't exist, updates metadata if exists
 *
 * @param db - Drizzle database instance
 * @param userId - Clerk user ID
 * @param email - User email
 * @param fullName - User full name (optional)
 * @param imageUrl - User avatar URL (optional)
 */
export async function ensureUserExists(
  db: DB,
  userId: string,
  email: string,
  fullName?: string,
  imageUrl?: string
): Promise<void> {
  // Insert user if doesn't exist (using INSERT OR IGNORE)
  await db
    .insert(users)
    .values({
      id: userId,
      email,
      fullName: fullName ?? null,
      imageUrl: imageUrl ?? null,
    })
    .onConflictDoNothing()
    .run();

  // Update user metadata to keep it fresh
  await db
    .update(users)
    .set({
      email,
      fullName: fullName ?? null,
      imageUrl: imageUrl ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .run();
}

/**
 * Get user by ID
 */
export async function getUserById(db: DB, userId: string) {
  return db.select().from(users).where(eq(users.id, userId)).get();
}

/**
 * Get user by email
 */
export async function getUserByEmail(db: DB, email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

/**
 * Create new user
 */
export async function createUser(db: DB, user: NewUser) {
  return db.insert(users).values(user).run();
}
