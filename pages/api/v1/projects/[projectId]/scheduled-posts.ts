import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { getScheduledPostsByProject } from '@server/db/queries/scheduled-posts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const projectId = req.query.projectId as string;
  const db = getDb();

  const results = await getScheduledPostsByProject(db, projectId, authResult.organizationId);

  // Group by shortId for frontend convenience
  const postsByShort: Record<
    string,
    {
      id: string;
      status: string;
      scheduledFor: Date;
      title: string;
      platformPostId: string | null;
      platformUrl: string | null;
      errorMessage: string | null;
      platform: string;
      channelTitle: string | null;
    }[]
  > = {};

  for (const result of results) {
    const shortId = result.post.shortId;
    if (!postsByShort[shortId]) {
      postsByShort[shortId] = [];
    }
    postsByShort[shortId].push({
      id: result.post.id,
      status: result.post.status,
      scheduledFor: result.post.scheduledFor,
      title: result.post.title,
      platformPostId: result.post.platformPostId,
      platformUrl: result.post.platformUrl,
      errorMessage: result.post.errorMessage,
      platform: result.socialAccount.platform,
      channelTitle: result.socialAccount.channelTitle,
    });
  }

  return success(res, { posts: postsByShort });
}
