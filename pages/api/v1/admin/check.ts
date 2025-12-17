import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { success, failure } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { isUserAdmin } from '@server/db/queries/users';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();
  const isAdmin = await isUserAdmin(db, authResult.userId);

  return success(res, { isAdmin });
}
