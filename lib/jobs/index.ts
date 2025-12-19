import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '@server/db';
import { processingJobs, projectMachineAffinity, type NewProcessingJob } from '@server/db/schema';
import type { JobType } from '@shared/index';

type EnqueueJobInput = {
  projectId?: string;
  shortId?: string;
  mediaAssetId?: string;
  type: JobType;
  payload?: Record<string, unknown>;
};

/**
 * Enqueues a job by inserting it into the processing_jobs table.
 * The job worker will pick it up via polling.
 *
 * If the project has a machine affinity (a machine that recently processed it),
 * sets preferred_machine_id to route the job to that machine for cache optimization.
 */
export async function enqueueJob(input: EnqueueJobInput) {
  const db = getDb();

  // Look up preferred machine from affinity table
  let preferredMachineId: string | null = null;

  if (input.projectId) {
    const [affinity] = await db
      .select({ machineId: projectMachineAffinity.machineId })
      .from(projectMachineAffinity)
      .where(eq(projectMachineAffinity.projectId, input.projectId))
      .limit(1);

    preferredMachineId = affinity?.machineId ?? null;
  }

  const newJob: NewProcessingJob = {
    id: crypto.randomUUID(),
    projectId: input.projectId ?? null,
    shortId: input.shortId ?? null,
    mediaAssetId: input.mediaAssetId ?? null,
    type: input.type,
    status: 'queued',
    payload: input.payload ?? null,
    preferredMachineId,
  };

  const [job] = await db.insert(processingJobs).values(newJob).returning();

  return job;
}
