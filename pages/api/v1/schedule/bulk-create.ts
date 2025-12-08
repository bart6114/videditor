import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getShortsByIds } from '@server/db/queries/shorts';
import { getSocialAccountById } from '@server/db/queries/social-accounts';
import { createScheduledPost } from '@server/db/queries/scheduled-posts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

interface ScheduleItem {
  shortId: string;
  socialAccountId: string;
  scheduledFor: string;
  title: string;
  description?: string;
}

interface BulkCreateRequest {
  schedules: ScheduleItem[];
}

interface CreatedItem {
  shortId: string;
  scheduledPostId: string;
}

interface ErrorItem {
  shortId: string;
  error: string;
}

interface BulkCreateResponse {
  created: CreatedItem[];
  errors: ErrorItem[];
}

/**
 * POST /api/v1/schedule/bulk-create
 *
 * Create multiple scheduled posts at once.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  // Parse request body
  let body: BulkCreateRequest;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return failure(res, 400, 'Invalid request body');
  }

  const { schedules } = body;

  // Validate required fields
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    return failure(res, 400, 'schedules array is required');
  }
  if (schedules.length > 50) {
    return failure(res, 400, 'Maximum 50 schedules can be created at once');
  }

  // Validate each schedule item
  for (const item of schedules) {
    if (!item.shortId || typeof item.shortId !== 'string') {
      return failure(res, 400, 'Each schedule must have a shortId');
    }
    if (!item.socialAccountId || typeof item.socialAccountId !== 'string') {
      return failure(res, 400, 'Each schedule must have a socialAccountId');
    }
    if (!item.scheduledFor || typeof item.scheduledFor !== 'string') {
      return failure(res, 400, 'Each schedule must have a scheduledFor time');
    }
    if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
      return failure(res, 400, 'Each schedule must have a title');
    }
  }

  const db = getDb();

  // Get unique short IDs and social account IDs
  const shortIds = [...new Set(schedules.map((s) => s.shortId))];
  const socialAccountIds = [...new Set(schedules.map((s) => s.socialAccountId))];

  // Fetch and validate shorts
  const shorts = await getShortsByIds(db, shortIds, authResult.organizationId);
  const shortsMap = new Map(shorts.map((s) => [s.id, s]));

  // Verify social accounts belong to organization
  const socialAccountsValid = new Map<string, boolean>();
  for (const accountId of socialAccountIds) {
    const account = await getSocialAccountById(db, accountId);
    socialAccountsValid.set(
      accountId,
      !!account && account.organizationId === authResult.organizationId
    );
  }

  // Process each schedule
  const created: CreatedItem[] = [];
  const errors: ErrorItem[] = [];

  for (const item of schedules) {
    // Validate short exists and is owned
    const short = shortsMap.get(item.shortId);
    if (!short) {
      errors.push({ shortId: item.shortId, error: 'Short not found' });
      continue;
    }

    // Validate short is completed with video
    if (short.status !== 'completed') {
      errors.push({ shortId: item.shortId, error: 'Short is not completed' });
      continue;
    }
    if (!short.outputObjectKey) {
      errors.push({ shortId: item.shortId, error: 'Short has no video' });
      continue;
    }

    // Validate social account
    if (!socialAccountsValid.get(item.socialAccountId)) {
      errors.push({ shortId: item.shortId, error: 'Invalid social account' });
      continue;
    }

    // Validate scheduled time
    const scheduledDate = new Date(item.scheduledFor);
    if (isNaN(scheduledDate.getTime())) {
      errors.push({ shortId: item.shortId, error: 'Invalid scheduled time format' });
      continue;
    }
    if (scheduledDate <= new Date()) {
      errors.push({ shortId: item.shortId, error: 'Scheduled time must be in the future' });
      continue;
    }

    // Create the scheduled post
    try {
      const post = await createScheduledPost(db, {
        organizationId: authResult.organizationId,
        shortId: item.shortId,
        socialAccountId: item.socialAccountId,
        scheduledFor: scheduledDate,
        title: item.title.trim().slice(0, 100),
        description: item.description?.trim(),
        scheduledById: authResult.userId,
      });

      created.push({ shortId: item.shortId, scheduledPostId: post.id });
    } catch (error) {
      console.error('Failed to create scheduled post:', error);
      errors.push({ shortId: item.shortId, error: 'Failed to create scheduled post' });
    }
  }

  // Return results
  const statusCode = created.length > 0 ? 201 : 400;

  return success<BulkCreateResponse>(
    res,
    { created, errors },
    statusCode
  );
}
