import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { getDb } from '@server/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@shared/index';

const updateSettingsSchema = z.object({
  defaultCustomPrompt: z.string().max(2000).nullable().optional(),
  defaultSocialPlatforms: z.array(z.enum(SOCIAL_PLATFORMS)).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  if (req.method === 'GET') {
    const [user] = await db
      .select({
        defaultCustomPrompt: users.defaultCustomPrompt,
        defaultSocialPlatforms: users.defaultSocialPlatforms,
      })
      .from(users)
      .where(eq(users.id, authResult.userId));

    if (!user) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      settings: {
        defaultCustomPrompt: user.defaultCustomPrompt,
        defaultSocialPlatforms: (user.defaultSocialPlatforms || []) as SocialPlatform[],
      }
    });
  }

  if (req.method === 'PATCH') {
    const parsed = updateSettingsSchema.safeParse(req.body);

    if (!parsed.success) {
      return failure(res, 400, 'Invalid settings payload', parsed.error.flatten());
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.defaultCustomPrompt !== undefined) {
      updateData.defaultCustomPrompt = parsed.data.defaultCustomPrompt ?? null;
    }
    if (parsed.data.defaultSocialPlatforms !== undefined) {
      updateData.defaultSocialPlatforms = parsed.data.defaultSocialPlatforms;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, authResult.userId))
      .returning({
        defaultCustomPrompt: users.defaultCustomPrompt,
        defaultSocialPlatforms: users.defaultSocialPlatforms,
      });

    if (!updated) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      settings: {
        defaultCustomPrompt: updated.defaultCustomPrompt,
        defaultSocialPlatforms: (updated.defaultSocialPlatforms || []) as SocialPlatform[],
      }
    });
  }

  return failure(res, 405, 'Method not allowed');
}
