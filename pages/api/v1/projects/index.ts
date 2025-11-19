import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { listUserProjects } from '@server/db/queries/projects';
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

  const db = getDb();
  const projects = await listUserProjects(db, authResult.userId);

  // Transform thumbnailUrl from object key to presigned URL
  const tigrisClient = createTigrisClient();
  const projectsWithPresignedUrls = await Promise.all(
    projects.map(async (project) => {
      let thumbnailUrl = null;

      if (project.thumbnailUrl) {
        try {
          thumbnailUrl = await createPresignedDownload(tigrisClient, project.thumbnailUrl, 3600);
        } catch (error) {
          console.error('Failed to generate presigned URL for thumbnail:', project.thumbnailUrl, error);
          // Leave thumbnailUrl as null on error
        }
      }

      return {
        ...project,
        thumbnailUrl,
      };
    })
  );

  return success(res, { projects: projectsWithPresignedUrls });
}
