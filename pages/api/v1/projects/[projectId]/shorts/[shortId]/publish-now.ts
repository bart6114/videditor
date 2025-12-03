import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getShortById } from '@server/db/queries/shorts';
import { getSocialAccountById } from '@server/db/queries/social-accounts';
import {
  createScheduledPost,
  updateScheduledPostStatus,
} from '@server/db/queries/scheduled-posts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { enqueueJob } from '@/lib/jobs';
import type { PublishNowPayload, YouTubePublishPayload } from '@shared/index';

/**
 * POST /api/v1/projects/[projectId]/shorts/[shortId]/publish-now
 *
 * Immediately publish a short to YouTube (or other platforms).
 * Creates a scheduled post with immediate execution.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { shortId } = req.query;
  if (!shortId || typeof shortId !== 'string') {
    return failure(res, 400, 'Short ID is required');
  }

  // Parse request body
  let body: PublishNowPayload;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return failure(res, 400, 'Invalid request body');
  }

  const { socialAccountId, title, description } = body;

  // Validate required fields
  if (!socialAccountId) {
    return failure(res, 400, 'Social account ID is required');
  }
  if (!title || !title.trim()) {
    return failure(res, 400, 'Title is required');
  }

  const db = getDb();

  // Get the short (verifies ownership via organization)
  const short = await getShortById(db, shortId, authResult.organizationId);
  if (!short) {
    return failure(res, 404, 'Short not found');
  }

  // Verify short is completed
  if (short.status !== 'completed') {
    return failure(res, 400, 'Short must be completed before publishing');
  }

  // Verify short has a video
  if (!short.outputObjectKey) {
    return failure(res, 400, 'Short has no video to publish');
  }

  // Get the social account (verifies it belongs to this org)
  const socialAccount = await getSocialAccountById(db, socialAccountId);
  if (!socialAccount || socialAccount.organizationId !== authResult.organizationId) {
    return failure(res, 404, 'Social account not found');
  }

  // Create the scheduled post with immediate execution time
  const scheduledPost = await createScheduledPost(db, {
    organizationId: authResult.organizationId,
    shortId,
    socialAccountId,
    scheduledFor: new Date(), // Now
    title: title.trim().slice(0, 100),
    description: description?.trim(),
    scheduledById: authResult.userId,
  });

  // Immediately update status to publishing
  await updateScheduledPostStatus(db, scheduledPost.id, 'publishing');

  // Enqueue the publish job immediately
  const payload: YouTubePublishPayload = {
    scheduledPostId: scheduledPost.id,
    shortId,
    socialAccountId,
    title: title.trim().slice(0, 100),
    description: description?.trim(),
  };

  const job = await enqueueJob({
    type: 'youtube_publish',
    payload,
  });

  return success(res, {
    scheduledPost: {
      id: scheduledPost.id,
      status: 'publishing',
      title: scheduledPost.title,
      description: scheduledPost.description,
    },
    jobId: job.id,
  }, 201);
}
