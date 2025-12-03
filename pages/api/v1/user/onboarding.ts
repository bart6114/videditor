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

  // GET - Check onboarding status
  if (req.method === 'GET') {
    const [user] = await db
      .select({ onboardingCompletedAt: users.onboardingCompletedAt })
      .from(users)
      .where(eq(users.id, authResult.userId));

    if (!user) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      onboardingCompleted: !!user.onboardingCompletedAt,
      onboardingCompletedAt: user.onboardingCompletedAt,
    });
  }

  // PATCH - Mark onboarding as complete (or reset)
  if (req.method === 'PATCH') {
    const { completed } = req.body;

    const [updated] = await db
      .update(users)
      .set({
        onboardingCompletedAt: completed ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authResult.userId))
      .returning({ onboardingCompletedAt: users.onboardingCompletedAt });

    if (!updated) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      onboardingCompleted: !!updated.onboardingCompletedAt,
      onboardingCompletedAt: updated.onboardingCompletedAt,
    });
  }

  return failure(res, 405, 'Method not allowed');
}
