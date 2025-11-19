import { eq, and } from 'drizzle-orm';
import type { DB } from '../index';
import { processingJobs, type NewProcessingJob, type ProcessingJob } from '../schema';

/**
 * Get processing jobs by project ID
 */
export async function getJobsByProjectId(db: DB, projectId: string) {
  return db.select().from(processingJobs).where(eq(processingJobs.projectId, projectId));
}

/**
 * Get job by ID and project ID
 */
export async function getJobById(db: DB, jobId: string, projectId: string) {
  const [job] = await db
    .select()
    .from(processingJobs)
    .where(and(eq(processingJobs.id, jobId), eq(processingJobs.projectId, projectId)))
    .limit(1);
  return job ?? null;
}

/**
 * Create processing job
 */
export async function createJob(db: DB, job: NewProcessingJob) {
  const [created] = await db.insert(processingJobs).values(job).returning();
  return created;
}

/**
 * Update job status
 */
export async function updateJobStatus(
  db: DB,
  jobId: string,
  status: ProcessingJob['status'],
  errorMessage?: string
) {
  const now = new Date();
  const updatePayload: Partial<ProcessingJob> = {
    status,
    updatedAt: now,
  };

  if (errorMessage !== undefined) {
    updatePayload.errorMessage = errorMessage ?? null;
  }

  if (status === 'running') {
    updatePayload.startedAt = now;
  }

  if (['succeeded', 'failed', 'canceled'].includes(status)) {
    updatePayload.completedAt = now;
  }

  const [updated] = await db
    .update(processingJobs)
    .set(updatePayload)
    .where(eq(processingJobs.id, jobId))
    .returning();

  return updated ?? null;
}

/**
 * Update job metadata
 */
export async function updateJobMetadata(db: DB, jobId: string, metadata: Record<string, unknown>) {
  const [updated] = await db
    .update(processingJobs)
    .set({
      payload: metadata,
      updatedAt: new Date(),
    })
    .where(eq(processingJobs.id, jobId))
    .returning();
  return updated ?? null;
}

/**
 * Delete job
 */
export async function deleteJob(db: DB, jobId: string) {
  const [deleted] = await db.delete(processingJobs).where(eq(processingJobs.id, jobId)).returning({
    id: processingJobs.id,
  });
  return deleted ?? null;
}
