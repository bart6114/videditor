import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  isUserOwnerOfOrganization,
  removeOrganizationMember,
  transferOrganizationOwnership,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { id, userId } = req.query;
  if (!id || typeof id !== 'string') {
    return failure(res, 400, 'Organization ID is required');
  }
  if (!userId || typeof userId !== 'string') {
    return failure(res, 400, 'User ID is required');
  }

  const db = getDb();

  // Only owners can manage members
  const isOwner = await isUserOwnerOfOrganization(db, authResult.userId, id);
  if (!isOwner) {
    return failure(res, 403, 'Only organization owners can manage members');
  }

  if (req.method === 'DELETE') {
    // Cannot remove yourself (owner)
    if (userId === authResult.userId) {
      return failure(res, 400, 'Cannot remove yourself. Transfer ownership first.');
    }

    const result = await removeOrganizationMember(db, id, userId);
    if (!result.success) {
      return failure(res, 400, result.error);
    }

    return success(res, { message: 'Member removed successfully' });
  }

  if (req.method === 'PATCH') {
    const { role } = req.body;

    // Only support transferring ownership
    if (role !== 'owner') {
      return failure(res, 400, 'Only ownership transfer is supported');
    }

    const result = await transferOrganizationOwnership(db, id, authResult.userId, userId);
    if (!result.success) {
      return failure(res, 400, result.error);
    }

    return success(res, { message: 'Ownership transferred successfully' });
  }

  return failure(res, 405, 'Method not allowed');
}
