import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@server/db';
import { projects, mediaAssets } from '@server/db/schema';
import { createPresignedUpload, createTigrisClient } from '@/lib/tigris';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  fileSizeBytes: z.number().int().positive().optional(),
  projectId: z.string().optional(), // Add to existing project
  assetType: z.enum(['long_form', 'short_form']).default('long_form'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const parsed = uploadRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return failure(res, 400, 'Invalid upload payload', parsed.error.flatten());
  }

  const payload = parsed.data;
  const db = getDb();
  const tigrisClient = createTigrisClient();

  let projectId = payload.projectId;
  let isNewProject = false;

  // If projectId provided, verify it exists and belongs to org
  if (projectId) {
    const existingProject = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });
    if (!existingProject || existingProject.organizationId !== authResult.organizationId) {
      return failure(res, 404, 'Project not found');
    }
  } else {
    // Create new project
    projectId = crypto.randomUUID();
    isNewProject = true;
  }

  const mediaAssetId = crypto.randomUUID();

  const presigned = await createPresignedUpload(tigrisClient, {
    filename: payload.filename,
    contentType: payload.contentType,
    userId: authResult.organizationId, // Use org ID for storage path
    projectId,
  });

  // Create project if new
  if (isNewProject) {
    await db.insert(projects).values({
      id: projectId,
      organizationId: authResult.organizationId,
      createdById: authResult.userId,
      title: payload.filename,
      // Note: source video data is stored in media_assets table, not projects
    });
  }

  // Create media asset
  await db.insert(mediaAssets).values({
    id: mediaAssetId,
    projectId,
    organizationId: authResult.organizationId,
    createdById: authResult.userId,
    assetType: payload.assetType,
    title: payload.filename,
    sourceObjectKey: presigned.objectKey,
    sourceBucket: presigned.bucket,
    fileSizeBytes: payload.fileSizeBytes ?? null,
    status: 'uploading',
    metadata: {
      filename: payload.filename,
      contentType: payload.contentType,
    },
  });

  return success(res, {
    projectId,
    mediaAssetId,
    objectKey: presigned.objectKey,
    uploadUrl: presigned.uploadUrl,
    bucket: presigned.bucket,
    contentType: payload.contentType,
  });
}
