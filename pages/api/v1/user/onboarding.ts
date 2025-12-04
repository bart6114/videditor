import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@server/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  // GET - Get all completed tours
  if (req.method === 'GET') {
    const [user] = await db
      .select({ completedTours: users.completedTours })
      .from(users)
      .where(eq(users.id, authResult.userId));

    if (!user) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      completedTours: (user.completedTours || {}) as Record<string, boolean>,
    });
  }

  // PATCH - Mark a specific tour as complete (or reset)
  if (req.method === 'PATCH') {
    const { tourId, completed } = req.body;

    if (!tourId || typeof tourId !== 'string') {
      return failure(res, 400, 'tourId is required');
    }

    // First get current completedTours
    const [user] = await db
      .select({ completedTours: users.completedTours })
      .from(users)
      .where(eq(users.id, authResult.userId));

    if (!user) {
      return failure(res, 404, 'User not found');
    }

    const currentTours = (user.completedTours || {}) as Record<string, boolean>;
    const updatedTours = { ...currentTours, [tourId]: !!completed };

    const [updated] = await db
      .update(users)
      .set({
        completedTours: updatedTours,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authResult.userId))
      .returning({ completedTours: users.completedTours });

    if (!updated) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      completedTours: (updated.completedTours || {}) as Record<string, boolean>,
    });
  }

  return failure(res, 405, 'Method not allowed');
}
