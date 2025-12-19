import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { listOrganizationProjects, createProject } from '@server/db/queries/projects';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, createPresignedDownload } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  // POST - Create a new empty project
  if (req.method === 'POST') {
    const schema = z.object({
      title: z.string().min(1, 'Title is required').max(255, 'Title must be 255 characters or less'),
    });

    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      return failure(res, 400, parseResult.error.errors[0].message);
    }

    const project = await createProject(db, {
      id: crypto.randomUUID(),
      organizationId: authResult.organizationId,
      createdById: authResult.userId,
      title: parseResult.data.title.trim(),
      status: 'ready', // Empty project is ready to receive content
    });

    return success(res, { project }, 201);
  }

  // GET - List all projects
  const projects = await listOrganizationProjects(db, authResult.organizationId);

  // Transform thumbnailUrl from object key to presigned URL
  const tigrisClient = createTigrisClient();
  const projectsWithPresignedUrls = await Promise.all(
    projects.map(async (project) => {
      let thumbnailUrl = null;

      if (project.thumbnailUrl) {
        try {
          thumbnailUrl = await createPresignedDownload(tigrisClient, project.thumbnailUrl, 3600, undefined, 'image/jpeg');
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
