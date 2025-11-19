import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getDb } from '@server/db';
import { projects } from '@server/db/schema';
import { createPresignedUpload, createTigrisClient } from '@/lib/tigris';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

const uploadRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().default('application/octet-stream'),
  fileSizeBytes: z.number().int().positive().optional(),
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

  const presigned = await createPresignedUpload(tigrisClient, {
    filename: payload.filename,
    contentType: payload.contentType,
    userId: authResult.userId,
  });

  const [project] = await db
    .insert(projects)
    .values({
      id: crypto.randomUUID(),
      userId: authResult.userId,
      title: payload.filename,
      sourceObjectKey: presigned.objectKey,
      sourceBucket: presigned.bucket,
      fileSizeBytes: payload.fileSizeBytes ?? null,
      metadata: {
        filename: payload.filename,
        contentType: payload.contentType,
      },
    })
    .returning();

  return success(res, {
    projectId: project.id,
    objectKey: presigned.objectKey,
    uploadUrl: presigned.uploadUrl,
    bucket: presigned.bucket,
    contentType: payload.contentType,
  });
}
