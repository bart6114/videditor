import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate, requireOwner } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getAuthUrl, generateOAuthState } from '@/lib/tiktok';

/**
 * GET /api/v1/social/tiktok/connect
 *
 * Initiates TikTok OAuth flow.
 * Only organization owners can connect TikTok accounts.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return failure(res, 405, 'Method not allowed');
  }

  try {
    const authResult = await authenticate(req);
    if (!authResult.authenticated) {
      return failure(res, 401, authResult.error);
    }

    if (!requireOwner(authResult)) {
      return failure(res, 403, 'Only organization owners can connect social accounts');
    }

    // Generate state token with organization ID
    const state = generateOAuthState(authResult.organizationId);

    // Store state in cookie for verification in callback
    res.setHeader('Set-Cookie', [
      `tiktok_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    ]);

    // Return OAuth URL (no PKCE - matches Auth.js)
    const authUrl = getAuthUrl(state);
    return success(res, { redirectUrl: authUrl });
  } catch (error) {
    console.error('TikTok connect error:', error);
    return failure(res, 500, 'Failed to initiate TikTok connection');
  }
}
