import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  isUserOwnerOfOrganization,
  getOrganizationInvites,
  createOrganizationInvite,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return failure(res, 400, 'Organization ID is required');
  }

  const db = getDb();

  // Only owners can manage invites
  const isOwner = await isUserOwnerOfOrganization(db, authResult.userId, id);
  if (!isOwner) {
    return failure(res, 403, 'Only organization owners can manage invites');
  }

  if (req.method === 'GET') {
    const invites = await getOrganizationInvites(db, id);
    return success(res, { invites });
  }

  if (req.method === 'POST') {
    const result = await createOrganizationInvite(db, id, authResult.userId);
    if (!result.success) {
      return failure(res, 400, result.error);
    }

    return success(res, { invite: result.invite }, 201);
  }

  return failure(res, 405, 'Method not allowed');
}
