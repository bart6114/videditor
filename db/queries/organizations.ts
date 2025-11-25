import { eq, and, gt, sql } from 'drizzle-orm';
import type { DB } from '../index';
import {
  organizations,
  organizationMembers,
  organizationInvites,
  users,
  type NewOrganization,
  type NewOrganizationMember,
  type NewOrganizationInvite,
  type Organization,
  type OrganizationMember,
} from '../schema';
import crypto from 'crypto';

const MAX_MEMBERS_PER_ORG = 10;
const INVITE_EXPIRY_DAYS = 7;

// ============================================================================
// Organization CRUD
// ============================================================================

/**
 * Create a new organization
 */
export async function createOrganization(
  db: DB,
  data: Omit<NewOrganization, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Organization> {
  const id = `org_${crypto.randomUUID()}`;
  const [org] = await db
    .insert(organizations)
    .values({ ...data, id })
    .returning();
  return org;
}

/**
 * Get organization by ID
 */
export async function getOrganizationById(
  db: DB,
  organizationId: string
): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org ?? null;
}

/**
 * Get organization by slug
 */
export async function getOrganizationBySlug(
  db: DB,
  slug: string
): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return org ?? null;
}

/**
 * Get organization by Stripe customer ID
 */
export async function getOrganizationByStripeCustomerId(
  db: DB,
  stripeCustomerId: string
): Promise<Organization | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return org ?? null;
}

/**
 * Update organization
 */
export async function updateOrganization(
  db: DB,
  organizationId: string,
  data: Partial<Omit<Organization, 'id' | 'createdAt'>>
): Promise<Organization | null> {
  const [org] = await db
    .update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId))
    .returning();
  return org ?? null;
}

// ============================================================================
// Membership Queries
// ============================================================================

/**
 * Get all organizations a user is a member of
 */
export async function getUserOrganizations(
  db: DB,
  userId: string
): Promise<(Organization & { role: 'owner' | 'member' })[]> {
  const memberships = await db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
  }));
}

/**
 * Get a user's role in an organization
 */
export async function getUserRoleInOrganization(
  db: DB,
  userId: string,
  organizationId: string
): Promise<'owner' | 'member' | null> {
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);
  return membership?.role ?? null;
}

/**
 * Check if user is a member of an organization
 */
export async function isUserMemberOfOrganization(
  db: DB,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const role = await getUserRoleInOrganization(db, userId, organizationId);
  return role !== null;
}

/**
 * Check if user is owner of an organization
 */
export async function isUserOwnerOfOrganization(
  db: DB,
  userId: string,
  organizationId: string
): Promise<boolean> {
  const role = await getUserRoleInOrganization(db, userId, organizationId);
  return role === 'owner';
}

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(
  db: DB,
  organizationId: string
): Promise<
  {
    id: string;
    role: 'owner' | 'member';
    userId: string;
    email: string | null;
    fullName: string | null;
    imageUrl: string | null;
    joinedAt: Date;
  }[]
> {
  const members = await db
    .select({
      id: organizationMembers.id,
      role: organizationMembers.role,
      userId: organizationMembers.userId,
      email: users.email,
      fullName: users.fullName,
      imageUrl: users.imageUrl,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, organizationId));

  return members;
}

/**
 * Get member count for an organization
 */
export async function getOrganizationMemberCount(
  db: DB,
  organizationId: string
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));
  return result?.count ?? 0;
}

/**
 * Add a member to an organization
 */
export async function addOrganizationMember(
  db: DB,
  organizationId: string,
  userId: string,
  role: 'owner' | 'member' = 'member'
): Promise<{ success: true; member: OrganizationMember } | { success: false; error: string }> {
  // Check member limit
  const memberCount = await getOrganizationMemberCount(db, organizationId);
  if (memberCount >= MAX_MEMBERS_PER_ORG) {
    return { success: false, error: `Organization has reached maximum of ${MAX_MEMBERS_PER_ORG} members` };
  }

  // Check if already a member
  const existingRole = await getUserRoleInOrganization(db, userId, organizationId);
  if (existingRole !== null) {
    return { success: false, error: 'User is already a member of this organization' };
  }

  const id = `mem_${crypto.randomUUID()}`;
  const [member] = await db
    .insert(organizationMembers)
    .values({ id, organizationId, userId, role })
    .returning();

  return { success: true, member };
}

/**
 * Remove a member from an organization
 */
export async function removeOrganizationMember(
  db: DB,
  organizationId: string,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  // Check if user is owner
  const role = await getUserRoleInOrganization(db, userId, organizationId);
  if (role === 'owner') {
    return { success: false, error: 'Cannot remove owner from organization. Transfer ownership first.' };
  }

  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    );

  return { success: true };
}

/**
 * Transfer ownership to another member
 */
export async function transferOrganizationOwnership(
  db: DB,
  organizationId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<{ success: true } | { success: false; error: string }> {
  // Verify current owner
  const currentRole = await getUserRoleInOrganization(db, currentOwnerId, organizationId);
  if (currentRole !== 'owner') {
    return { success: false, error: 'Only the current owner can transfer ownership' };
  }

  // Verify new owner is a member
  const newOwnerRole = await getUserRoleInOrganization(db, newOwnerId, organizationId);
  if (newOwnerRole === null) {
    return { success: false, error: 'New owner must be a member of the organization' };
  }

  // Update roles
  await db
    .update(organizationMembers)
    .set({ role: 'member', updatedAt: new Date() })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, currentOwnerId)
      )
    );

  await db
    .update(organizationMembers)
    .set({ role: 'owner', updatedAt: new Date() })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, newOwnerId)
      )
    );

  return { success: true };
}

// ============================================================================
// Invite Queries
// ============================================================================

/**
 * Generate a unique invite code
 */
function generateInviteCode(): string {
  // Generate a short, URL-safe code (8 chars)
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

/**
 * Create an invite code for an organization
 */
export async function createOrganizationInvite(
  db: DB,
  organizationId: string,
  createdById: string
): Promise<{ success: true; invite: typeof organizationInvites.$inferSelect } | { success: false; error: string }> {
  // Check if user is owner
  const role = await getUserRoleInOrganization(db, createdById, organizationId);
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can create invite codes' };
  }

  const id = `inv_${crypto.randomUUID()}`;
  const code = generateInviteCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  const [invite] = await db
    .insert(organizationInvites)
    .values({ id, organizationId, code, createdById, expiresAt })
    .returning();

  return { success: true, invite };
}

/**
 * Get invite by code
 */
export async function getInviteByCode(
  db: DB,
  code: string
): Promise<{
  invite: typeof organizationInvites.$inferSelect;
  organization: Organization;
} | null> {
  const [result] = await db
    .select({
      invite: organizationInvites,
      organization: organizations,
    })
    .from(organizationInvites)
    .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
    .where(eq(organizationInvites.code, code.toUpperCase()))
    .limit(1);

  return result ?? null;
}

/**
 * Get active invites for an organization
 */
export async function getOrganizationInvites(
  db: DB,
  organizationId: string
): Promise<typeof organizationInvites.$inferSelect[]> {
  const now = new Date();
  return db
    .select()
    .from(organizationInvites)
    .where(
      and(
        eq(organizationInvites.organizationId, organizationId),
        gt(organizationInvites.expiresAt, now)
      )
    );
}

/**
 * Accept an invite code
 */
export async function acceptInvite(
  db: DB,
  code: string,
  userId: string
): Promise<{ success: true; organizationId: string } | { success: false; error: string }> {
  const result = await getInviteByCode(db, code);
  if (!result) {
    return { success: false, error: 'Invalid invite code' };
  }

  const { invite, organization } = result;

  // Check if expired
  if (new Date() > invite.expiresAt) {
    return { success: false, error: 'Invite code has expired' };
  }

  // Add user to organization
  const addResult = await addOrganizationMember(db, organization.id, userId, 'member');
  if (!addResult.success) {
    return { success: false, error: addResult.error };
  }

  // Increment usage count
  await db
    .update(organizationInvites)
    .set({ usageCount: invite.usageCount + 1 })
    .where(eq(organizationInvites.id, invite.id));

  // Set as user's default organization if they don't have one
  const [user] = await db
    .select({ defaultOrganizationId: users.defaultOrganizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.defaultOrganizationId) {
    await db
      .update(users)
      .set({ defaultOrganizationId: organization.id, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  return { success: true, organizationId: organization.id };
}

/**
 * Revoke an invite
 */
export async function revokeInvite(
  db: DB,
  inviteId: string,
  organizationId: string
): Promise<void> {
  await db
    .delete(organizationInvites)
    .where(
      and(
        eq(organizationInvites.id, inviteId),
        eq(organizationInvites.organizationId, organizationId)
      )
    );
}

// ============================================================================
// User's Default Organization
// ============================================================================

/**
 * Get user's default/current organization with their role
 */
export async function getUserDefaultOrganization(
  db: DB,
  userId: string
): Promise<(Organization & { role: 'owner' | 'member' }) | null> {
  const [user] = await db
    .select({ defaultOrganizationId: users.defaultOrganizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.defaultOrganizationId) {
    return null;
  }

  const [result] = await db
    .select({
      organization: organizations,
      role: organizationMembers.role,
    })
    .from(organizations)
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.organizationId, organizations.id),
        eq(organizationMembers.userId, userId)
      )
    )
    .where(eq(organizations.id, user.defaultOrganizationId))
    .limit(1);

  if (!result) {
    return null;
  }

  return { ...result.organization, role: result.role };
}

/**
 * Set user's default organization
 */
export async function setUserDefaultOrganization(
  db: DB,
  userId: string,
  organizationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  // Verify user is a member
  const isMember = await isUserMemberOfOrganization(db, userId, organizationId);
  if (!isMember) {
    return { success: false, error: 'User is not a member of this organization' };
  }

  await db
    .update(users)
    .set({ defaultOrganizationId: organizationId, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { success: true };
}

// ============================================================================
// Organization Creation with Owner
// ============================================================================

/**
 * Create a new organization and add the creator as owner
 * Used when a new user signs up or creates an additional organization
 */
export async function createOrganizationWithOwner(
  db: DB,
  data: {
    name: string;
    slug?: string;
    ownerId: string;
    setAsDefault?: boolean;
  }
): Promise<Organization> {
  const orgId = `org_${crypto.randomUUID()}`;
  const memberId = `mem_${crypto.randomUUID()}`;

  // Generate slug if not provided
  const baseSlug = (data.slug || data.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 50);
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;

  // Create organization
  const [org] = await db
    .insert(organizations)
    .values({
      id: orgId,
      name: data.name,
      slug,
    })
    .returning();

  // Add creator as owner
  await db.insert(organizationMembers).values({
    id: memberId,
    organizationId: orgId,
    userId: data.ownerId,
    role: 'owner',
  });

  // Set as default if requested or if user doesn't have a default
  if (data.setAsDefault !== false) {
    const [user] = await db
      .select({ defaultOrganizationId: users.defaultOrganizationId })
      .from(users)
      .where(eq(users.id, data.ownerId))
      .limit(1);

    if (data.setAsDefault || !user?.defaultOrganizationId) {
      await db
        .update(users)
        .set({ defaultOrganizationId: orgId, updatedAt: new Date() })
        .where(eq(users.id, data.ownerId));
    }
  }

  return org;
}
