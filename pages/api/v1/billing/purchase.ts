import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { organizations, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  createStripeClient,
  createCreditPurchasePaymentIntent,
  getOrCreateCustomer,
  getDefaultPaymentMethod,
  calculateAmountInCents,
} from '@/lib/stripe';
import {
  addCredits,
  setStripeCustomerId,
  MIN_PURCHASE_CREDITS,
  getOrganizationCredits,
  type SupportedCurrency,
} from '@/lib/credits';
import { EUR_TO_USD_RATE } from '@/lib/currency';
import { detectCurrencyFromIP, getClientIP } from '@/lib/currency/geo-detection';

const purchaseSchema = z.object({
  creditAmount: z.number().int().min(MIN_PURCHASE_CREDITS),
  paymentMethodId: z.string().optional(), // If provided, charge immediately
  currency: z.enum(['EUR', 'USD']).optional(), // If not provided, auto-detect or use org preference
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    return failure(res, 400, 'Invalid request body', parsed.error.flatten());
  }

  const { creditAmount, paymentMethodId, currency: requestedCurrency } = parsed.data;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    return failure(res, 500, 'Payment system not configured');
  }

  const stripe = createStripeClient(stripeSecretKey);
  const db = getDb();

  try {
    // Get organization with Stripe customer ID and preferred currency
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        stripeCustomerId: organizations.stripeCustomerId,
        preferredCurrency: organizations.preferredCurrency,
      })
      .from(organizations)
      .where(eq(organizations.id, authResult.organizationId))
      .limit(1);

    if (!org) {
      return failure(res, 404, 'Organization not found');
    }

    // Get user email for Stripe customer creation
    const [user] = await db
      .select({ email: users.email, fullName: users.fullName })
      .from(users)
      .where(eq(users.id, authResult.userId))
      .limit(1);

    // Get or create Stripe customer for the organization
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      customerId = await getOrCreateCustomer(
        stripe,
        authResult.organizationId, // Use org ID as customer ID prefix
        user?.email,
        org.name
      );
      await setStripeCustomerId(db, authResult.organizationId, customerId);
    }

    // Determine which payment method to use
    let pmToUse = paymentMethodId;
    if (!pmToUse) {
      // Try to get default payment method
      const defaultPm = await getDefaultPaymentMethod(stripe, customerId);
      pmToUse = defaultPm?.id;
    }

    // Determine currency: requested > org preference > auto-detect from IP
    let currency: SupportedCurrency = requestedCurrency ?? (org.preferredCurrency as SupportedCurrency | null) ?? 'USD';
    if (!requestedCurrency && !org.preferredCurrency) {
      // Auto-detect from IP
      const clientIP = getClientIP(req.headers as Record<string, string | string[] | undefined>);
      if (clientIP) {
        currency = await detectCurrencyFromIP(clientIP);
      }
    }

    // Create payment intent with currency
    const paymentIntent = await createCreditPurchasePaymentIntent(
      stripe,
      customerId,
      creditAmount,
      currency,
      pmToUse
    );

    const amountInCents = calculateAmountInCents(creditAmount, currency);

    // If payment was confirmed immediately (had payment method)
    if (paymentIntent.status === 'succeeded') {
      // Add credits (webhook will also handle this, but do it here for immediate feedback)
      await addCredits(
        db,
        authResult.organizationId,
        creditAmount,
        'purchase',
        {
          description: `Purchased ${creditAmount} credits`,
          performedById: authResult.userId,
          currency,
          amountCents: amountInCents,
          exchangeRate: EUR_TO_USD_RATE,
        },
        paymentIntent.id
      );

      const newBalance = await getOrganizationCredits(db, authResult.organizationId);

      return success(res, {
        success: true,
        newBalance,
        paymentIntentId: paymentIntent.id,
        currency,
      });
    }

    // Payment requires additional action (3D Secure, etc.) or no payment method
    return success(res, {
      success: false,
      requiresAction: paymentIntent.status === 'requires_action',
      requiresPaymentMethod: paymentIntent.status === 'requires_payment_method',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      creditAmount,
      currency,
    });
  } catch (error) {
    console.error('Purchase error:', error);
    const message = error instanceof Error ? error.message : 'Payment failed';
    return failure(res, 500, message);
  }
}
