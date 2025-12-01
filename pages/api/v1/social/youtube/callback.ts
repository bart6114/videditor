import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { upsertSocialAccount } from '@server/db/queries/social-accounts';
import { getUserRoleInOrganization } from '@server/db/queries/organizations';
import {
  exchangeCode,
  getChannelInfo,
  parseOAuthState,
} from '@/lib/youtube';

/**
 * GET /api/v1/social/youtube/callback
 *
 * Handles OAuth callback from Google.
 * Exchanges code for tokens and stores the connected account.
 * Redirects to settings page with success/error status.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.redirect(302, '/settings/organization?youtube=error&message=Method+not+allowed');
  }

  const { code, state, error: oauthError } = req.query;

  // Check for OAuth error
  if (oauthError) {
    console.error('YouTube OAuth error:', oauthError);
    return res.redirect(
      302,
      `/settings/organization?youtube=error&message=${encodeURIComponent(String(oauthError))}`
    );
  }

  // Validate required params
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(302, '/settings/organization?youtube=error&message=Missing+required+parameters');
  }

  try {
    // Verify state matches cookie
    const cookies = req.headers.cookie?.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    const storedState = cookies?.youtube_oauth_state;
    if (!storedState || storedState !== state) {
      return res.redirect(302, '/settings/organization?youtube=error&message=Invalid+state+token');
    }

    // Parse state to get organization ID
    const stateData = parseOAuthState(state);
    if (!stateData) {
      return res.redirect(302, '/settings/organization?youtube=error&message=Expired+or+invalid+state');
    }

    const { organizationId } = stateData;

    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Get channel info
    const channelInfo = await getChannelInfo(tokens.accessToken);

    // Store in database
    const db = getDb();

    // Note: We can't verify the user here since this is a redirect callback
    // The state token contains the organizationId, and we validated it was created
    // by an owner in the /connect endpoint. This is secure because:
    // 1. State is generated server-side with a timestamp and nonce
    // 2. State is stored in an HttpOnly cookie
    // 3. State expires after 10 minutes

    await upsertSocialAccount(db, {
      organizationId,
      platform: 'youtube',
      channelId: channelInfo.channelId,
      channelTitle: channelInfo.channelTitle,
      channelThumbnail: channelInfo.channelThumbnail,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      // connectedById would ideally be set here, but we don't have user context in callback
      // It was verified as owner in /connect, so this is acceptable
    });

    // Clear the state cookie
    res.setHeader(
      'Set-Cookie',
      'youtube_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );

    // Redirect to settings with success
    return res.redirect(302, '/settings/organization?youtube=connected');
  } catch (error) {
    console.error('YouTube callback error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to connect YouTube account';
    return res.redirect(
      302,
      `/settings/organization?youtube=error&message=${encodeURIComponent(message)}`
    );
  }
}
