import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { deleteShort, getShortById } from '@server/db/queries/shorts';
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

  const shortId = req.query.shortId as string;
  const db = getDb();

  // Fetch the short to get object keys (also verifies ownership)
  const short = await getShortById(db, shortId, authResult.userId);

  if (!short) {
    return failure(res, 404, 'Short not found');
  }

  const tigrisClient = createTigrisClient();
  const deletePromises: Promise<void>[] = [];

  // Collect all object keys to delete
  if (short.outputObjectKey) {
    deletePromises.push(deleteFromTigris(tigrisClient, short.outputObjectKey));
  }
  if (short.thumbnailUrl) {
    deletePromises.push(deleteFromTigris(tigrisClient, short.thumbnailUrl));
  }

  // Delete all assets from Tigris (ignore errors for missing files)
  await Promise.allSettled(deletePromises);

  // Delete from database (cascade handles processing_jobs)
  await deleteShort(db, shortId, authResult.userId);

  return success(res, { deleted: true });
}
