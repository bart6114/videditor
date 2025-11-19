import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema';

type InitOptions = {
  connectionString?: string;
  poolConfig?: PoolConfig;
};

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

/**
 * Initialize a shared Postgres pool + Drizzle client.
 * Subsequent calls return the existing singleton to avoid exhausting connections.
 */
export function initDb(options: InitOptions = {}) {
  if (!pool) {
    const connectionString = options.connectionString ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Provide options.connectionString or set the env var.');
    }

    pool = new Pool({
      connectionString,
      ...options.poolConfig,
    });

    db = drizzle(pool, { schema });
  }

  return { pool: pool!, db: db! };
}

/**
 * Retrieve the shared Drizzle client, initializing if needed.
 */
export function getDb(options?: InitOptions) {
  if (!db) {
    initDb(options);
  }

  return db!;
}

export * from './schema';
export type DB = NodePgDatabase<typeof schema>;
