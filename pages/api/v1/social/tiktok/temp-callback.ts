import type { NextApiRequest, NextApiResponse } from 'next';

// Minimal TikTok OAuth callback - NO auth, NO database
// Returns JSON with full debug info for troubleshooting
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error, error_description } = req.query;
  const baseUrl = 'https://062235ebb22e.ngrok-free.app';
  const redirectUri = `${baseUrl}/api/v1/social/tiktok/temp-callback/`;

  // Build debug response - NO PKCE
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    received: {
      code: typeof code === 'string' ? code.slice(0, 30) + '...' : code,
      state,
      error,
      error_description,
    },
    env: {
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecretLength: process.env.TIKTOK_CLIENT_SECRET?.length,
      clientSecretFirst4: process.env.TIKTOK_CLIENT_SECRET?.slice(0, 4),
      configuredRedirectUri: process.env.TIKTOK_REDIRECT_URI,
      actualRedirectUri: redirectUri,
    },
    cookies: {
      tiktok_temp_state: req.cookies?.tiktok_temp_state,
    },
    tokenExchange: null,
  };

  console.log('TEMP CALLBACK - Received:', debug.received);
  console.log('TEMP CALLBACK - Env:', debug.env);

  if (error) {
    debug.tokenExchange = { skipped: true, reason: 'OAuth error from TikTok' };
    return res.status(200).json(debug);
  }

  if (typeof code !== 'string') {
    debug.tokenExchange = { skipped: true, reason: 'No authorization code received' };
    return res.status(200).json(debug);
  }

  // Try token exchange - NO PKCE
  try {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY || '',
      client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const bodyString = body.toString().replace(/\*/g, '%2A');

    debug.tokenExchangeRequest = {
      url: 'https://open.tiktokapis.com/v2/oauth/token/',
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      body: bodyString.replace(/client_secret=[^&]+/, 'client_secret=REDACTED'),
    };

    console.log('TEMP CALLBACK - Token exchange request:', debug.tokenExchangeRequest);

    const response = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyString,
    });

    const data = await response.json();
    debug.tokenExchange = data;

    console.log('TEMP CALLBACK - Token exchange response:', data);

    // If successful, also try to get user info
    if (data.access_token) {
      try {
        const userInfoUrl = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url';
        const userResponse = await fetch(userInfoUrl, {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
          },
        });
        const userData = await userResponse.json();
        debug.userInfo = userData;
        console.log('TEMP CALLBACK - User info:', userData);
      } catch (userError) {
        debug.userInfoError = String(userError);
      }
    }
  } catch (err) {
    debug.tokenExchangeError = String(err);
    console.error('TEMP CALLBACK - Token exchange error:', err);
  }

  // Clear the temp cookie
  res.setHeader('Set-Cookie', 'tiktok_temp_state=; Path=/; HttpOnly; Max-Age=0');

  res.status(200).json(debug);
}
