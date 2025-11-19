import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Drizzle Kit commands may fail until it is configured.');
}

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
