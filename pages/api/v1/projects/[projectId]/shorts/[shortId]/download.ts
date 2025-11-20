import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { shorts, projects } from '@server/db/schema';
import { eq, and } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const shortId = req.query.shortId as string;
  const db = getDb();

  // Fetch the project to verify ownership
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  if (!project || project.userId !== authResult.userId) {
    return failure(res, 404, 'Project not found');
  }

  // Fetch the short
  const [short] = await db
    .select()
    .from(shorts)
    .where(and(eq(shorts.id, shortId), eq(shorts.projectId, projectId)))
    .limit(1);

  if (!short) {
    return failure(res, 404, 'Short not found');
  }

  if (short.status !== 'completed' || !short.outputObjectKey) {
    return failure(res, 400, 'Short is not ready for download');
  }

  // Generate presigned download URL
  try {
    const tigrisClient = createTigrisClient();
    const filename = `${short.title || 'short'}.mp4`;
    const downloadUrl = await createPresignedDownload(tigrisClient, short.outputObjectKey, 3600, filename);

    return success(res, {
      downloadUrl,
      filename: short.title || 'short',
    });
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    return failure(res, 500, 'Failed to generate download URL');
  }
}
