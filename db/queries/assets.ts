import { eq, and, desc, inArray } from 'drizzle-orm';
import type { DB } from '../index';
import { mediaAssets, projects, type NewMediaAsset, type MediaAsset } from '../schema';

/**
 * List media assets for a project with optional type filtering
 */
export async function listProjectAssets(
  db: DB,
  projectId: string,
  organizationId: string,
  assetType?: 'long_form' | 'short_form'
) {
  const baseQuery = db
    .select()
    .from(mediaAssets)
    .innerJoin(projects, eq(mediaAssets.projectId, projects.id))
    .where(
      and(
        eq(mediaAssets.projectId, projectId),
        eq(projects.organizationId, organizationId),
        assetType ? eq(mediaAssets.assetType, assetType) : undefined
      )
    )
    .orderBy(desc(mediaAssets.createdAt));

  const results = await baseQuery;
  return results.map((r) => r.media_assets);
}

/**
 * Get a single asset by ID with organization verification
 */
export async function getAssetById(
  db: DB,
  assetId: string,
  organizationId: string
) {
  const [result] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.organizationId, organizationId)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Get multiple assets by IDs with organization verification
 */
export async function getAssetsByIds(
  db: DB,
  assetIds: string[],
  organizationId: string
) {
  if (assetIds.length === 0) {
    return [];
  }

  const results = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        inArray(mediaAssets.id, assetIds),
        eq(mediaAssets.organizationId, organizationId)
      )
    );

  return results;
}

/**
 * Create a new media asset
 */
export async function createAsset(db: DB, asset: NewMediaAsset) {
  const [created] = await db.insert(mediaAssets).values(asset).returning();
  return created;
}

/**
 * Update a media asset
 */
export async function updateAsset(
  db: DB,
  assetId: string,
  organizationId: string,
  updates: Partial<MediaAsset>
) {
  const [updated] = await db
    .update(mediaAssets)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.organizationId, organizationId)
      )
    )
    .returning();

  return updated ?? null;
}

/**
 * Delete a media asset
 */
export async function deleteAsset(
  db: DB,
  assetId: string,
  organizationId: string
) {
  const [deleted] = await db
    .delete(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, assetId),
        eq(mediaAssets.organizationId, organizationId)
      )
    )
    .returning({ id: mediaAssets.id });

  return deleted ?? null;
}

/**
 * Update asset status
 */
export async function updateAssetStatus(
  db: DB,
  assetId: string,
  status: MediaAsset['status'],
  errorMessage?: string
) {
  const [updated] = await db
    .update(mediaAssets)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(mediaAssets.id, assetId))
    .returning();

  return updated ?? null;
}
