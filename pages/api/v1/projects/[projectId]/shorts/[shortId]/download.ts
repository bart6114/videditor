import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getAssetById } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload } from '@/lib/tigris';
import { getAssetFilename } from '@/lib/api/shorts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const shortId = req.query.shortId as string;
  const db = getDb();

  // Fetch the asset (organization verified)
  const asset = await getAssetById(db, shortId, authResult.organizationId);

  if (!asset) {
    return failure(res, 404, 'Short not found');
  }

  // Verify this is a short_form asset and belongs to the correct project
  if (asset.assetType !== 'short_form' || asset.projectId !== projectId) {
    return failure(res, 404, 'Short not found');
  }

  if (asset.status !== 'completed' || !asset.sourceObjectKey) {
    return failure(res, 400, 'Short is not ready for download');
  }

  // Generate presigned download URL
  try {
    const tigrisClient = createTigrisClient();
    const filename = getAssetFilename(asset);
    const downloadUrl = await createPresignedDownload(tigrisClient, asset.sourceObjectKey, 3600, filename);

    // Return filename without extension for backward compatibility
    const basenameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    return success(res, {
      downloadUrl,
      filename: basenameWithoutExt,
    });
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return failure(res, 500, 'Failed to generate download URL');
  }
}
