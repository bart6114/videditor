import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, requireOwner } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getAuthUrl, generateOAuthState } from '@/lib/instagram';

/**
 * GET /api/v1/social/instagram/connect
 *
 * Initiates Instagram OAuth flow via Meta.
 * Only organization owners can connect Instagram accounts.
 * Returns redirect URL for Meta's OAuth consent screen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return failure(res, 405, 'Method not allowed');
  }

  try {
    // Authenticate user
    const authResult = await authenticate(req);
    if (!authResult.authenticated) {
      return failure(res, 401, authResult.error);
    }

    // Only owners can connect social accounts
    if (!requireOwner(authResult)) {
      return failure(res, 403, 'Only organization owners can connect social accounts');
    }

    // Generate state token with organization ID
    const state = generateOAuthState(authResult.organizationId);

    // Store state in a cookie for verification in callback
    res.setHeader(
      'Set-Cookie',
      `instagram_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    // Return OAuth URL for frontend to redirect
    const authUrl = getAuthUrl(state);
    return success(res, { redirectUrl: authUrl });
  } catch (error) {
    console.error('Instagram connect error:', error);
    return failure(res, 500, 'Failed to initiate Instagram connection');
  }
}
