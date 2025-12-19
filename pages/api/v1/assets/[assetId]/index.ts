import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { getAssetById, updateAsset, deleteAsset } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload, deleteFromTigris } from '@/lib/tigris';

const updateAssetSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  socialContent: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method || '')) {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const assetId = req.query.assetId as string;
  const db = getDb();

  // Fetch the asset (verifies ownership via organization)
  const asset = await getAssetById(db, assetId, authResult.organizationId);
  if (!asset) {
    return failure(res, 404, 'Asset not found');
  }

  // GET - Get single asset with presigned URLs
  if (req.method === 'GET') {
    const tigrisClient = createTigrisClient();
    let presignedThumbnailUrl = null;
    let presignedVideoUrl = null;

    if (asset.thumbnailUrl) {
      try {
        presignedThumbnailUrl = await createPresignedDownload(
          tigrisClient,
          asset.thumbnailUrl,
          3600,
          undefined,
          'image/jpeg'
        );
      } catch (error) {
        console.error('Failed to generate presigned URL for asset thumbnail:', asset.thumbnailUrl, error);
      }
    }

    if (asset.sourceObjectKey) {
      try {
        presignedVideoUrl = await createPresignedDownload(tigrisClient, asset.sourceObjectKey, 7200);
      } catch (error) {
        console.error('Failed to generate presigned URL for asset video:', asset.sourceObjectKey, error);
      }
    }

    return success(res, {
      asset: {
        ...asset,
        thumbnailUrl: presignedThumbnailUrl,
        videoUrl: presignedVideoUrl,
      },
    });
  }

  // PATCH - Update asset (title, socialContent, metadata)
  if (req.method === 'PATCH') {
    const parseResult = updateAssetSchema.safeParse(req.body);
    if (!parseResult.success) {
      return failure(res, 400, parseResult.error.errors[0].message);
    }

    const updates = parseResult.data;

    // Only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.socialContent !== undefined) updateData.socialContent = updates.socialContent;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    if (Object.keys(updateData).length === 0) {
      return failure(res, 400, 'No fields to update');
    }

    const updated = await updateAsset(db, assetId, authResult.organizationId, updateData);

    // Generate presigned URLs for the response
    const tigrisClient = createTigrisClient();
    let presignedThumbnailUrl = updated?.thumbnailUrl || null;
    let presignedVideoUrl = null;

    if (updated?.thumbnailUrl) {
      try {
        presignedThumbnailUrl = await createPresignedDownload(
          tigrisClient,
          updated.thumbnailUrl,
          3600,
          undefined,
          'image/jpeg'
        );
      } catch (error) {
        console.error('Failed to generate presigned URL for asset thumbnail:', updated.thumbnailUrl, error);
      }
    }

    if (updated?.sourceObjectKey) {
      try {
        presignedVideoUrl = await createPresignedDownload(tigrisClient, updated.sourceObjectKey, 7200);
      } catch (error) {
        console.error('Failed to generate presigned URL for asset video:', updated.sourceObjectKey, error);
      }
    }

    return success(res, {
      asset: {
        ...updated,
        thumbnailUrl: presignedThumbnailUrl,
        videoUrl: presignedVideoUrl,
      },
    });
  }

  // DELETE - Remove asset and associated files
  const tigrisClient = createTigrisClient();
  const deletePromises: Promise<void>[] = [];

  // Collect all object keys to delete
  if (asset.sourceObjectKey) {
    deletePromises.push(deleteFromTigris(tigrisClient, asset.sourceObjectKey));
  }
  if (asset.thumbnailUrl) {
    deletePromises.push(deleteFromTigris(tigrisClient, asset.thumbnailUrl));
  }

  // Delete all assets from Tigris (ignore errors for missing files)
  await Promise.allSettled(deletePromises);

  // Delete from database (cascade handles related records)
  await deleteAsset(db, assetId, authResult.organizationId);

  return success(res, { deleted: true });
}
