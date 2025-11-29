import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import {
  getScheduledPostByIdWithOwnership,
  updateScheduledPost,
  cancelScheduledPost,
} from '@server/db/queries/scheduled-posts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

/**
 * PATCH /api/v1/scheduled-posts/[id]
 * Update a scheduled post (reschedule, change title/description)
 * Only allowed for posts with status='scheduled'
 *
 * DELETE /api/v1/scheduled-posts/[id]
 * Cancel a scheduled post
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return failure(res, 400, 'Scheduled post ID is required');
  }

  const db = getDb();

  // Get the post and verify ownership
  const post = await getScheduledPostByIdWithOwnership(db, id, authResult.organizationId);
  if (!post) {
    return failure(res, 404, 'Scheduled post not found');
  }

  if (req.method === 'PATCH') {
    // Only allow updates to scheduled posts
    if (post.status !== 'scheduled') {
      return failure(res, 400, 'Can only update posts that are still scheduled');
    }

    // Parse body
    let body: { scheduledFor?: string; title?: string; description?: string };
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return failure(res, 400, 'Invalid request body');
    }

    const updates: Parameters<typeof updateScheduledPost>[2] = {};

    // Validate and apply scheduledFor update
    if (body.scheduledFor !== undefined) {
      const scheduledDate = new Date(body.scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return failure(res, 400, 'Invalid scheduled time format');
      }
      if (scheduledDate <= new Date()) {
        return failure(res, 400, 'Scheduled time must be in the future');
      }
      updates.scheduledFor = scheduledDate;
    }

    // Validate and apply title update
    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return failure(res, 400, 'Title cannot be empty');
      }
      updates.title = body.title.trim().slice(0, 100);
    }

    // Apply description update
    if (body.description !== undefined) {
      updates.description = body.description?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return failure(res, 400, 'No valid updates provided');
    }

    const updatedPost = await updateScheduledPost(db, id, updates);

    return success(res, {
      scheduledPost: {
        id: updatedPost!.id,
        scheduledFor: updatedPost!.scheduledFor,
        status: updatedPost!.status,
        title: updatedPost!.title,
        description: updatedPost!.description,
      },
    });
  }

  if (req.method === 'DELETE') {
    const result = await cancelScheduledPost(db, id, authResult.organizationId);

    if (!result.success) {
      return failure(res, 400, result.error);
    }

    return success(res, { canceled: true });
  }

  return failure(res, 405, 'Method not allowed');
}
