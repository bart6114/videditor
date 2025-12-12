import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { isUserAdmin } from '@server/db/queries/users';
import {
  getScheduledPostById,
  updateScheduledPostStatus,
} from '@server/db/queries/scheduled-posts';
import { getSocialAccountById, getSocialAccountByOrgAndPlatform } from '@server/db/queries/social-accounts';
import { enqueueJob } from '@/lib/jobs';
import type { YouTubePublishPayload, InstagramPublishPayload } from '@shared/index';

/**
 * POST /api/v1/admin/replay-scheduled-post
 *
 * Replays (re-publishes) a scheduled post by its ID.
 * Admin-only endpoint - no ownership check required.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  // Verify admin
  const isAdmin = await isUserAdmin(db, authResult.userId);
  if (!isAdmin) {
    return failure(res, 403, 'Admin access required');
  }

  // Parse request body
  let body: { scheduledPostId: string };
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return failure(res, 400, 'Invalid request body');
  }

  const { scheduledPostId } = body;
  if (!scheduledPostId || typeof scheduledPostId !== 'string') {
    return failure(res, 400, 'scheduledPostId is required');
  }

  // Get the scheduled post (no ownership check - admin can replay any)
  const post = await getScheduledPostById(db, scheduledPostId);
  if (!post) {
    return failure(res, 404, 'Scheduled post not found');
  }

  // Get the social account - try by ID first, fallback to lookup by org+platform
  let socialAccount = post.socialAccountId
    ? await getSocialAccountById(db, post.socialAccountId)
    : null;

  // If account was disconnected (socialAccountId is null or account deleted),
  // try to find a reconnected account for the same platform
  if (!socialAccount) {
    socialAccount = await getSocialAccountByOrgAndPlatform(
      db,
      post.organizationId,
      post.platform
    );
  }

  if (!socialAccount) {
    return failure(res, 404, `No ${post.platform} account connected. Please reconnect and try again.`);
  }

  // Update status to publishing and increment retry count
  await updateScheduledPostStatus(db, post.id, 'publishing', {
    errorMessage: undefined,
    retryCount: (post.retryCount ?? 0) + 1,
  });

  // Enqueue the appropriate publish job
  let job;
  const platform = post.platform;

  if (platform === 'instagram') {
    const payload: InstagramPublishPayload = {
      scheduledPostId: post.id,
      shortId: post.shortId,
      socialAccountId: socialAccount.id,
      caption: post.description || post.title,
    };

    job = await enqueueJob({
      type: 'instagram_publish',
      payload,
    });
  } else {
    // Default to YouTube
    const payload: YouTubePublishPayload = {
      scheduledPostId: post.id,
      shortId: post.shortId,
      socialAccountId: socialAccount.id,
      title: post.title,
      description: post.description ?? undefined,
    };

    job = await enqueueJob({
      type: 'youtube_publish',
      payload,
    });
  }

  return success(res, {
    message: 'Scheduled post replay initiated',
    scheduledPostId: post.id,
    platform,
    jobId: job.id,
    retryCount: (post.retryCount ?? 0) + 1,
  });
}
