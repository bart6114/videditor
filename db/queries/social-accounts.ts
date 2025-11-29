import { eq, and } from 'drizzle-orm';
import type { DB } from '../index';
import {
  socialAccounts,
  type NewSocialAccount,
  type SocialAccount,
} from '../schema';
import crypto from 'crypto';

// ============================================================================
// Social Account CRUD
// ============================================================================

/**
 * Create a new social account
 */
export async function createSocialAccount(
  db: DB,
  data: Omit<NewSocialAccount, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SocialAccount> {
  const id = `social_${crypto.randomUUID()}`;
  const [account] = await db
    .insert(socialAccounts)
    .values({ ...data, id })
    .returning();
  return account;
}

/**
 * Get social account by ID
 */
export async function getSocialAccountById(
  db: DB,
  accountId: string
): Promise<SocialAccount | null> {
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId))
    .limit(1);
  return account ?? null;
}

/**
 * Get social account by organization and platform
 */
export async function getSocialAccountByOrgAndPlatform(
  db: DB,
  organizationId: string,
  platform: 'youtube' | 'tiktok' | 'instagram'
): Promise<SocialAccount | null> {
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.organizationId, organizationId),
        eq(socialAccounts.platform, platform)
      )
    )
    .limit(1);
  return account ?? null;
}

/**
 * Get all social accounts for an organization
 */
export async function getSocialAccountsByOrganization(
  db: DB,
  organizationId: string
): Promise<SocialAccount[]> {
  return db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.organizationId, organizationId));
}

/**
 * Update social account
 */
export async function updateSocialAccount(
  db: DB,
  accountId: string,
  data: Partial<Omit<SocialAccount, 'id' | 'createdAt'>>
): Promise<SocialAccount | null> {
  const [account] = await db
    .update(socialAccounts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(socialAccounts.id, accountId))
    .returning();
  return account ?? null;
}

/**
 * Update social account tokens (for refresh)
 */
export async function updateSocialAccountTokens(
  db: DB,
  accountId: string,
  tokens: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: Date;
  }
): Promise<SocialAccount | null> {
  const updateData: Partial<SocialAccount> = {
    accessToken: tokens.accessToken,
    tokenExpiresAt: tokens.tokenExpiresAt,
    updatedAt: new Date(),
  };
  if (tokens.refreshToken) {
    updateData.refreshToken = tokens.refreshToken;
  }

  const [account] = await db
    .update(socialAccounts)
    .set(updateData)
    .where(eq(socialAccounts.id, accountId))
    .returning();
  return account ?? null;
}

/**
 * Delete social account
 */
export async function deleteSocialAccount(
  db: DB,
  accountId: string
): Promise<void> {
  await db.delete(socialAccounts).where(eq(socialAccounts.id, accountId));
}

/**
 * Delete social account by organization and platform
 */
export async function deleteSocialAccountByOrgAndPlatform(
  db: DB,
  organizationId: string,
  platform: 'youtube' | 'tiktok' | 'instagram'
): Promise<void> {
  await db
    .delete(socialAccounts)
    .where(
      and(
        eq(socialAccounts.organizationId, organizationId),
        eq(socialAccounts.platform, platform)
      )
    );
}

/**
 * Upsert social account (insert or update on conflict)
 */
export async function upsertSocialAccount(
  db: DB,
  data: Omit<NewSocialAccount, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SocialAccount> {
  const existing = await getSocialAccountByOrgAndPlatform(
    db,
    data.organizationId,
    data.platform
  );

  if (existing) {
    const [updated] = await db
      .update(socialAccounts)
      .set({
        channelId: data.channelId,
        channelTitle: data.channelTitle,
        channelThumbnail: data.channelThumbnail,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        connectedById: data.connectedById,
        updatedAt: new Date(),
      })
      .where(eq(socialAccounts.id, existing.id))
      .returning();
    return updated;
  }

  return createSocialAccount(db, data);
}
