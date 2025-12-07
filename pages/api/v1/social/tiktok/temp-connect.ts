import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// Minimal TikTok OAuth connect - NO auth, NO database, NO PKCE
// Just for debugging the OAuth flow
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const baseUrl = 'https://062235ebb22e.ngrok-free.app';
  const redirectUri = `${baseUrl}/api/v1/social/tiktok/temp-callback/`;
  const state = crypto.randomUUID();

  console.log('TEMP CONNECT - Debug info (NO PKCE):', {
    clientKey,
    redirectUri,
    state,
  });

  // Store state in cookie
  res.setHeader('Set-Cookie', `tiktok_temp_state=${state}; Path=/; HttpOnly; Max-Age=600; SameSite=Lax`);

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.set('client_key', clientKey || '');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'user.info.basic');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  // NO PKCE - testing if it's actually required

  console.log('TEMP CONNECT - Redirecting to:', authUrl.toString());

  res.redirect(authUrl.toString());
}
