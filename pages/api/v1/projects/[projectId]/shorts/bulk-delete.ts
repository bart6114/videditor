import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getAssetsByIds, deleteAsset } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, deleteFromTigris } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { shortIds } = req.body as { shortIds: string[] };

  if (!Array.isArray(shortIds) || shortIds.length === 0) {
    return failure(res, 400, 'shortIds must be a non-empty array');
  }

  const db = getDb();

  // Fetch the assets (also verifies ownership via organization)
  const assets = await getAssetsByIds(db, shortIds, authResult.organizationId);

  // Filter to only short_form assets
  const assetsToDelete = assets.filter(asset => asset.assetType === 'short_form');

  if (assetsToDelete.length === 0) {
    return failure(res, 404, 'No shorts found or you do not have permission');
  }

  const tigrisClient = createTigrisClient();
  const deletePromises: Promise<void>[] = [];

  // Collect all object keys to delete from S3
  for (const asset of assetsToDelete) {
    if (asset.sourceObjectKey) {
      deletePromises.push(deleteFromTigris(tigrisClient, asset.sourceObjectKey));
    }
    if (asset.thumbnailUrl) {
      deletePromises.push(deleteFromTigris(tigrisClient, asset.thumbnailUrl));
    }
  }

  // Delete all assets from Tigris (ignore errors for missing files)
  await Promise.allSettled(deletePromises);

  // Delete from database (cascade handles processing_jobs)
  const deletedIds: string[] = [];
  for (const asset of assetsToDelete) {
    const deleted = await deleteAsset(db, asset.id, authResult.organizationId);
    if (deleted) {
      deletedIds.push(deleted.id);
    }
  }

  return success(res, {
    deleted: deletedIds.length,
    shortIds: deletedIds,
  });
}
