import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate, requireOwner } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  getOrganizationById,
  updateOrganization,
  isUserMemberOfOrganization,
  getOrganizationMemberCount,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return failure(res, 400, 'Organization ID is required');
  }

  const db = getDb();

  // Verify user is a member
  const isMember = await isUserMemberOfOrganization(db, authResult.userId, id);
  if (!isMember) {
    return failure(res, 403, 'You are not a member of this organization');
  }

  if (req.method === 'GET') {
    const organization = await getOrganizationById(db, id);
    if (!organization) {
      return failure(res, 404, 'Organization not found');
    }

    const memberCount = await getOrganizationMemberCount(db, id);

    return success(res, {
      organization: {
        ...organization,
        memberCount,
      },
    });
  }

  if (req.method === 'PATCH') {
    // Only owners can update organization
    if (!requireOwner(authResult) || authResult.organizationId !== id) {
      // Need to check if user is owner of THIS organization, not their default
      const { isUserOwnerOfOrganization } = await import('@server/db/queries/organizations');
      const isOwner = await isUserOwnerOfOrganization(db, authResult.userId, id);
      if (!isOwner) {
        return failure(res, 403, 'Only organization owners can update settings');
      }
    }

    const { name } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      return failure(res, 400, 'Organization name must be a non-empty string');
    }

    const updates: { name?: string } = {};
    if (name) {
      updates.name = name.trim();
    }

    if (Object.keys(updates).length === 0) {
      return failure(res, 400, 'No valid updates provided');
    }

    const organization = await updateOrganization(db, id, updates);
    if (!organization) {
      return failure(res, 404, 'Organization not found');
    }

    return success(res, { organization });
  }

  return failure(res, 405, 'Method not allowed');
}
