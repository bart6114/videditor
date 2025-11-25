import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { organizations, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createStripeClient,
  getOrCreateCustomer,
  createSetupIntent,
} from '@/lib/stripe';
import { setStripeCustomerId } from '@/lib/credits';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
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

  try {
    // Get organization with Stripe customer ID
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        stripeCustomerId: organizations.stripeCustomerId,
      })
      .from(organizations)
      .where(eq(organizations.id, authResult.organizationId))
      .limit(1);

    if (!org) {
      return failure(res, 404, 'Organization not found');
    }

    // Get user email for Stripe customer creation
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, authResult.userId))
      .limit(1);

    // Get or create Stripe customer for the organization
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      customerId = await getOrCreateCustomer(
        stripe,
        authResult.organizationId,
        user?.email,
        org.name
      );
      await setStripeCustomerId(db, authResult.organizationId, customerId);
    }

    // Create setup intent
    const setupIntent = await createSetupIntent(stripe, customerId);

    return success(res, {
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    console.error('Setup intent error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create setup intent';
    return failure(res, 500, message);
  }
}
