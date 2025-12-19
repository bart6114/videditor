import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { getProjectWithRelations, deleteProject, updateProject } from '@server/db/queries/projects';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload, deleteFromTigris } from '@/lib/tigris';
import { mediaAssetToShort } from '@/lib/transforms/mediaAssetToShort';

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

    // Collect all object keys to delete
    if (result.project.sourceObjectKey) {
      deletePromises.push(deleteFromTigris(tigrisClient, result.project.sourceObjectKey));
    }
    if (result.project.thumbnailUrl) {
      deletePromises.push(deleteFromTigris(tigrisClient, result.project.thumbnailUrl));
    }

    // Delete all shorts' videos and thumbnails
    for (const short of result.shorts) {
      if (short.outputObjectKey) {
        deletePromises.push(deleteFromTigris(tigrisClient, short.outputObjectKey));
      }
      if (short.thumbnailUrl) {
        deletePromises.push(deleteFromTigris(tigrisClient, short.thumbnailUrl));
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

  // Transform thumbnailUrl from object key to presigned URL
  let thumbnailUrl = null;
  if (result.project.thumbnailUrl) {
    try {
      const tigrisClient = createTigrisClient();
      thumbnailUrl = await createPresignedDownload(tigrisClient, result.project.thumbnailUrl, 3600, undefined, 'image/jpeg');
    } catch (error) {
      console.error('Failed to generate presigned URL for thumbnail:', result.project.thumbnailUrl, error);
      // Leave thumbnailUrl as null on error
    }
  }

  // Generate presigned URL for video playback
  let videoUrl = null;
  if (result.project.sourceObjectKey) {
    try {
      const tigrisClient = createTigrisClient();
      // Longer expiration for video playback (2 hours)
      videoUrl = await createPresignedDownload(tigrisClient, result.project.sourceObjectKey, 7200);
    } catch (error) {
      console.error('Failed to generate presigned URL for video:', result.project.sourceObjectKey, error);
      // Leave videoUrl as null on error
    }
  }

  // NOTE: shorts table query is deprecated but kept for backward compat during deletion
  // Shorts are now derived from shortFormAssets via mediaAssetToShort transform

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

  // Filter short form assets for convenience arrays
  const shortFormAssetsWithUrls = mediaAssetsWithUrls.filter(a => a.assetType === 'short_form');

  // Derive shorts from shortFormAssets for backward compatibility
  // This replaces the deprecated shorts table query
  const shorts = shortFormAssetsWithUrls.map(asset => mediaAssetToShort(asset));

  return success(res, {
    ...result,
    project: {
      ...result.project,
      thumbnailUrl,
      videoUrl,
    },
    mediaAssets: mediaAssetsWithUrls,
    longFormAssets: mediaAssetsWithUrls.filter(a => a.assetType === 'long_form'),
    shortFormAssets: shortFormAssetsWithUrls,
    shorts,
  });
}
