import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { getProjectWithRelations } from '@server/db/queries/projects';
import { getJobsByProjectId } from '@server/db/queries/jobs';
import { enqueueJob } from '@/lib/jobs';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { JOB_TYPES, type JobType } from '@shared/index';

const analysisPayloadSchema = z.object({
  shortsCount: z.number().int().min(1).max(10).optional(),
  preferredLength: z.number().int().min(15).max(120).optional(),
  maxLength: z.number().int().min(15).max(120).optional(),
  customPrompt: z.string().optional(),
  avoidExistingOverlap: z.boolean().optional(),
});

const jobRequestSchema = z.object({
  type: z.enum(JOB_TYPES),
  payload: z.record(z.any()).optional(),
}).refine((data) => {
  // Additional validation for analysis jobs
  if (data.type === 'analysis' && data.payload) {
    const result = analysisPayloadSchema.safeParse(data.payload);
    if (!result.success) return false;
    // Ensure maxLength >= preferredLength if both are provided
    if (result.data.preferredLength && result.data.maxLength) {
      return result.data.maxLength >= result.data.preferredLength;
    }
  }
  return true;
}, {
  message: 'Invalid analysis payload: maxLength must be >= preferredLength',
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const db = getDb();

  if (req.method === 'GET') {
    // List all jobs for this project
    const jobs = await getJobsByProjectId(db, projectId);
    return success(res, { jobs });
  }

  if (req.method === 'POST') {
    // Create a new job for this project
    const parsed = jobRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return failure(res, 400, 'Invalid job payload', parsed.error.flatten());
    }

    const project = await getProjectWithRelations(db, projectId, authResult.userId);

    if (!project) {
      return failure(res, 404, 'Project not found');
    }

    const job = await enqueueJob({
      projectId,
      type: parsed.data.type as JobType,
      payload: parsed.data.payload ?? undefined,
    });

    return success(res, { job });
  }

  return failure(res, 405, 'Method not allowed');
}
