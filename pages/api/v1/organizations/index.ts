import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import {
  getUserOrganizations,
  createOrganizationWithOwner,
} from '@server/db/queries/organizations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  if (req.method === 'GET') {
    // List all organizations the user is a member of
    const organizations = await getUserOrganizations(db, authResult.userId);
    return success(res, { organizations });
  }

  if (req.method === 'POST') {
    // Create a new organization
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return failure(res, 400, 'Organization name is required');
    }

    const organization = await createOrganizationWithOwner(db, {
      name: name.trim(),
      ownerId: authResult.userId,
      setAsDefault: false, // Don't change default when creating additional orgs
    });

    return success(res, { organization }, 201);
  }

  return failure(res, 405, 'Method not allowed');
}
