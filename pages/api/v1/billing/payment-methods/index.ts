import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createStripeClient,
  getCustomerPaymentMethods,
  getDefaultPaymentMethod,
} from '@/lib/stripe';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return failure(res, 500, 'Payment system not configured');
  }

  const db = getDb();
  const stripe = createStripeClient(stripeSecretKey);

  // Get organization's Stripe customer ID
  const [org] = await db
    .select({ stripeCustomerId: organizations.stripeCustomerId })
    .from(organizations)
    .where(eq(organizations.id, authResult.organizationId))
    .limit(1);

  if (!org?.stripeCustomerId) {
    return success(res, { paymentMethods: [], defaultPaymentMethodId: null });
  }

  const [paymentMethods, defaultPm] = await Promise.all([
    getCustomerPaymentMethods(stripe, org.stripeCustomerId),
    getDefaultPaymentMethod(stripe, org.stripeCustomerId),
  ]);

  return success(res, {
    paymentMethods: paymentMethods.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand,
      last4: pm.card?.last4,
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      isDefault: pm.id === defaultPm?.id,
    })),
    defaultPaymentMethodId: defaultPm?.id ?? null,
  });
}
