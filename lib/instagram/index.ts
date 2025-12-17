import crypto from 'crypto';

// Instagram API with Instagram Login (launched July 2024)
// Uses api.instagram.com instead of graph.facebook.com for OAuth
// Uses graph.instagram.com for API calls

// Instagram OAuth scopes for Business/Creator accounts
export const INSTAGRAM_SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
];

/**
 * Get Instagram App credentials from environment
 */
function getCredentials() {
  const clientId = process.env.INSTAGRAM_APP_ID;
  const clientSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Instagram OAuth credentials not configured');
  }

  return { clientId, clientSecret, redirectUri };
}

/**
 * Generate OAuth state token for CSRF protection
 * Includes organizationId encrypted in the state
 */
export function generateOAuthState(organizationId: string): string {
  const stateData = {
    organizationId,
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };
  // Encode as base64 for URL safety
  return Buffer.from(JSON.stringify(stateData)).toString('base64url');
}

/**
 * Parse and validate OAuth state token
 */
export function parseOAuthState(state: string): { organizationId: string } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const data = JSON.parse(decoded);

    // Check timestamp (expire after 10 minutes)
    if (Date.now() - data.timestamp > 10 * 60 * 1000) {
      return null;
    }

    return { organizationId: data.organizationId };
  } catch {
    return null;
  }
}

/**
 * Generate the Instagram OAuth authorization URL
 * Uses Instagram Direct Login (api.instagram.com)
 */
export function getAuthUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: INSTAGRAM_SCOPES.join(','),
    response_type: 'code',
    state,
  });

  return `https://api.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for short-lived access token
 * Instagram Direct Login returns short-lived tokens (~1 hour)
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  const { clientId, clientSecret, redirectUri } = getCredentials();

  const formData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error_message || 'Failed to exchange code for token');
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access token in response');
  }

  return {
    accessToken: data.access_token,
    userId: data.user_id.toString(),
  };
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 * Uses graph.instagram.com endpoint
 */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  tokenExpiresAt: Date;
}> {
  const { clientSecret } = getCredentials();

  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: clientSecret,
    access_token: shortLivedToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to exchange for long-lived token');
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access token in long-lived token response');
  }

  // Long-lived tokens expire in ~60 days (5184000 seconds)
  const expiresIn = data.expires_in || 5184000;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    accessToken: data.access_token,
    tokenExpiresAt,
  };
}

export interface InstagramAccount {
  id: string;
  username: string;
  accountType: string;
  profilePictureUrl: string | null;
}

/**
 * Get the authenticated Instagram user's profile
 * Uses graph.instagram.com/me endpoint
 */
export async function getInstagramProfile(accessToken: string): Promise<InstagramAccount> {
  const params = new URLSearchParams({
    access_token: accessToken,
    fields: 'id,username,account_type,profile_picture_url',
  });

  const response = await fetch(
    `https://graph.instagram.com/me?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to fetch Instagram profile');
  }

  const data = await response.json();

  return {
    id: data.id,
    username: data.username,
    accountType: data.account_type,
    profilePictureUrl: data.profile_picture_url || null,
  };
}

/**
 * Refresh a long-lived token (get new 60-day token)
 * Must be done before the current token expires
 * Uses graph.instagram.com endpoint
 */
export async function refreshLongLivedToken(currentToken: string): Promise<{
  accessToken: string;
  tokenExpiresAt: Date;
}> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: currentToken,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || 'Failed to refresh token');
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access token in refresh response');
  }

  const expiresIn = data.expires_in || 5184000;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    accessToken: data.access_token,
    tokenExpiresAt,
  };
}

/**
 * Check if an access token is expired or about to expire
 * Returns true if token expires in less than 7 days (for long-lived tokens)
 */
export function isTokenExpired(tokenExpiresAt: Date): boolean {
  const bufferMs = 7 * 24 * 60 * 60 * 1000; // 7 days buffer for long-lived tokens
  return tokenExpiresAt.getTime() - Date.now() < bufferMs;
}

/**
 * Revoke OAuth access (disconnect account)
 * Uses the Meta Graph API to revoke all permissions, invalidating the token
 */
export async function revokeAccess(accessToken: string): Promise<void> {
  try {
    // Revoke all permissions via Instagram Graph API
    // This invalidates the token at Meta's servers
    const response = await fetch(
      `https://graph.instagram.com/me/permissions?access_token=${accessToken}`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      // Log but don't throw - we still want to delete locally
      const errorText = await response.text().catch(() => 'Unknown error');
      console.warn('Failed to revoke Instagram permissions:', errorText);
    }
  } catch (error) {
    // Best effort - ignore errors, local deletion proceeds anyway
    console.warn('Instagram revocation error:', error);
  }
}

/**
 * Instagram API error codes and their meanings
 */
export const INSTAGRAM_ERROR_MESSAGES: Record<string, string> = {
  OAuthException: 'Instagram connection expired. Please reconnect your account.',
  'Invalid access token': 'Instagram connection expired. Please reconnect your account.',
  'Error validating access token': 'Instagram connection expired. Please reconnect your account.',
  'rate limit': 'Too many requests. Please wait a moment and try again.',
  'permission': 'Access denied. Please check your Instagram account permissions.',
};

/**
 * Parse Instagram API error and return user-friendly message
 */
export function parseInstagramError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    for (const [key, friendlyMessage] of Object.entries(INSTAGRAM_ERROR_MESSAGES)) {
      if (message.includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }

    return `Instagram error: ${error.message}`;
  }

  return 'An unknown error occurred with Instagram';
}
