import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';

const updateSettingsSchema = z.object({
  defaultCustomPrompt: z.string().max(2000).nullable().optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  if (req.method === 'GET') {
    const [user] = await db
      .select({ defaultCustomPrompt: users.defaultCustomPrompt })
      .from(users)
      .where(eq(users.id, authResult.userId));

    if (!user) {
      return failure(res, 404, 'User not found');
    }

    return success(res, { settings: { defaultCustomPrompt: user.defaultCustomPrompt } });
  }

  if (req.method === 'PATCH') {
    const parsed = updateSettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      return failure(res, 400, 'Invalid settings payload', parsed.error.flatten());
    }

    const [updated] = await db
      .update(users)
      .set({
        defaultCustomPrompt: parsed.data.defaultCustomPrompt ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, authResult.userId))
      .returning({ defaultCustomPrompt: users.defaultCustomPrompt });

    if (!updated) {
      return failure(res, 404, 'User not found');
    }

    return success(res, { settings: { defaultCustomPrompt: updated.defaultCustomPrompt } });
  }

  return failure(res, 405, 'Method not allowed');
}
