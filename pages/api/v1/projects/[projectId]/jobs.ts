import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { getProjectWithRelations } from '@server/db/queries/projects';
import { getJobsByProjectId } from '@server/db/queries/jobs';
import { enqueueJob } from '@/lib/jobs';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { JOB_TYPES, SOCIAL_PLATFORMS, type JobType } from '@shared/index';
import {
  getUserCredits,
  deductCredits,
  calculateJobCost,
  getUserCreditInfo,
} from '@/lib/credits';
import { triggerAutoTopUpIfNeeded } from '@/lib/credits/auto-topup';

const analysisPayloadSchema = z.object({
  mediaAssetId: z.string().uuid(),
  shortsCount: z.number().int().min(1).max(15).optional(),
  preferredLength: z.number().int().min(15).max(120).optional(),
  maxLength: z.number().int().min(15).max(120).optional(),
  customPrompt: z.string().optional(),
  customSocialPrompt: z.string().optional(),
  avoidExistingOverlap: z.boolean().optional(),
  socialPlatforms: z.array(z.enum(SOCIAL_PLATFORMS)).optional(),
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

    const project = await getProjectWithRelations(db, projectId, authResult.organizationId);

    if (!project) {
      return failure(res, 404, 'Project not found');
    }

    // Check and deduct credits for analysis jobs
    if (parsed.data.type === 'analysis') {
      const payload = parsed.data.payload as { shortsCount?: number; socialPlatforms?: string[] } | undefined;
      const creditCost = calculateJobCost('analysis', payload);

      if (creditCost > 0) {
        // Check balance
        const currentCredits = await getUserCredits(db, authResult.organizationId);

        if (currentCredits < creditCost) {
          return failure(res, 402, 'Insufficient credits', {
            required: creditCost,
            available: currentCredits,
            message: `You need ${creditCost} credit${creditCost !== 1 ? 's' : ''} to generate ${payload?.shortsCount ?? 3} short${(payload?.shortsCount ?? 3) !== 1 ? 's' : ''}`,
          });
        }

        // Deduct credits
        const transaction = await deductCredits(db, authResult.organizationId, creditCost, {
          projectId,
          shortsCount: payload?.shortsCount ?? 3,
          description: `Generated ${payload?.shortsCount ?? 3} short${(payload?.shortsCount ?? 3) !== 1 ? 's' : ''} for project`,
          performedById: authResult.userId,
        });

        if (!transaction) {
          return failure(res, 402, 'Insufficient credits');
        }

        // Trigger auto top-up check (async, don't block the response)
        triggerAutoTopUpIfNeeded(db, authResult.organizationId).catch((err) => {
          console.error('Auto top-up error:', err);
        });
      }
    }

    const job = await enqueueJob({
      projectId,
      mediaAssetId: (parsed.data.payload as { mediaAssetId?: string })?.mediaAssetId,
      type: parsed.data.type as JobType,
      payload: parsed.data.payload ?? undefined,
    });

    return success(res, { job });
  }

  return failure(res, 405, 'Method not allowed');
}
