import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { projects, mediaAssets } from '@server/db/schema';
import type { UploadCompletePayload } from '@shared/index';
import { enqueueJob } from '@/lib/jobs';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { and, eq } from 'drizzle-orm';

const uploadCompleteSchema = z.object({
  projectId: z.string().uuid(),
  mediaAssetId: z.string().uuid().optional(), // New: link to media asset
  durationSeconds: z.number().positive().optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const parsed = uploadCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 400, 'Invalid completion payload', parsed.error.flatten());
  }

  const payload = parsed.data;
  const db = getDb();

  // Update project status
  const [project] = await db
    .update(projects)
    .set({
      status: 'queued',
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, payload.projectId), eq(projects.organizationId, authResult.organizationId)))
    .returning();

  if (!project) {
    return failure(res, 404, 'Project not found');
  }

  // If mediaAssetId provided, update the media asset
  let mediaAsset = null;
  if (payload.mediaAssetId) {
    const [updated] = await db
      .update(mediaAssets)
      .set({
        durationSeconds: payload.durationSeconds ?? null,
        fileSizeBytes: payload.fileSizeBytes ?? null,
        status: 'processing', // Will be set to 'ready' for short_form after this
        updatedAt: new Date(),
      })
      .where(and(eq(mediaAssets.id, payload.mediaAssetId), eq(mediaAssets.projectId, payload.projectId)))
      .returning();

    mediaAsset = updated;

    if (!mediaAsset) {
      return failure(res, 404, 'Media asset not found');
    }

    // For short_form assets, mark as ready (no processing pipeline)
    if (mediaAsset.assetType === 'short_form') {
      await db
        .update(mediaAssets)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(eq(mediaAssets.id, payload.mediaAssetId));

      return success(res, {
        projectId: project.id,
        mediaAssetId: mediaAsset.id,
        status: 'ready',
      });
    }
  }

  // For long_form assets, enqueue processing
  if (!mediaAsset) {
    return failure(res, 400, 'mediaAssetId is required for long_form uploads');
  }
  const sourceObjectKey = mediaAsset.sourceObjectKey;
  const sourceBucket = mediaAsset.sourceBucket;

  await enqueueJob({
    projectId: project.id,
    mediaAssetId: payload.mediaAssetId,
    type: 'thumbnail',
    payload: {
      projectId: project.id,
      mediaAssetId: payload.mediaAssetId,
      sourceObjectKey,
      sourceBucket,
      organizationId: authResult.organizationId,
    },
  });

  return success(res, {
    projectId: project.id,
    mediaAssetId: payload.mediaAssetId,
    status: project.status,
  });
}
