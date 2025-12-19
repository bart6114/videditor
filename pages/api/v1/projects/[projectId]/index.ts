import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { getProjectWithRelations, deleteProject, updateProject } from '@server/db/queries/projects';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload, deleteFromTigris } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'DELETE', 'PATCH'].includes(req.method || '')) {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const db = getDb();

  // DELETE - Delete project and all its assets
  if (req.method === 'DELETE') {
    const result = await getProjectWithRelations(db, projectId, authResult.organizationId);

    if (!result) {
      return failure(res, 404, 'Project not found');
    }

    const tigrisClient = createTigrisClient();
    const deletePromises: Promise<void>[] = [];

    // Delete all media assets from Tigris
    for (const asset of result.mediaAssets) {
      if (asset.sourceObjectKey) {
        deletePromises.push(deleteFromTigris(tigrisClient, asset.sourceObjectKey));
      }
      if (asset.thumbnailUrl) {
        deletePromises.push(deleteFromTigris(tigrisClient, asset.thumbnailUrl));
      }
    }

    // Delete all assets from Tigris (ignore errors for missing files)
    await Promise.allSettled(deletePromises);

    // Delete from database (cascade handles all relations)
    await deleteProject(db, projectId, authResult.organizationId);

    return success(res, { deleted: true });
  }

  // PATCH - Update project (rename)
  if (req.method === 'PATCH') {
    const schema = z.object({
      title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less'),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return failure(res, 400, parseResult.error.errors[0].message);
    }

    const updated = await updateProject(db, projectId, authResult.organizationId, {
      title: parseResult.data.title,
    });

    if (!updated) {
      return failure(res, 404, 'Project not found');
    }

    return success(res, { project: updated });
  }

  // GET - Get project with relations
  const result = await getProjectWithRelations(db, projectId, authResult.organizationId);

  if (!result) {
    return failure(res, 404, 'Project not found');
  }

  // NOTE: Project-level thumbnailUrl/videoUrl are deprecated
  // Video playback now uses media assets (long_form/short_form)
  // Shorts are derived from shortFormAssets via mediaAssetToShort transform

  // Generate presigned URLs for media assets
  const tigrisClient = createTigrisClient();
  const mediaAssetsWithUrls = await Promise.all(
    result.mediaAssets.map(async (asset) => {
      let presignedThumbnailUrl = null;
      let presignedVideoUrl = null;

      if (asset.thumbnailUrl) {
        try {
          presignedThumbnailUrl = await createPresignedDownload(tigrisClient, asset.thumbnailUrl, 3600, undefined, 'image/jpeg');
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

      return {
        ...asset,
        thumbnailUrl: presignedThumbnailUrl,
        videoUrl: presignedVideoUrl,
      };
    })
  );

  // Filter by asset type for convenience arrays
  const longFormAssets = mediaAssetsWithUrls.filter(a => a.assetType === 'long_form');
  const shortFormAssets = mediaAssetsWithUrls.filter(a => a.assetType === 'short_form');

  return success(res, {
    ...result,
    project: result.project,
    mediaAssets: mediaAssetsWithUrls,
    longFormAssets,
    shortFormAssets,
    // shorts is an alias for shortFormAssets for backward compatibility
    shorts: shortFormAssets,
  });
}
