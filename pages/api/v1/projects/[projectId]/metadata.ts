import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { shorts } from '@server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getShortFilename } from '@/lib/api/shorts';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const shortIdsParam = req.query.shortIds as string | undefined;
  const db = getDb();

  // Parse shortIds if provided (comma-separated)
  const selectedShortIds = shortIdsParam ? shortIdsParam.split(',').filter(Boolean) : null;

  // Fetch the project to verify ownership
  const { projects } = await import('@server/db/schema');
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project || project.userId !== authResult.userId) {
    return failure(res, 404, 'Project not found');
  }

  // Fetch shorts for this project (filtered by selection if provided)
  const projectShorts = selectedShortIds
    ? await db.select().from(shorts).where(
        and(
          eq(shorts.projectId, projectId),
          inArray(shorts.id, selectedShortIds)
        )
      )
    : await db.select().from(shorts).where(eq(shorts.projectId, projectId));

  // Filter to only completed shorts and transform to requested format
  const metadata = projectShorts
    .filter((short) => short.status === 'completed' && short.outputObjectKey)
    .map((short) => ({
      file: getShortFilename(short),
      social: short.socialContent || {},
      transcription: short.transcriptionSlice,
      timestamps: {
        start: short.startTime,
        end: short.endTime,
      },
    }));

  return success(res, { shorts: metadata });
}
