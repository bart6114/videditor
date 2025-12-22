import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb, mediaAssets } from '@server/db';
import { count, eq } from 'drizzle-orm';

interface StatsResponse {
  totalShortsGenerated: number;
  cachedAt: string;
}

// Baseline count from before we started tracking
const BASELINE_SHORTS = 456;

// Simple in-memory cache
let cachedStats: StatsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/stats/public
 *
 * Returns public statistics for landing page display.
 * No authentication required - only exposes aggregate counts.
 * Results are cached for 5 minutes.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatsResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = Date.now();

    // Return cached result if valid
    if (cachedStats && now - cacheTimestamp < CACHE_TTL_MS) {
      // Allow caching by CDN/browser for 1 minute
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(cachedStats);
    }

    const db = getDb();

    // Count all completed media assets (both long_form and short_form)
    const [result] = await db
      .select({ count: count() })
      .from(mediaAssets)
      .where(eq(mediaAssets.status, 'completed'));

    const totalShortsGenerated = (result?.count ?? 0) + BASELINE_SHORTS;

    cachedStats = {
      totalShortsGenerated,
      cachedAt: new Date().toISOString(),
    };
    cacheTimestamp = now;

    // Allow caching by CDN/browser for 1 minute
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(cachedStats);
  } catch (error) {
    console.error('Failed to fetch public stats:', error);

    // Return cached result if available, even if stale
    if (cachedStats) {
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(cachedStats);
    }

    // Fallback to baseline if no cache available
    return res.status(200).json({
      totalShortsGenerated: BASELINE_SHORTS,
      cachedAt: new Date().toISOString(),
    });
  }
}
