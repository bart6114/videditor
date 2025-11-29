import { google, youtube_v3 } from 'googleapis';
import fs from 'fs';
import crypto from 'crypto';

// YouTube OAuth scopes needed
export const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

/**
 * Create an OAuth2 client for YouTube
 */
export function createOAuth2Client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
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
 * Generate the Google OAuth authorization URL
 */
export function getAuthUrl(state: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: YOUTUBE_SCOPES,
    state,
    prompt: 'consent', // Force refresh token generation
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to obtain tokens from Google');
  }

  // Calculate expiry time
  const expiresAt = new Date();
  if (tokens.expiry_date) {
    expiresAt.setTime(tokens.expiry_date);
  } else {
    // Default to 1 hour if not provided
    expiresAt.setTime(Date.now() + 3600 * 1000);
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    scopes: tokens.scope?.split(' ') ?? YOUTUBE_SCOPES,
  };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  const expiresAt = new Date();
  if (credentials.expiry_date) {
    expiresAt.setTime(credentials.expiry_date);
  } else {
    expiresAt.setTime(Date.now() + 3600 * 1000);
  }

  return {
    accessToken: credentials.access_token,
    expiresAt,
  };
}

/**
 * Get channel information for the authenticated user
 */
export async function getChannelInfo(accessToken: string): Promise<{
  channelId: string;
  channelTitle: string;
  channelThumbnail: string | null;
}> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const response = await youtube.channels.list({
    part: ['snippet'],
    mine: true,
  });

  const channel = response.data.items?.[0];
  if (!channel?.id || !channel.snippet?.title) {
    throw new Error('Failed to fetch channel information');
  }

  return {
    channelId: channel.id,
    channelTitle: channel.snippet.title,
    channelThumbnail: channel.snippet.thumbnails?.default?.url ?? null,
  };
}

/**
 * Upload a video to YouTube as a Short
 */
export async function uploadVideo(
  accessToken: string,
  videoPath: string,
  title: string,
  description: string
): Promise<{
  videoId: string;
  url: string;
}> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  // YouTube Shorts titles are limited to 100 characters
  const sanitizedTitle = title.slice(0, 100);

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: sanitizedTitle,
        description,
        categoryId: '22', // People & Blogs
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = response.data.id;
  if (!videoId) {
    throw new Error('Failed to upload video to YouTube');
  }

  // YouTube Shorts URL format
  return {
    videoId,
    url: `https://youtube.com/shorts/${videoId}`,
  };
}

/**
 * Check if an access token is expired or about to expire
 * Returns true if token expires in less than 5 minutes
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
    const oauth2Client = createOAuth2Client();
    await oauth2Client.revokeToken(accessToken);
  } catch {
    // Ignore errors during revocation - account will be disconnected anyway
  }
}

/**
 * YouTube API error codes and their meanings
 */
export const YOUTUBE_ERROR_MESSAGES: Record<string, string> = {
  quotaExceeded: 'Daily upload quota reached. Please try again tomorrow.',
  rateLimitExceeded: 'Too many requests. Please wait a moment and try again.',
  videoRejected: 'Video was rejected by YouTube. It may violate their policies.',
  invalidCredentials: 'YouTube connection expired. Please reconnect your account.',
  forbidden: 'Access denied. Please check your YouTube account permissions.',
  notFound: 'YouTube channel not found.',
};

/**
 * Parse YouTube API error and return user-friendly message
 */
export function parseYouTubeError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    for (const [key, friendlyMessage] of Object.entries(YOUTUBE_ERROR_MESSAGES)) {
      if (message.includes(key.toLowerCase())) {
        return friendlyMessage;
      }
    }

    return `YouTube error: ${error.message}`;
  }

  return 'An unknown error occurred with YouTube';
}
