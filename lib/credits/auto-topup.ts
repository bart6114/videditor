import type { DB } from '@server/db';
import { organizations } from '@server/db/schema';
import { eq } from 'drizzle-orm';
import {
  createStripeClient,
  getDefaultPaymentMethod,
  chargeAutoTopUp,
} from '@/lib/stripe';
import { addCredits, disableAutoTopUp } from './index';

/**
 * Check if auto top-up should be triggered and execute it if needed.
 * This is called after credit deduction to replenish credits if below threshold.
 * @param db - Database instance
 * @param organizationId - Organization ID
 */
export async function triggerAutoTopUpIfNeeded(db: DB, organizationId: string): Promise<void> {
  // Get organization's credit info and auto top-up settings
  const [org] = await db
    .select({
      credits: organizations.credits,
      stripeCustomerId: organizations.stripeCustomerId,
      autoTopUpEnabled: organizations.autoTopUpEnabled,
      autoTopUpThreshold: organizations.autoTopUpThreshold,
      autoTopUpAmount: organizations.autoTopUpAmount,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org) {
    return;
  }

  // Check if auto top-up is enabled and needed
  if (!org.autoTopUpEnabled) {
    return;
  }

  const threshold = org.autoTopUpThreshold ?? 5;
  if (org.credits >= threshold) {
    return; // Balance is above threshold, no top-up needed
  }

  // Check if we have a Stripe customer
  if (!org.stripeCustomerId) {
    console.log(`Auto top-up skipped for organization ${organizationId}: no Stripe customer`);
    await disableAutoTopUp(db, organizationId);
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('Auto top-up failed: STRIPE_SECRET_KEY not set');
    return;
  }

  const stripe = createStripeClient(stripeSecretKey);

  // Get default payment method
  const defaultPm = await getDefaultPaymentMethod(stripe, org.stripeCustomerId);
  if (!defaultPm) {
    console.log(`Auto top-up skipped for organization ${organizationId}: no payment method`);
    await disableAutoTopUp(db, organizationId);
    return;
  }

  const topUpAmount = org.autoTopUpAmount ?? 10;

  try {
    // Charge the card
    const paymentIntent = await chargeAutoTopUp(
      stripe,
      org.stripeCustomerId,
      topUpAmount,
      defaultPm.id
    );

    if (paymentIntent.status === 'succeeded') {
      // Add credits
      await addCredits(
        db,
        organizationId,
        topUpAmount,
        'auto_topup',
        { description: `Auto top-up: ${topUpAmount} credits` },
        paymentIntent.id
      );

      console.log(`Auto top-up successful for organization ${organizationId}: +${topUpAmount} credits`);
    } else {
      // Payment requires additional action - this shouldn't happen for off_session
      console.error(`Auto top-up payment requires action for organization ${organizationId}`);
      await disableAutoTopUp(db, organizationId);
    }
  } catch (error) {
    // Payment failed - disable auto top-up
    console.error(`Auto top-up failed for organization ${organizationId}:`, error);
    await disableAutoTopUp(db, organizationId);
  }
}
