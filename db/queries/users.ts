import { eq, sql } from 'drizzle-orm';
import type { DB } from '../index';
import { users, organizations, organizationMembers, type NewUser } from '../schema';
import crypto from 'crypto';

/**
 * Convert string to stable integer for advisory lock
 * Used to serialize concurrent operations on the same user
 */
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Ensure user exists in database (upsert pattern)
 * Creates user if doesn't exist, updates metadata if exists
 * Also creates a personal organization for new users
 *
 * Uses a database transaction with advisory lock to prevent race conditions
 * when multiple concurrent requests try to provision the same user.
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
  // Use transaction with advisory lock to prevent race conditions
  // when multiple concurrent requests try to create the same user
  await db.transaction(async (tx) => {
    // Acquire advisory lock on user ID hash - serializes concurrent provisioning
    // pg_advisory_xact_lock auto-releases when transaction ends
    const lockKey = hashStringToInt(userId);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

    // Now safe to check if user exists (no race window)
    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (existingUser) {
      // User exists - just update metadata
      const updateSet: Record<string, unknown> = {
        fullName: fullName ?? null,
        imageUrl: imageUrl ?? null,
        updatedAt: new Date(),
      };

      // Only update email if explicitly provided
      if (email !== undefined) {
        updateSet.email = email;
      }

      await tx.update(users).set(updateSet).where(eq(users.id, userId));
      return;
    }

    // New user - create user and organization atomically
    const orgId = `org_${crypto.randomUUID()}`;
    const memberId = `mem_${crypto.randomUUID()}`;

    // Generate org name
    const orgName = fullName
      ? `${fullName}'s Workspace`
      : email
        ? `${email.split('@')[0]}'s Workspace`
        : 'Personal Workspace';

    // Generate slug
    const baseSlug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50);
    const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

    // Create organization first
    await tx.insert(organizations).values({
      id: orgId,
      name: orgName,
      slug,
      credits: 50, // New users start with 50 free credits
    });

    // Create user with default organization
    await tx.insert(users).values({
      id: userId,
      email: email ?? null,
      fullName: fullName ?? null,
      imageUrl: imageUrl ?? null,
      defaultOrganizationId: orgId,
    });

    // Add user as owner of organization
    await tx.insert(organizationMembers).values({
      id: memberId,
      organizationId: orgId,
      userId: userId,
      role: 'owner',
    });
  });
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
