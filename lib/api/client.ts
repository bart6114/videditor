import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

// API routes are now served by Next.js at /api
const API_BASE_URL = '/api';

function resolveApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

/**
 * API client for calling Next.js API routes.
 * Automatically includes Clerk authentication token.
 */
export async function apiCall<T = any>(endpoint: string, options?: RequestInit & { userId?: string }): Promise<T> {
  const response = await fetch(resolveApiUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.userId ? { 'X-User-Id': options.userId } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook for making authenticated API calls
 * Uses Clerk to get the authentication token
 */
export function useApi() {
  const { getToken } = useAuth();

  const call = useCallback(async <T = any>(endpoint: string, options?: RequestInit): Promise<T> => {
    const token = await getToken();

    if (!token) {
      throw new Error('Authentication required. Please sign in to continue.');
    }

    const response = await fetch(resolveApiUrl(endpoint), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Handle specific HTTP error codes
      if (response.status === 401) {
        throw new Error('Invalid or expired authentication token');
      }

      if (response.status === 403) {
        throw new Error('You do not have permission to access this resource');
      }

      if (response.status === 404) {
        throw new Error('The requested resource was not found');
      }

      if (response.status >= 500) {
        throw new Error('Server error. Please try again later');
      }

      // Try to get error message from response
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `API error: ${response.status}`);
    }

    const json = await response.json();

    // Unwrap the { success: true, data: T } response format
    if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
      return json.data as T;
    }

    return json;
  }, [getToken]);

  return { call };
}

/**
 * Server-side API call (for getServerSideProps)
 * Requires auth token to be passed explicitly
 */
export async function apiCallServer<T = any>(
  endpoint: string,
  token: string | null,
  options?: RequestInit
): Promise<T> {
  if (!token) {
    throw new Error('Authentication token is required for server-side API calls');
  }

  const response = await fetch(resolveApiUrl(endpoint), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  const json = await response.json();

  // Unwrap the { success: true, data: T } response format
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }

  return json;
}
