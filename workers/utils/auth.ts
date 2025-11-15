import { verifyToken } from '@clerk/backend';
import { Env } from '../env';

/**
 * Verify Clerk JWT using networkless verification
 * Optimized for Cloudflare Workers edge environment
 */
export async function verifyClerkAuth(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // Verify JWT using Clerk's JWKS (auto-fetched from Clerk API)
    // The verifyToken function will automatically fetch JWKS using the secretKey
    const result = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      // Optional: provide jwtKey for networkless verification (faster)
      // jwtKey: env.CLERK_JWT_KEY,
    });

    return result.sub; // User ID from JWT claims
  } catch (error) {
    console.error('Clerk token verification failed:', error);
    return null;
  }
}

/**
 * Get or create user in D1 database from Clerk user
 */
export async function ensureUserExists(
  env: Env,
  userId: string,
  email: string,
  fullName?: string,
  imageUrl?: string
): Promise<void> {
  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(userId)
    .first();

  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO users (id, email, full_name, image_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
    )
      .bind(userId, email, fullName || null, imageUrl || null)
      .run();
  }
}
