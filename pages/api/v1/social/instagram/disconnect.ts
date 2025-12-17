import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, requireOwner } from '@/lib/api/auth';
import { success, failure } from '@/lib/api/responses';
import { getDb } from '@server/db';
import {
  getSocialAccountByOrgAndPlatform,
  deleteSocialAccount,
} from '@server/db/queries/social-accounts';
import { revokeAccess } from '@/lib/instagram';

/**
 * DELETE /api/v1/social/instagram/disconnect
 *
 * Disconnects Instagram account from the organization.
 * Scheduled posts are preserved and will automatically use a reconnected account.
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

    // Get the Instagram account
    const account = await getSocialAccountByOrgAndPlatform(
      db,
      authResult.organizationId,
      'instagram'
    );

    if (!account) {
      return failure(res, 404, 'Instagram account not connected');
    }

    // Try to revoke OAuth access (best effort)
    await revokeAccess(account.accessToken);

    // Delete the account (scheduled posts are preserved with socialAccountId set to NULL)
    await deleteSocialAccount(db, account.id);

    return success(res, {
      message: 'Instagram account disconnected. Scheduled posts will automatically use a reconnected account.',
    });
  } catch (error) {
    console.error('Instagram disconnect error:', error);
    return failure(res, 500, 'Failed to disconnect Instagram account');
  }
}
