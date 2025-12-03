import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { getDb } from '@server/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createStripeClient,
  constructWebhookEvent,
} from '@/lib/stripe';
import {
  addCredits,
  disableAutoTopUp,
  setStripeCustomerId,
  type SupportedCurrency,
} from '@/lib/credits';

// Disable body parsing, we need raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Missing Stripe configuration');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const stripe = createStripeClient(stripeSecretKey);
  const signature = req.headers['stripe-signature'];

  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    event = constructWebhookEvent(stripe, rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  const db = getDb();

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSucceeded(db, paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailed(db, paymentIntent);
        break;
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent;
        await handleSetupIntentSucceeded(db, stripe, setupIntent);
        break;
      }

      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        await handleCustomerCreated(db, customer);
        break;
      }

      default:
        // Log unhandled event types for debugging
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Handle successful payment (credit purchase or auto top-up)
 */
async function handlePaymentSucceeded(db: ReturnType<typeof getDb>, paymentIntent: Stripe.PaymentIntent) {
  const { metadata } = paymentIntent;
  const type = metadata?.type;
  const creditAmount = parseInt(metadata?.creditAmount ?? '0', 10);

  if (!creditAmount || creditAmount <= 0) {
    console.log('Payment succeeded but no credit amount in metadata');
    return;
  }

  // Get organization from customer
  const customerId = paymentIntent.customer as string;
  if (!customerId) {
    console.error('Payment succeeded but no customer ID');
    return;
  }

  // Find organization by Stripe customer ID
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);

  if (!org) {
    console.error(`No organization found for Stripe customer ${customerId}`);
    return;
  }

  // Determine transaction type
  const transactionType = type === 'auto_topup' ? 'auto_topup' : 'purchase';

  // Extract currency info from metadata
  const currency = (metadata?.currency as SupportedCurrency) || 'USD';
  const exchangeRate = parseFloat(metadata?.exchangeRate ?? '1.16');
  const amountCents = paymentIntent.amount; // Amount in cents from the payment

  // Add credits to organization (no performedById for webhook-initiated transactions)
  await addCredits(
    db,
    org.id,
    creditAmount,
    transactionType,
    {
      description: type === 'auto_topup'
        ? `Auto top-up: ${creditAmount} credits`
        : `Purchased ${creditAmount} credits`,
      currency,
      amountCents,
      exchangeRate,
    },
    paymentIntent.id
  );

  console.log(`Added ${creditAmount} credits to organization ${org.id} (${transactionType}, ${currency})`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(db: ReturnType<typeof getDb>, paymentIntent: Stripe.PaymentIntent) {
  const { metadata } = paymentIntent;
  const type = metadata?.type;

  // If this was an auto top-up, disable auto top-up for the organization
  if (type === 'auto_topup') {
    const customerId = paymentIntent.customer as string;
    if (!customerId) return;

    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.stripeCustomerId, customerId))
      .limit(1);

    if (org) {
      await disableAutoTopUp(db, org.id);
      console.log(`Disabled auto top-up for organization ${org.id} due to payment failure`);
    }
  }
}

/**
 * Handle successful setup intent (payment method saved)
 */
async function handleSetupIntentSucceeded(
  db: ReturnType<typeof getDb>,
  stripe: Stripe,
  setupIntent: Stripe.SetupIntent
) {
  const customerId = setupIntent.customer as string;
  const paymentMethodId = setupIntent.payment_method as string;

  if (!customerId || !paymentMethodId) return;

  // Set as default payment method for the customer
  try {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    console.log(`Set default payment method for customer ${customerId}`);
  } catch (err) {
    console.error('Failed to set default payment method:', err);
  }
}

/**
 * Handle customer created (sync Stripe customer ID to organization)
 */
async function handleCustomerCreated(db: ReturnType<typeof getDb>, customer: Stripe.Customer) {
  const organizationId = customer.metadata?.organizationId;

  if (!organizationId) {
    console.log('Customer created without organizationId in metadata');
    return;
  }

  // Update organization with Stripe customer ID
  await setStripeCustomerId(db, organizationId, customer.id);
  console.log(`Linked Stripe customer ${customer.id} to organization ${organizationId}`);
}
