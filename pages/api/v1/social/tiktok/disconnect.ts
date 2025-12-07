import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, requireOwner } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { getSocialAccountByOrgAndPlatform, deleteSocialAccount } from '@server/db/queries/social-accounts';
import { deleteAllPendingPostsForAccount } from '@server/db/queries/scheduled-posts';
import { revokeAccess } from '@/lib/tiktok';

/**
 * DELETE /api/v1/social/tiktok/disconnect
 *
 * Disconnects TikTok account from the organization.
 * Only organization owners can disconnect accounts.
 * Also deletes any pending scheduled posts for this account.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return failure(res, 405, 'Method not allowed');
  }

  try {
    // Authenticate user
    const authResult = await authenticate(req);
    if (!authResult.authenticated) {
      return failure(res, 401, authResult.error);
    }

    // Only owners can disconnect social accounts
    if (!requireOwner(authResult)) {
      return failure(res, 403, 'Only organization owners can disconnect social accounts');
    }

    const db = getDb();

    // Get the TikTok account for this organization
    const account = await getSocialAccountByOrgAndPlatform(
      db,
      authResult.organizationId,
      'tiktok'
    );

    if (!account) {
      return failure(res, 404, 'No TikTok account connected');
    }

    // Delete all pending scheduled posts for this account
    await deleteAllPendingPostsForAccount(db, account.id);

    // Revoke access token (best effort)
    await revokeAccess(account.accessToken);

    // Delete the social account
    await deleteSocialAccount(db, account.id);

    return success(res, { message: 'TikTok account disconnected' });
  } catch (error) {
    console.error('TikTok disconnect error:', error);
    return failure(res, 500, 'Failed to disconnect TikTok account');
  }
}
