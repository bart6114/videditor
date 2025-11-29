import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, requireOwner } from '@server/lib/api/auth';
import { failure } from '@server/lib/api/responses';
import { getAuthUrl, generateOAuthState } from '@server/lib/youtube';

/**
 * GET /api/v1/social/youtube/connect
 *
 * Initiates YouTube OAuth flow.
 * Only organization owners can connect YouTube accounts.
 * Redirects to Google's OAuth consent screen.
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
      `youtube_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    );

    // Redirect to Google OAuth
    const authUrl = getAuthUrl(state);
    res.redirect(302, authUrl);
  } catch (error) {
    console.error('YouTube connect error:', error);
    return failure(res, 500, 'Failed to initiate YouTube connection');
  }
}
