import Stripe from 'stripe'

// Initialize Stripe with Workers-compatible HTTP client
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

/**
 * Create Stripe customer
 * Email is optional - can be collected later during checkout
 */
export async function createCustomer(
  stripe: Stripe,
  email: string | null,
  userId: string,
  name?: string
): Promise<string> {
  const customer = await stripe.customers.create({
    ...(email && { email }), // Only include email if provided
    name,
    metadata: {
      userId,
    },
  })
  return customer.id
}

/**
 * Create checkout session for subscription
 * Email is optional - Stripe will collect it during checkout if not provided
 */
export async function createCheckoutSession(
  stripe: Stripe,
  userId: string,
  email: string | null,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ...(email && { customer_email: email }), // Only include if provided, Stripe will collect otherwise
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId,
    },
  })

  return session
}

/**
 * Create billing portal session
 */
export async function createBillingPortalSession(
  stripe: Stripe,
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(
  stripe: Stripe,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.cancel(subscriptionId)
}

/**
 * Calculate cost for video processing
 */
export function calculateVideoCost(durationInSeconds: number): number {
  // $0.01 per second
  return Math.round(durationInSeconds) * PRICE_PER_SECOND
}

// Configuration
export const PAYMENT_ENABLED = true // Enable payments
export const PRICE_PER_SECOND = 0.01
