import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  isUserOwnerOfOrganization,
  revokeInvite,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { id, inviteId } = req.query;
  if (!id || typeof id !== 'string') {
    return failure(res, 400, 'Organization ID is required');
  }
  if (!inviteId || typeof inviteId !== 'string') {
    return failure(res, 400, 'Invite ID is required');
  }

  const db = getDb();

  // Only owners can revoke invites
  const isOwner = await isUserOwnerOfOrganization(db, authResult.userId, id);
  if (!isOwner) {
    return failure(res, 403, 'Only organization owners can revoke invites');
  }

  await revokeInvite(db, inviteId, id);

  return success(res, { message: 'Invite revoked successfully' });
}
