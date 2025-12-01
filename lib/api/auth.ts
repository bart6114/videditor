import type { NextApiRequest } from 'next';
import { verifyToken, createClerkClient, type ClerkClient } from '@clerk/backend';
import { getDb } from '@server/db';
import { ensureUserExists } from '@server/db/queries/users';
import { getUserDefaultOrganization } from '@server/db/queries/organizations';

type AuthResult =
  | {
      authenticated: true;
      userId: string;
      organizationId: string;
      role: 'owner' | 'member';
    }
  | { authenticated: false; error: string };

type ClerkUserData = {
  userId: string;
  email?: string;
  fullName?: string;
  imageUrl?: string;
};

// Singleton clerk client for API calls
let clerkClient: ClerkClient | null = null;

function getClerkClient(): ClerkClient | null {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;

  if (!clerkClient) {
    clerkClient = createClerkClient({ secretKey });
  }
  return clerkClient;
}

/**
 * Fetch user's primary email from Clerk API
 * Only called when JWT doesn't contain email (e.g., some OAuth providers like GitHub)
 */
async function fetchUserEmailFromClerk(userId: string): Promise<string | undefined> {
  try {
    const client = getClerkClient();
    if (!client) return undefined;

    const user = await client.users.getUser(userId);

    // Priority: primaryEmailAddress > verified email > any email
    if (user.primaryEmailAddress?.emailAddress) {
      return user.primaryEmailAddress.emailAddress;
    }

    const verifiedEmail = user.emailAddresses?.find(
      (e) => e.verification?.status === 'verified'
    );
    if (verifiedEmail?.emailAddress) {
      return verifiedEmail.emailAddress;
    }

    return user.emailAddresses?.[0]?.emailAddress;
  } catch (error) {
    console.warn('Failed to fetch user email from Clerk:', error);
    return undefined;
  }
}

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
      let email = payload.email as string | undefined;

      // If email not in JWT, fetch from Clerk API
      // This handles OAuth providers (GitHub, etc.) that don't include email in token
      if (!email) {
        email = await fetchUserEmailFromClerk(userId);
      }

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
      const db = getDb();

      // JIT user provisioning: ensure user exists in database
      // Email is optional - some OAuth providers don't provide it
      try {
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

      // Get user's default organization
      const defaultOrg = await getUserDefaultOrganization(db, userData.userId);
      if (!defaultOrg) {
        return {
          authenticated: false,
          error: 'User has no organization. Please contact support.',
        };
      }

      return {
        authenticated: true,
        userId: userData.userId,
        organizationId: defaultOrg.id,
        role: defaultOrg.role,
      };
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

/**
 * Helper to check if the authenticated user is an owner of their organization
 */
export function requireOwner(authResult: AuthResult): authResult is AuthResult & { role: 'owner' } {
  return authResult.authenticated && authResult.role === 'owner';
}
