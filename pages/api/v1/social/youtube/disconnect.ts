import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, requireOwner } from '@server/lib/api/auth';
import { success, failure } from '@server/lib/api/responses';
import { getDb } from '@server/db';
import {
  getSocialAccountByOrgAndPlatform,
  deleteSocialAccount,
} from '@server/db/queries/social-accounts';
import { cancelAllPendingPostsForAccount } from '@server/db/queries/scheduled-posts';
import { revokeAccess } from '@server/lib/youtube';

/**
 * DELETE /api/v1/social/youtube/disconnect
 *
 * Disconnects YouTube account from the organization.
 * Cancels all pending scheduled posts for this account.
 * Only organization owners can disconnect accounts.
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

    // Get the YouTube account
    const account = await getSocialAccountByOrgAndPlatform(
      db,
      authResult.organizationId,
      'youtube'
    );

    if (!account) {
      return failure(res, 404, 'YouTube account not connected');
    }

    // Cancel all pending scheduled posts for this account
    const canceledCount = await cancelAllPendingPostsForAccount(db, account.id);

    // Try to revoke OAuth access (best effort)
    await revokeAccess(account.accessToken);

    // Delete the account
    await deleteSocialAccount(db, account.id);

    return success(res, {
      message: 'YouTube account disconnected',
      canceledPosts: canceledCount,
    });
  } catch (error) {
    console.error('YouTube disconnect error:', error);
    return failure(res, 500, 'Failed to disconnect YouTube account');
  }
}
