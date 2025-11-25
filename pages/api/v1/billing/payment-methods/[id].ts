import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createStripeClient,
  detachPaymentMethod,
  getCustomerPaymentMethods,
  setDefaultPaymentMethod,
} from '@/lib/stripe';
import { disableAutoTopUp } from '@/lib/credits';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const paymentMethodId = req.query.id;
  if (typeof paymentMethodId !== 'string') {
    return failure(res, 400, 'Invalid payment method ID');
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return failure(res, 500, 'Payment system not configured');
  }

  const db = getDb();
  const stripe = createStripeClient(stripeSecretKey);

  try {
    // Get organization's Stripe customer ID
    const [org] = await db
      .select({
        stripeCustomerId: organizations.stripeCustomerId,
        autoTopUpEnabled: organizations.autoTopUpEnabled,
      })
      .from(organizations)
      .where(eq(organizations.id, authResult.organizationId))
      .limit(1);

    if (!org?.stripeCustomerId) {
      return failure(res, 404, 'No payment methods found');
    }

    // Verify the payment method belongs to this organization's customer
    const paymentMethods = await getCustomerPaymentMethods(stripe, org.stripeCustomerId);
    const pmBelongsToOrg = paymentMethods.some((pm) => pm.id === paymentMethodId);

    if (!pmBelongsToOrg) {
      return failure(res, 403, 'Payment method does not belong to this organization');
    }

    // Detach the payment method
    await detachPaymentMethod(stripe, paymentMethodId);

    // Check if there are remaining payment methods
    const remainingMethods = paymentMethods.filter((pm) => pm.id !== paymentMethodId);

    if (remainingMethods.length === 0) {
      // No more payment methods - disable auto top-up
      if (org.autoTopUpEnabled) {
        await disableAutoTopUp(db, authResult.organizationId);
      }
    } else {
      // Set a new default if we deleted the default
      await setDefaultPaymentMethod(stripe, org.stripeCustomerId, remainingMethods[0].id);
    }

    return success(res, {
      deleted: true,
      remainingCount: remainingMethods.length,
    });
  } catch (error) {
    console.error('Delete payment method error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete payment method';
    return failure(res, 500, message);
  }
}
