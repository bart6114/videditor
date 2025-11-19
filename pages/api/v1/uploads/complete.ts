import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { projects } from '@server/db/schema';
import type { UploadCompletePayload } from '@shared/index';
import { enqueueJob } from '@/lib/jobs';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { and, eq } from 'drizzle-orm';

const uploadCompleteSchema = z.object({
  projectId: z.string().uuid(),
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

  const payload: UploadCompletePayload = parsed.data;
  const db = getDb();

  const [project] = await db
    .update(projects)
    .set({
      status: 'ready',
      durationSeconds: payload.durationSeconds ?? null,
      fileSizeBytes: payload.fileSizeBytes ?? null,
      metadata: payload.metadata ?? undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, payload.projectId), eq(projects.userId, authResult.userId)))
    .returning();

  if (!project) {
    return failure(res, 404, 'Project not found');
  }

  await enqueueJob({
    projectId: project.id,
    type: 'transcription',
    payload: {
      projectId: project.id,
      sourceObjectKey: project.sourceObjectKey,
      sourceBucket: project.sourceBucket,
    },
  });

  return success(res, { projectId: project.id, status: project.status });
}
