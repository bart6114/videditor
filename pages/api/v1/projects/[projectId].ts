import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getProjectWithRelations } from '@server/db/queries/projects';
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
  const db = getDb();

  const result = await getProjectWithRelations(db, projectId, authResult.userId);

  if (!result) {
    return failure(res, 404, 'Project not found');
  }

  // Transform thumbnailUrl from object key to presigned URL
  let thumbnailUrl = null;
  if (result.project.thumbnailUrl) {
    try {
      const tigrisClient = createTigrisClient();
      thumbnailUrl = await createPresignedDownload(tigrisClient, result.project.thumbnailUrl, 3600);
    } catch (error) {
      console.error('Failed to generate presigned URL for thumbnail:', result.project.thumbnailUrl, error);
      // Leave thumbnailUrl as null on error
    }
  }

  // Generate presigned URL for video playback
  let videoUrl = null;
  if (result.project.sourceObjectKey) {
    try {
      const tigrisClient = createTigrisClient();
      // Longer expiration for video playback (2 hours)
      videoUrl = await createPresignedDownload(tigrisClient, result.project.sourceObjectKey, 7200);
    } catch (error) {
      console.error('Failed to generate presigned URL for video:', result.project.sourceObjectKey, error);
      // Leave videoUrl as null on error
    }
  }

  return success(res, {
    ...result,
    project: {
      ...result.project,
      thumbnailUrl,
      videoUrl,
    },
  });
}
