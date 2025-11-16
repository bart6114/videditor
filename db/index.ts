import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Create a Drizzle instance from a D1 database binding
 *
 * @param d1 - D1Database instance from Cloudflare Workers env
 * @returns DrizzleD1Database instance with schema
 *
 * @example
 * ```ts
 * import { createDb } from '../db';
 *
 * export async function handler(request: Request, env: Env) {
 *   const db = createDb(env.DB);
 *   const users = await db.select().from(schema.users).all();
 *   return Response.json(users);
 * }
 * ```
 */
export function createDb(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzle(d1, { schema });
}

// Export schema for direct access
export * from './schema';

// Export type helper
export type DB = DrizzleD1Database<typeof schema>;
