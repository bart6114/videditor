import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { failure, success } from '@/lib/api/responses';
import { getInviteByCode } from '@server/db/queries/organizations';

/**
 * Public endpoint to preview an invite (no auth required)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return failure(res, 400, 'Invite code is required');
  }

  const db = getDb();
  const result = await getInviteByCode(db, code);

  if (!result) {
    return failure(res, 404, 'Invite not found');
  }

  const { invite, organization } = result;

  // Check if expired
  if (new Date() > invite.expiresAt) {
    return failure(res, 410, 'Invite has expired');
  }

  // Return public info only
  return success(res, {
    invite: {
      code: invite.code,
      expiresAt: invite.expiresAt,
      organizationName: organization.name,
    },
  });
}
