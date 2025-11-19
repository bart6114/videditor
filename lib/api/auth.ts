import type { NextApiRequest } from 'next';
import { verifyToken } from '@clerk/backend';
import { getDb } from '@server/db';
import { ensureUserExists } from '@server/db/queries/users';

type AuthResult =
  | { authenticated: true; userId: string }
  | { authenticated: false; error: string };

type ClerkUserData = {
  userId: string;
  email?: string;
  fullName?: string;
  imageUrl?: string;
};

function extractBearerToken(authorization?: string | string[]): string | null {
  if (!authorization) {
    return null;
  }

  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header) {
    return null;
  }

  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }

  return header;
}

async function verifyClerkToken(token: string): Promise<ClerkUserData | null> {
  try {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.error('CLERK_SECRET_KEY not configured');
      return null;
    }

    const payload = await verifyToken(token, { secretKey });

    // Extract user data from JWT claims
    if (payload && typeof payload.sub === 'string') {
      const userId = payload.sub;
      const email = payload.email as string | undefined;

      // Email is optional - some OAuth providers (GitHub, etc.) don't always provide it
      // This is normal and expected behavior

      return {
        userId,
        email,
        fullName: payload.name as string | undefined,
        imageUrl: payload.picture as string | undefined,
      };
    }

    return null;
  } catch (error) {
    // Token verification failed (invalid signature, expired, etc.)
    console.error('Clerk JWT verification failed:', error);
    return null;
  }
}

export async function authenticate(req: NextApiRequest): Promise<AuthResult> {
  const bearerToken = extractBearerToken(req.headers.authorization);

  // Verify Clerk JWT token
  if (bearerToken) {
    const userData = await verifyClerkToken(bearerToken);

    if (userData) {
      // JIT user provisioning: ensure user exists in database
      // Email is optional - some OAuth providers don't provide it
      try {
        const db = getDb();
        await ensureUserExists(
          db,
          userData.userId,
          userData.email,
          userData.fullName,
          userData.imageUrl
        );
      } catch (error) {
        console.error('Failed to provision user:', error);
        // Continue anyway - don't block authentication if DB provisioning fails
        // The user is still authenticated via Clerk
      }

      return { authenticated: true, userId: userData.userId };
    }

    // If bearer token exists but verification failed, reject immediately
    return {
      authenticated: false,
      error: 'Invalid or expired authentication token',
    };
  }

  // No authentication provided
  return {
    authenticated: false,
    error: 'Missing authentication. Please provide Authorization header with Bearer token.',
  };
}
