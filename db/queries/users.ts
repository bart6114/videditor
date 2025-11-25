import { eq } from 'drizzle-orm';
import type { DB } from '../index';
import { users, organizations, organizationMembers, type NewUser } from '../schema';
import crypto from 'crypto';

/**
 * Ensure user exists in database (upsert pattern)
 * Creates user if doesn't exist, updates metadata if exists
 * Also creates a personal organization for new users
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
  // Check if user already exists
  const [existingUser] = await db
    .select({ id: users.id, defaultOrganizationId: users.defaultOrganizationId })
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

    await db.update(users).set(updateSet).where(eq(users.id, userId));
    return;
  }

  // New user - create user and organization
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
  await db.insert(organizations).values({
    id: orgId,
    name: orgName,
    slug,
    credits: 50, // New users start with 50 free credits
  });

  // Create user with default organization
  await db.insert(users).values({
    id: userId,
    email: email ?? null,
    fullName: fullName ?? null,
    imageUrl: imageUrl ?? null,
    defaultOrganizationId: orgId,
  });

  // Add user as owner of organization
  await db.insert(organizationMembers).values({
    id: memberId,
    organizationId: orgId,
    userId: userId,
    role: 'owner',
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
