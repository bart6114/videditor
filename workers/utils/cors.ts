import { Env } from '../env';

/**
 * CORS headers configuration for Cloudflare Workers
 *
 * Development: Allows localhost:3000
 * Production: Should be configured via environment variable
 */
export function getCorsHeaders(env?: Env): Record<string, string> {
  // Get allowed origin from environment or default to localhost for dev
  const allowedOrigin = env?.ENVIRONMENT === 'production'
    ? (env?.ALLOWED_ORIGIN || 'https://yourdomain.com')
    : 'http://localhost:3000';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 hours - cache preflight requests
    'Vary': 'Origin',
  };
}

/**
 * Helper function to create a JSON response with CORS headers
 */
export function corsResponse(
  body: any,
  options: {
    status?: number;
    headers?: Record<string, string>;
    env?: Env;
  } = {}
): Response {
  const { status = 200, headers = {}, env } = options;

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(env),
      ...headers,
    },
  });
}

/**
 * Helper function to create an error response with CORS headers
 */
export function corsError(
  error: string,
  options: {
    status?: number;
    env?: Env;
  } = {}
): Response {
  const { status = 500, env } = options;

  return corsResponse(
    { error },
    { status, env }
  );
}
