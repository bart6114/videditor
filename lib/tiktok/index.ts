import crypto from 'crypto';

// TikTok OAuth scopes
export const TIKTOK_SCOPES = ['user.info.basic'];

// TikTok API endpoints
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const TIKTOK_REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';

/**
 * Get TikTok OAuth credentials from environment
 */
function getCredentials() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI;

  if (!clientKey || !clientSecret || !redirectUri) {
    throw new Error('TikTok OAuth credentials not configured');
  }

  return { clientKey, clientSecret, redirectUri };
}

/**
 * Generate OAuth state token for CSRF protection
 */
export function generateOAuthState(organizationId: string): string {
  const stateData = {
    organizationId,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(stateData)).toString('base64url');
}

/**
 * Parse and validate OAuth state token
 */
export function parseOAuthState(state: string): { organizationId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded);

    // Expire after 10 minutes
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      return null;
    }

    return { organizationId: data.organizationId };
  } catch {
    return null;
  }
}

/**
 * Generate the TikTok OAuth authorization URL
 * Matches Auth.js implementation - NO PKCE for web apps
 */
export function getAuthUrl(state: string): string {
  const { clientKey, redirectUri } = getCredentials();

  const params = new URLSearchParams({
    client_key: clientKey,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  });

  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * Matches Auth.js implementation - client_secret_post method
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
  scopes: string[];
}> {
  const { clientKey, clientSecret, redirectUri } = getCredentials();

  // Build body exactly like Auth.js does
  const body = new URLSearchParams();
  body.append('client_key', clientKey);
  body.append('client_secret', clientSecret);
  body.append('code', code);
  body.append('grant_type', 'authorization_code');
  body.append('redirect_uri', redirectUri);

  // URLSearchParams doesn't encode '*' - TikTok requires it encoded
  const bodyString = body.toString().replace(/\*/g, '%2A');

  console.log('TikTok token exchange request:', {
    url: TIKTOK_TOKEN_URL,
    clientKey,
    clientSecretLength: clientSecret.length,
    codeLength: code.length,
    codeFirst20: code.substring(0, 20),
    redirectUri,
    bodyString, // See exact encoded body
  });

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyString,
  });

  const data = await response.json();

  console.log('TikTok token exchange response:', JSON.stringify(data, null, 2));

  if (data.error || !data.access_token) {
    const errorMsg = data.error_description || data.error || 'Failed to exchange code for tokens';
    throw new Error(errorMsg);
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 86400));

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    openId: data.open_id,
    scopes: data.scope?.split(',') ?? TIKTOK_SCOPES,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const { clientKey, clientSecret } = getCredentials();

  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await response.json();

  if (data.error || !data.access_token) {
    const errorMsg = data.error_description || data.error || 'Failed to refresh access token';
    throw new Error(errorMsg);
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 86400));

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
  };
}

/**
 * Get user information for the authenticated user
 */
export async function getUserInfo(accessToken: string): Promise<{
  openId: string;
  displayName: string;
  avatarUrl: string | null;
}> {
  const response = await fetch(`${TIKTOK_USER_INFO_URL}?fields=open_id,display_name,avatar_url`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (data.error || !data.data?.user) {
    const errorMsg = data.error?.message || 'Failed to fetch user information';
    throw new Error(errorMsg);
  }

  const user = data.data.user;

  return {
    openId: user.open_id,
    displayName: user.display_name || 'TikTok User',
    avatarUrl: user.avatar_url || null,
  };
}

/**
 * Check if an access token is expired or about to expire
 */
export function isTokenExpired(tokenExpiresAt: Date): boolean {
  const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
  return tokenExpiresAt.getTime() - Date.now() < bufferMs;
}

/**
 * Revoke OAuth access (disconnect account)
 */
export async function revokeAccess(accessToken: string): Promise<void> {
  try {
    const { clientKey, clientSecret } = getCredentials();

    await fetch(TIKTOK_REVOKE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        token: accessToken,
      }),
    });
  } catch {
    // Ignore errors during revocation
  }
}

/**
 * Parse TikTok API error and return user-friendly message
 */
export function parseTikTokError(error: unknown): string {
  const errorMessages: Record<string, string> = {
    access_token_invalid: 'TikTok connection expired. Please reconnect your account.',
    invalid_refresh_token: 'TikTok refresh token expired. Please reconnect your account.',
    scope_not_authorized: 'Required TikTok permissions not granted. Please reconnect.',
    rate_limit_exceeded: 'Too many requests. Please wait a moment and try again.',
  };

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    for (const [key, friendlyMessage] of Object.entries(errorMessages)) {
      if (message.includes(key.replace(/_/g, ' ')) || message.includes(key)) {
        return friendlyMessage;
      }
    }
    return `TikTok error: ${error.message}`;
  }

  return 'An unknown error occurred with TikTok';
}
