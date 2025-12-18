import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, processingJobs } from '@server/db';
import { count, inArray } from 'drizzle-orm';

/**
 * GET /api/v1/metrics
 *
 * Prometheus-formatted metrics endpoint for Fly.io autoscaler.
 * Returns count of jobs that need processing (queued + running).
 *
 * No authentication required - only exposes aggregate counts.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).end('Method not allowed');
  }

  try {
    const db = getDb();
    const [result] = await db
      .select({ count: count() })
      .from(processingJobs)
      .where(inArray(processingJobs.status, ['queued', 'running']));

    const jobCount = result?.count ?? 0;

    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(
      `# HELP videditor_jobs_running_and_queued Number of jobs running or queued
# TYPE videditor_jobs_running_and_queued gauge
videditor_jobs_running_and_queued ${jobCount}
`
    );
  } catch (error) {
    console.error('Failed to fetch job metrics:', error);
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.status(200).send(
      `# HELP videditor_jobs_running_and_queued Number of jobs running or queued
# TYPE videditor_jobs_running_and_queued gauge
videditor_jobs_running_and_queued 0
`
    );
  }
}
