import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { upsertSocialAccount } from '@server/db/queries/social-accounts';
import {
  exchangeCode,
  getUserInfo,
  parseOAuthState,
} from '@/lib/tiktok';

/**
 * GET /api/v1/social/tiktok/callback
 *
 * Handles OAuth callback from TikTok.
 * Exchanges code for tokens and stores the connected account.
 * (No PKCE - matches Auth.js implementation for web apps)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.redirect(302, '/settings/organization?tiktok=error&message=Method+not+allowed');
  }

  const { code, state, error: oauthError, error_description } = req.query;

  // Check for OAuth error
  if (oauthError) {
    console.error('TikTok OAuth error:', oauthError, error_description);
    const message = typeof error_description === 'string' ? error_description : String(oauthError);
    return res.redirect(
      302,
      `/settings/organization?tiktok=error&message=${encodeURIComponent(message)}`
    );
  }

  // Validate required params
  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(302, '/settings/organization?tiktok=error&message=Missing+required+parameters');
  }

  try {
    // Parse cookies
    const cookies = req.headers.cookie?.split(';').reduce(
      (acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      },
      {} as Record<string, string>
    );

    const storedState = cookies?.tiktok_oauth_state;

    // Verify state matches cookie
    if (!storedState || storedState !== state) {
      return res.redirect(302, '/settings/organization?tiktok=error&message=Invalid+state+token');
    }

    // Parse state to get organization ID
    const stateData = parseOAuthState(state);
    if (!stateData) {
      return res.redirect(302, '/settings/organization?tiktok=error&message=Expired+or+invalid+state');
    }

    const { organizationId } = stateData;

    // Exchange code for tokens (no PKCE - matches Auth.js)
    const tokens = await exchangeCode(code);

    // Get user info
    const userInfo = await getUserInfo(tokens.accessToken);

    // Store in database
    const db = getDb();

    await upsertSocialAccount(db, {
      organizationId,
      platform: 'tiktok',
      channelId: userInfo.openId,
      channelTitle: userInfo.displayName,
      channelThumbnail: userInfo.avatarUrl,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
    });

    // Clear the OAuth state cookie
    res.setHeader('Set-Cookie', [
      'tiktok_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    ]);

    // Redirect to settings with success
    return res.redirect(302, '/settings/organization?tiktok=connected');
  } catch (error) {
    console.error('TikTok callback error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to connect TikTok account';
    return res.redirect(
      302,
      `/settings/organization?tiktok=error&message=${encodeURIComponent(message)}`
    );
  }
}
