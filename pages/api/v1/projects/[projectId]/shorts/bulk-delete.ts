import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { deleteShorts, getShortsByIds } from '@server/db/queries/shorts';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { createTigrisClient, deleteFromTigris } from '@/lib/tigris';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const { shortIds } = req.body as { shortIds: string[] };

  if (!Array.isArray(shortIds) || shortIds.length === 0) {
    return failure(res, 400, 'shortIds must be a non-empty array');
  }

  const db = getDb();

  // Fetch the shorts to get object keys (also verifies ownership)
  const shortsToDelete = await getShortsByIds(db, shortIds, authResult.userId);

  if (shortsToDelete.length === 0) {
    return failure(res, 404, 'No shorts found or you do not have permission');
  }

  const tigrisClient = createTigrisClient();
  const deletePromises: Promise<void>[] = [];

  // Collect all object keys to delete from S3
  for (const short of shortsToDelete) {
    if (short.outputObjectKey) {
      deletePromises.push(deleteFromTigris(tigrisClient, short.outputObjectKey));
    }
    if (short.thumbnailUrl) {
      deletePromises.push(deleteFromTigris(tigrisClient, short.thumbnailUrl));
    }
  }

  // Delete all assets from Tigris (ignore errors for missing files)
  await Promise.allSettled(deletePromises);

  // Delete from database (cascade handles processing_jobs)
  const deleted = await deleteShorts(db, shortIds, authResult.userId);

  return success(res, {
    deleted: deleted.length,
    shortIds: deleted.map((s) => s.id),
  });
}
