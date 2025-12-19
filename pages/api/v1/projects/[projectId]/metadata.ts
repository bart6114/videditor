import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { mediaAssets } from '@server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getAssetFilename } from '@/lib/api/shorts';
import type { ShortFormMetadata } from '@shared/index';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const shortIdsParam = req.query.shortIds as string | undefined;
  const db = getDb();

  // Parse shortIds if provided (comma-separated)
  const selectedShortIds = shortIdsParam ? shortIdsParam.split(',').filter(Boolean) : null;

  // Fetch the project to verify ownership
  const { projects } = await import('@server/db/schema');
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project || project.organizationId !== authResult.organizationId) {
    return failure(res, 404, 'Project not found');
  }

  // Fetch short-form assets for this project (filtered by selection if provided)
  const projectShorts = selectedShortIds
    ? await db.select().from(mediaAssets).where(
        and(
          eq(mediaAssets.projectId, projectId),
          eq(mediaAssets.assetType, 'short_form'),
          inArray(mediaAssets.id, selectedShortIds)
        )
      )
    : await db.select().from(mediaAssets).where(
        and(
          eq(mediaAssets.projectId, projectId),
          eq(mediaAssets.assetType, 'short_form')
        )
      );

  // Filter to only completed shorts and transform to requested format
  const metadata = projectShorts
    .filter((asset) => asset.status === 'completed' && asset.sourceObjectKey)
    .map((asset) => {
      const shortMeta = asset.metadata as ShortFormMetadata | null;
      return {
        file: getAssetFilename(asset),
        social: asset.socialContent || {},
        transcription: shortMeta?.transcriptionSlice || asset.title,
        timestamps: {
          start: shortMeta?.startTime ?? 0,
          end: shortMeta?.endTime ?? 0,
        },
      };
    });

  return success(res, { shorts: metadata });
}
