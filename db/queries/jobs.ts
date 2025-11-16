import { eq, and } from 'drizzle-orm';
import type { DB } from '../index';
import { processingJobs, type NewProcessingJob, type ProcessingJob } from '../schema';

/**
 * Get processing jobs by project ID
 */
export async function getJobsByProjectId(db: DB, projectId: string) {
  return db.select().from(processingJobs).where(eq(processingJobs.projectId, projectId)).all();
}

/**
 * Get job by ID and project ID
 */
export async function getJobById(db: DB, jobId: string, projectId: string) {
  return db
    .select()
    .from(processingJobs)
    .where(and(eq(processingJobs.id, jobId), eq(processingJobs.projectId, projectId)))
    .get();
}

/**
 * Create processing job
 */
export async function createJob(db: DB, job: NewProcessingJob) {
  return db.insert(processingJobs).values(job).run();
}

/**
 * Update job status and progress
 */
export async function updateJobStatus(
  db: DB,
  jobId: string,
  status: ProcessingJob['status'],
  progress?: number,
  errorMessage?: string
) {
  return db
    .update(processingJobs)
    .set({
      status,
      progress: progress ?? undefined,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(processingJobs.id, jobId))
    .run();
}

/**
 * Update job metadata
 */
export async function updateJobMetadata(db: DB, jobId: string, metadata: Record<string, any>) {
  return db
    .update(processingJobs)
    .set({
      metadata: JSON.stringify(metadata),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(processingJobs.id, jobId))
    .run();
}

/**
 * Delete job
 */
export async function deleteJob(db: DB, jobId: string) {
  return db.delete(processingJobs).where(eq(processingJobs.id, jobId)).run();
}
