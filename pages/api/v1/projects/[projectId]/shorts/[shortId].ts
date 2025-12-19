import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getAssetById, updateAsset, deleteAsset } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload, deleteFromTigris } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const shortId = req.query.shortId as string;
  const projectId = req.query.projectId as string;
  const db = getDb();

  // Fetch the asset (also verifies ownership via organization)
  const asset = await getAssetById(db, shortId, authResult.organizationId);

  if (!asset || asset.assetType !== 'short_form') {
    return failure(res, 404, 'Short not found');
  }

  // Verify project ownership
  if (asset.projectId !== projectId) {
    return failure(res, 404, 'Short not found');
  }

  // PATCH: Update social content
  if (req.method === 'PATCH') {
    const { socialContent } = req.body;
    const updated = await updateAsset(db, shortId, authResult.organizationId, { socialContent });

    // Generate presigned URL for thumbnailUrl if it exists
    let presignedThumbnailUrl = updated?.thumbnailUrl || null;
    if (updated?.thumbnailUrl) {
      try {
        const tigrisClient = createTigrisClient();
        presignedThumbnailUrl = await createPresignedDownload(tigrisClient, updated.thumbnailUrl, 3600, undefined, 'image/jpeg');
      } catch (error) {
        console.error('Failed to generate presigned URL for thumbnail:', updated.thumbnailUrl, error);
      }
    }

    return success(res, {
      short: {
        ...updated,
        thumbnailUrl: presignedThumbnailUrl,
      },
    });
  }

  // DELETE: Remove short and associated files
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

  // Delete from database (cascade handles processing_jobs)
  await deleteAsset(db, shortId, authResult.organizationId);

  return success(res, { deleted: true });
}
