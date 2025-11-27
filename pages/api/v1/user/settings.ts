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
  defaultSocialPrompt: z.string().max(2000).nullable().optional(),
  defaultSocialPlatforms: z.array(z.enum(SOCIAL_PLATFORMS)).optional(),
  defaultAvoidOverlap: z.boolean().optional(),
  defaultPreferredLength: z.number().int().min(15).max(120).optional(),
  defaultMaxLength: z.number().int().min(15).max(120).optional(),
}).refine(
  (data) => {
    // If both are provided, maxLength must be >= preferredLength
    if (data.defaultPreferredLength !== undefined && data.defaultMaxLength !== undefined) {
      return data.defaultMaxLength >= data.defaultPreferredLength;
    }
    return true;
  },
  { message: 'Max length must be greater than or equal to preferred length' }
);

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
        defaultSocialPrompt: users.defaultSocialPrompt,
        defaultSocialPlatforms: users.defaultSocialPlatforms,
        defaultAvoidOverlap: users.defaultAvoidOverlap,
        defaultPreferredLength: users.defaultPreferredLength,
        defaultMaxLength: users.defaultMaxLength,
      })
      .from(users)
      .where(eq(users.id, authResult.userId));

    if (!user) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      settings: {
        defaultCustomPrompt: user.defaultCustomPrompt,
        defaultSocialPrompt: user.defaultSocialPrompt,
        defaultSocialPlatforms: (user.defaultSocialPlatforms || []) as SocialPlatform[],
        defaultAvoidOverlap: user.defaultAvoidOverlap ?? false,
        defaultPreferredLength: user.defaultPreferredLength ?? 45,
        defaultMaxLength: user.defaultMaxLength ?? 60,
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
    if (parsed.data.defaultSocialPrompt !== undefined) {
      updateData.defaultSocialPrompt = parsed.data.defaultSocialPrompt ?? null;
    }
    if (parsed.data.defaultSocialPlatforms !== undefined) {
      updateData.defaultSocialPlatforms = parsed.data.defaultSocialPlatforms;
    }
    if (parsed.data.defaultAvoidOverlap !== undefined) {
      updateData.defaultAvoidOverlap = parsed.data.defaultAvoidOverlap;
    }
    if (parsed.data.defaultPreferredLength !== undefined) {
      updateData.defaultPreferredLength = parsed.data.defaultPreferredLength;
    }
    if (parsed.data.defaultMaxLength !== undefined) {
      updateData.defaultMaxLength = parsed.data.defaultMaxLength;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, authResult.userId))
      .returning({
        defaultCustomPrompt: users.defaultCustomPrompt,
        defaultSocialPrompt: users.defaultSocialPrompt,
        defaultSocialPlatforms: users.defaultSocialPlatforms,
        defaultAvoidOverlap: users.defaultAvoidOverlap,
        defaultPreferredLength: users.defaultPreferredLength,
        defaultMaxLength: users.defaultMaxLength,
      });

    if (!updated) {
      return failure(res, 404, 'User not found');
    }

    return success(res, {
      settings: {
        defaultCustomPrompt: updated.defaultCustomPrompt,
        defaultSocialPrompt: updated.defaultSocialPrompt,
        defaultSocialPlatforms: (updated.defaultSocialPlatforms || []) as SocialPlatform[],
        defaultAvoidOverlap: updated.defaultAvoidOverlap ?? false,
        defaultPreferredLength: updated.defaultPreferredLength ?? 45,
        defaultMaxLength: updated.defaultMaxLength ?? 60,
      }
    });
  }

  return failure(res, 405, 'Method not allowed');
}
