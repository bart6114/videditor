import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import type { DB } from '../index';
import {
  scheduledPosts,
  shorts,
  socialAccounts,
  projects,
  type NewScheduledPost,
  type ScheduledPost,
} from '../schema';
import crypto from 'crypto';

// ============================================================================
// Scheduled Post CRUD
// ============================================================================

/**
 * Create a new scheduled post
 */
export async function createScheduledPost(
  db: DB,
  data: Omit<NewScheduledPost, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ScheduledPost> {
  const id = `spost_${crypto.randomUUID()}`;
  const [post] = await db
    .insert(scheduledPosts)
    .values({ ...data, id })
    .returning();
  return post;
}

/**
 * Get scheduled post by ID
 */
export async function getScheduledPostById(
  db: DB,
  postId: string
): Promise<ScheduledPost | null> {
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, postId))
    .limit(1);
  return post ?? null;
}

/**
 * Get scheduled post by ID with ownership verification
 */
export async function getScheduledPostByIdWithOwnership(
  db: DB,
  postId: string,
  organizationId: string
): Promise<ScheduledPost | null> {
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.id, postId),
        eq(scheduledPosts.organizationId, organizationId)
      )
    )
    .limit(1);
  return post ?? null;
}

/**
 * Get all scheduled posts for an organization
 */
export async function getScheduledPostsByOrganization(
  db: DB,
  organizationId: string
): Promise<ScheduledPost[]> {
  return db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.organizationId, organizationId))
    .orderBy(scheduledPosts.scheduledFor);
}

/**
 * Get scheduled posts for a short
 */
export async function getScheduledPostsByShort(
  db: DB,
  shortId: string
): Promise<ScheduledPost[]> {
  return db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.shortId, shortId))
    .orderBy(scheduledPosts.scheduledFor);
}

/**
 * Get scheduled posts for calendar view (with short and project info)
 */
export async function getScheduledPostsForCalendar(
  db: DB,
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<
  {
    post: ScheduledPost;
    short: { id: string; thumbnailUrl: string | null; transcriptionSlice: string };
    project: { id: string; title: string };
    socialAccount: { platform: 'youtube' | 'tiktok' | 'instagram'; channelTitle: string | null };
  }[]
> {
  const results = await db
    .select({
      post: scheduledPosts,
      short: {
        id: shorts.id,
        thumbnailUrl: shorts.thumbnailUrl,
        transcriptionSlice: shorts.transcriptionSlice,
      },
      project: {
        id: projects.id,
        title: projects.title,
      },
      socialAccount: {
        platform: socialAccounts.platform,
        channelTitle: socialAccounts.channelTitle,
      },
    })
    .from(scheduledPosts)
    .innerJoin(shorts, eq(scheduledPosts.shortId, shorts.id))
    .innerJoin(projects, eq(shorts.projectId, projects.id))
    .innerJoin(socialAccounts, eq(scheduledPosts.socialAccountId, socialAccounts.id))
    .where(
      and(
        eq(scheduledPosts.organizationId, organizationId),
        gte(scheduledPosts.scheduledFor, startDate),
        lte(scheduledPosts.scheduledFor, endDate)
      )
    )
    .orderBy(scheduledPosts.scheduledFor);

  return results;
}

/**
 * Update scheduled post
 */
export async function updateScheduledPost(
  db: DB,
  postId: string,
  data: Partial<Omit<ScheduledPost, 'id' | 'createdAt'>>
): Promise<ScheduledPost | null> {
  const [post] = await db
    .update(scheduledPosts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(scheduledPosts.id, postId))
    .returning();
  return post ?? null;
}

/**
 * Update scheduled post status
 */
export async function updateScheduledPostStatus(
  db: DB,
  postId: string,
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled',
  extra?: {
    errorMessage?: string;
    platformPostId?: string;
    platformUrl?: string;
    publishedAt?: Date;
    retryCount?: number;
  }
): Promise<ScheduledPost | null> {
  const updateData: Partial<ScheduledPost> = {
    status,
    updatedAt: new Date(),
    ...extra,
  };

  const [post] = await db
    .update(scheduledPosts)
    .set(updateData)
    .where(eq(scheduledPosts.id, postId))
    .returning();
  return post ?? null;
}

/**
 * Cancel scheduled post
 */
export async function cancelScheduledPost(
  db: DB,
  postId: string,
  organizationId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const post = await getScheduledPostByIdWithOwnership(db, postId, organizationId);
  if (!post) {
    return { success: false, error: 'Scheduled post not found' };
  }

  if (post.status !== 'scheduled') {
    return { success: false, error: 'Can only cancel posts that are still scheduled' };
  }

  await updateScheduledPostStatus(db, postId, 'canceled');
  return { success: true };
}

/**
 * Cancel all pending scheduled posts for a social account
 * Used when disconnecting an account
 */
export async function cancelAllPendingPostsForAccount(
  db: DB,
  socialAccountId: string
): Promise<number> {
  const result = await db
    .update(scheduledPosts)
    .set({ status: 'canceled', updatedAt: new Date() })
    .where(
      and(
        eq(scheduledPosts.socialAccountId, socialAccountId),
        eq(scheduledPosts.status, 'scheduled')
      )
    );

  return result.rowCount ?? 0;
}

/**
 * Delete scheduled post
 */
export async function deleteScheduledPost(
  db: DB,
  postId: string
): Promise<void> {
  await db.delete(scheduledPosts).where(eq(scheduledPosts.id, postId));
}

/**
 * Check if short already has a scheduled/publishing post for a platform
 */
export async function hasActiveScheduledPost(
  db: DB,
  shortId: string,
  socialAccountId: string
): Promise<boolean> {
  const [existing] = await db
    .select({ id: scheduledPosts.id })
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.shortId, shortId),
        eq(scheduledPosts.socialAccountId, socialAccountId),
        inArray(scheduledPosts.status, ['scheduled', 'publishing'])
      )
    )
    .limit(1);
  return !!existing;
}

/**
 * Get count of scheduled posts by status for an organization
 */
export async function getScheduledPostsCountByStatus(
  db: DB,
  organizationId: string
): Promise<Record<string, number>> {
  const results = await db
    .select({
      status: scheduledPosts.status,
      count: sql<number>`count(*)::int`,
    })
    .from(scheduledPosts)
    .where(eq(scheduledPosts.organizationId, organizationId))
    .groupBy(scheduledPosts.status);

  return results.reduce(
    (acc, row) => {
      acc[row.status] = row.count;
      return acc;
    },
    {} as Record<string, number>
  );
}
