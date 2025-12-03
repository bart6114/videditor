import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getShortById } from '@server/db/queries/shorts';
import { getSocialAccountById } from '@server/db/queries/social-accounts';
import { createScheduledPost, hasActiveScheduledPost } from '@server/db/queries/scheduled-posts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import type { ScheduleShortPayload } from '@shared/index';

/**
 * POST /api/v1/projects/[projectId]/shorts/[shortId]/schedule
 *
 * Schedule a short for publishing to YouTube (or other platforms).
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
  let body: ScheduleShortPayload;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return failure(res, 400, 'Invalid request body');
  }

  const { socialAccountId, scheduledFor, title, description } = body;

  // Validate required fields
  if (!socialAccountId) {
    return failure(res, 400, 'Social account ID is required');
  }
  if (!scheduledFor) {
    return failure(res, 400, 'Scheduled time is required');
  }
  if (!title || !title.trim()) {
    return failure(res, 400, 'Title is required');
  }

  // Validate scheduled time is in the future
  const scheduledDate = new Date(scheduledFor);
  if (isNaN(scheduledDate.getTime())) {
    return failure(res, 400, 'Invalid scheduled time format');
  }
  if (scheduledDate <= new Date()) {
    return failure(res, 400, 'Scheduled time must be in the future');
  }

  const db = getDb();

  // Get the short (verifies ownership via organization)
  const short = await getShortById(db, shortId, authResult.organizationId);
  if (!short) {
    return failure(res, 404, 'Short not found');
  }

  // Verify short is completed
  if (short.status !== 'completed') {
    return failure(res, 400, 'Short must be completed before scheduling');
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

  // Check for existing active scheduled post (idempotency protection)
  const hasExisting = await hasActiveScheduledPost(db, shortId, socialAccountId);
  if (hasExisting) {
    return failure(res, 409, 'This short already has an active scheduled post for this account');
  }

  // Create the scheduled post
  const scheduledPost = await createScheduledPost(db, {
    organizationId: authResult.organizationId,
    shortId,
    socialAccountId,
    scheduledFor: scheduledDate,
    title: title.trim().slice(0, 100), // YouTube title limit
    description: description?.trim(),
    scheduledById: authResult.userId,
  });

  return success(res, {
    scheduledPost: {
      id: scheduledPost.id,
      scheduledFor: scheduledPost.scheduledFor,
      status: scheduledPost.status,
      title: scheduledPost.title,
      description: scheduledPost.description,
    },
  }, 201);
}
