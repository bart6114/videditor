import crypto from 'node:crypto';
import { getDb } from '@server/db';
import { processingJobs, type NewProcessingJob } from '@server/db/schema';
import type { JobType } from '@shared/index';

type EnqueueJobInput = {
  projectId?: string;
  shortId?: string;
  type: JobType;
  payload?: Record<string, unknown>;
};

/**
 * Enqueues a job by inserting it into the processing_jobs table.
 * The job worker will pick it up via polling.
 */
export async function enqueueJob(input: EnqueueJobInput) {
  const db = getDb();
  const newJob: NewProcessingJob = {
    id: crypto.randomUUID(),
    projectId: input.projectId ?? null,
    shortId: input.shortId ?? null,
    type: input.type,
    status: 'queued',
    payload: input.payload ?? null,
  };

  const [job] = await db.insert(processingJobs).values(newJob).returning();

  return job;
}
