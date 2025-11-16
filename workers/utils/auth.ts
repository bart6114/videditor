import { verifyToken } from '@clerk/backend';
import { createDb } from '../../db';
import { ensureUserExists as ensureUserExistsQuery } from '../../db/queries/users';
import { Env } from '../env';

export interface ClerkUser {
  userId: string;
  email: string;
  fullName?: string;
  imageUrl?: string;
}

/**
 * Verify Clerk JWT and extract user data
 * Optimized for Cloudflare Workers edge environment
 */
export async function verifyClerkAuth(request: Request, env: Env): Promise<ClerkUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT using Clerk's JWKS (auto-fetched from Clerk API)
    const result = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      // Optional: provide jwtKey for networkless verification (faster)
      // jwtKey: env.CLERK_JWT_KEY,
    });

    // Extract user data from JWT claims
    return {
      userId: result.sub,
      email: result.email as string || '',
      fullName: result.name as string | undefined,
      imageUrl: result.picture as string | undefined,
    };
  } catch (error) {
    console.error('Clerk token verification failed:', error);
    return null;
  }
}

/**
 * Get or create user in D1 database from Clerk user
 * Uses Drizzle ORM with INSERT OR IGNORE to handle race conditions
 */
export async function ensureUserExists(
  env: Env,
  userId: string,
  email: string,
  fullName?: string,
  imageUrl?: string
): Promise<void> {
  const db = createDb(env.DB);
  await ensureUserExistsQuery(db, userId, email, fullName, imageUrl);
}
