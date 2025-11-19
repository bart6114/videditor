import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getProjectWithRelations } from '@server/db/queries/projects';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

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

  return success(res, result);
}
