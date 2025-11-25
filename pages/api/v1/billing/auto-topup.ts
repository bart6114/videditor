import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  updateAutoTopUpSettings,
  getUserCreditInfo,
  MIN_PURCHASE_CREDITS,
} from '@/lib/credits';
import { createStripeClient, getDefaultPaymentMethod } from '@/lib/stripe';

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().int().min(1).max(100).optional(),
  amount: z.number().int().min(MIN_PURCHASE_CREDITS).max(1000).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 400, 'Invalid request body', parsed.error.flatten());
  }

  const { enabled, threshold, amount } = parsed.data;
  const db = getDb();

  // If enabling auto top-up, verify payment method exists
  if (enabled === true) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return failure(res, 500, 'Payment system not configured');
    }

    const creditInfo = await getUserCreditInfo(db, authResult.organizationId);
    if (!creditInfo?.stripeCustomerId) {
      return failure(res, 400, 'Please add a payment method before enabling auto top-up');
    }

    const stripe = createStripeClient(stripeSecretKey);
    const defaultPm = await getDefaultPaymentMethod(stripe, creditInfo.stripeCustomerId);
    if (!defaultPm) {
      return failure(res, 400, 'Please add a payment method before enabling auto top-up');
    }
  }

  await updateAutoTopUpSettings(db, authResult.organizationId, {
    enabled,
    threshold,
    amount,
  });

  // Get updated settings
  const [updated] = await db
    .select({
      autoTopUpEnabled: organizations.autoTopUpEnabled,
      autoTopUpThreshold: organizations.autoTopUpThreshold,
      autoTopUpAmount: organizations.autoTopUpAmount,
    })
    .from(organizations)
    .where(eq(organizations.id, authResult.organizationId))
    .limit(1);

  return success(res, {
    autoTopUpEnabled: updated?.autoTopUpEnabled ?? false,
    autoTopUpThreshold: updated?.autoTopUpThreshold ?? 5,
    autoTopUpAmount: updated?.autoTopUpAmount ?? 10,
  });
}
