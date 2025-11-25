import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  getOrganizationMembers,
  isUserMemberOfOrganization,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  // Verify user is a member
  const isMember = await isUserMemberOfOrganization(db, authResult.userId, id);
  if (!isMember) {
    return failure(res, 403, 'You are not a member of this organization');
  }

  const members = await getOrganizationMembers(db, id);

  return success(res, { members });
}
