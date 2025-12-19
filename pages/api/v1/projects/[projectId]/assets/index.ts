import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getDb } from '@server/db';
import { getProjectById } from '@server/db/queries/projects';
import { listProjectAssets, createAsset } from '@server/db/queries/assets';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload } from '@/lib/tigris';

const createAssetSchema = z.object({
  assetType: z.enum(['long_form', 'short_form']),
  title: z.string().min(1).max(255),
  sourceObjectKey: z.string().min(1),
  sourceBucket: z.string().min(1),
  sourceAssetId: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  socialContent: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const db = getDb();

  // Verify project exists and belongs to organization
  const project = await getProjectById(db, projectId, authResult.organizationId);
  if (!project) {
    return failure(res, 404, 'Project not found');
  }

  // GET - List assets for project
  if (req.method === 'GET') {
    const typeFilter = req.query.type as 'long_form' | 'short_form' | undefined;

    if (typeFilter && !['long_form', 'short_form'].includes(typeFilter)) {
      return failure(res, 400, 'Invalid type filter. Must be "long_form" or "short_form"');
    }

    const assets = await listProjectAssets(db, projectId, authResult.organizationId, typeFilter);

    // Generate presigned URLs for thumbnails and videos
    const tigrisClient = createTigrisClient();
    const assetsWithUrls = await Promise.all(
      assets.map(async (asset) => {
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

        return {
          ...asset,
          thumbnailUrl: presignedThumbnailUrl,
          videoUrl: presignedVideoUrl,
        };
      })
    );

    return success(res, { assets: assetsWithUrls });
  }

  // POST - Create new asset
  const parseResult = createAssetSchema.safeParse(req.body);
  if (!parseResult.success) {
    return failure(res, 400, parseResult.error.errors[0].message);
  }

  const data = parseResult.data;

  const asset = await createAsset(db, {
    id: crypto.randomUUID(),
    projectId,
    organizationId: authResult.organizationId,
    createdById: authResult.userId,
    assetType: data.assetType,
    title: data.title,
    sourceObjectKey: data.sourceObjectKey,
    sourceBucket: data.sourceBucket,
    sourceAssetId: data.sourceAssetId ?? null,
    durationSeconds: data.durationSeconds ?? null,
    fileSizeBytes: data.fileSizeBytes ?? null,
    socialContent: data.socialContent ?? null,
    metadata: data.metadata ?? null,
    status: data.assetType === 'short_form' ? 'ready' : 'uploading',
  });

  return success(res, { asset }, 201);
}
