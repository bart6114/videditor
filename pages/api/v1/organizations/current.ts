import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  getUserDefaultOrganization,
  getOrganizationMemberCount,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();
  const organization = await getUserDefaultOrganization(db, authResult.userId);

  if (!organization) {
    return failure(res, 404, 'No organization found');
  }

  // Get member count
  const memberCount = await getOrganizationMemberCount(db, organization.id);

  return success(res, {
    organization: {
      ...organization,
      memberCount,
    },
  });
}
