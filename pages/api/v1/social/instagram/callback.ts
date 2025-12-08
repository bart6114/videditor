import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { upsertSocialAccount } from '@server/db/queries/social-accounts';
import {
  exchangeCode,
  exchangeForLongLivedToken,
  getInstagramProfile,
  parseOAuthState,
} from '@/lib/instagram';

/**
 * GET /api/v1/social/instagram/callback
 *
 * Handles OAuth callback from Instagram.
 * Exchanges code for tokens, fetches profile, and stores connection.
 * Redirects to settings page with success/error status.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.redirect(302, '/settings/organization?instagram=error&message=Method+not+allowed');
  }

  const { code, state, error: oauthError, error_description } = req.query;

  // Check for OAuth error (user denied or other OAuth error)
  if (oauthError) {
    console.error('Instagram OAuth error:', oauthError, error_description);
    const message = oauthError === 'access_denied'
      ? 'Access denied. Please authorize the app to connect your Instagram account.'
      : String(error_description || oauthError);
    return res.redirect(
      302,
      `/settings/organization?instagram=error&message=${encodeURIComponent(message)}`
    );
  }

  // Validate required params
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(302, '/settings/organization?instagram=error&message=Missing+required+parameters');
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

    const storedState = cookies?.instagram_oauth_state;
    if (!storedState || storedState !== state) {
      return res.redirect(302, '/settings/organization?instagram=error&message=Invalid+state+token');
    }

    // Parse state to get organization ID
    const stateData = parseOAuthState(state);
    if (!stateData) {
      return res.redirect(302, '/settings/organization?instagram=error&message=Expired+or+invalid+state');
    }

    const { organizationId } = stateData;

    // Exchange code for short-lived token
    const { accessToken: shortLivedToken } = await exchangeCode(code);

    // Exchange short-lived token for long-lived token (60 days)
    const { accessToken, tokenExpiresAt } = await exchangeForLongLivedToken(shortLivedToken);

    // Get Instagram profile
    const profile = await getInstagramProfile(accessToken);

    // Store in database
    const db = getDb();

    await upsertSocialAccount(db, {
      organizationId,
      platform: 'instagram',
      channelId: profile.id,
      channelTitle: profile.username,
      channelThumbnail: profile.profilePictureUrl,
      accessToken,
      // For Instagram, we use the same token for refresh since long-lived tokens
      // are refreshed by calling the refresh endpoint with the current token
      refreshToken: accessToken,
      tokenExpiresAt,
      scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
    });

    // Clear the state cookie
    res.setHeader(
      'Set-Cookie',
      'instagram_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );

    // Redirect to settings with success
    return res.redirect(302, '/settings/organization?instagram=connected');
  } catch (error) {
    console.error('Instagram callback error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to connect Instagram account';
    return res.redirect(
      302,
      `/settings/organization?instagram=error&message=${encodeURIComponent(message)}`
    );
  }
}
