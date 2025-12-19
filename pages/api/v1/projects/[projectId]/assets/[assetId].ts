import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getAssetById, deleteAsset } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload, deleteFromTigris } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'DELETE'].includes(req.method || '')) {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const assetId = req.query.assetId as string;
  const db = getDb();

  // Fetch the asset (also verifies ownership via organization)
  const asset = await getAssetById(db, assetId, authResult.organizationId);

  if (!asset) {
    return failure(res, 404, 'Asset not found');
  }

  // Verify project ownership
  if (asset.projectId !== projectId) {
    return failure(res, 404, 'Asset not found');
  }

  // GET - Return asset details with presigned URLs
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

  // Delete from database (cascade handles processing_jobs, scheduled_posts, transcriptions)
  await deleteAsset(db, assetId, authResult.organizationId);

  return success(res, { deleted: true });
}
