import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getScheduledPostsForCalendar } from '@server/db/queries/scheduled-posts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

/**
 * GET /api/v1/calendar
 *
 * Get scheduled posts for calendar view.
 * Query params:
 *   - startDate: ISO date string (required)
 *   - endDate: ISO date string (required)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { startDate, endDate } = req.query;

  if (!startDate || typeof startDate !== 'string') {
    return failure(res, 400, 'Start date is required');
  }
  if (!endDate || typeof endDate !== 'string') {
    return failure(res, 400, 'End date is required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return failure(res, 400, 'Invalid date format');
  }

  if (start > end) {
    return failure(res, 400, 'Start date must be before end date');
  }

  // Limit range to 3 months to prevent excessive queries
  const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
  if (end.getTime() - start.getTime() > maxRangeMs) {
    return failure(res, 400, 'Date range cannot exceed 90 days');
  }

  const db = getDb();
  const posts = await getScheduledPostsForCalendar(
    db,
    authResult.organizationId,
    start,
    end
  );

  // Transform for frontend
  const calendarItems = posts.map((item) => ({
    id: item.post.id,
    scheduledFor: item.post.scheduledFor,
    status: item.post.status,
    title: item.post.title,
    description: item.post.description,
    platformPostId: item.post.platformPostId,
    platformUrl: item.post.platformUrl,
    errorMessage: item.post.errorMessage,
    short: {
      id: item.short.id,
      thumbnailUrl: item.short.thumbnailUrl,
      transcriptionSlice: item.short.transcriptionSlice,
    },
    project: {
      id: item.project.id,
      title: item.project.title,
    },
    socialAccount: {
      platform: item.socialAccount.platform,
      channelTitle: item.socialAccount.channelTitle,
    },
  }));

  return success(res, { posts: calendarItems });
}
