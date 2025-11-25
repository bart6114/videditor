import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { setUserDefaultOrganization } from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return failure(res, 400, 'Organization ID is required');
  }

  const db = getDb();
  const result = await setUserDefaultOrganization(db, authResult.userId, id);

  if (!result.success) {
    return failure(res, 400, result.error);
  }

  return success(res, { message: 'Organization switched successfully' });
}
