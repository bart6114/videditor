import Stripe from 'stripe'

// Initialize Stripe (will be used when payments are enabled)
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    })
  : null

export async function createCustomer(email: string, userId: string) {
  if (!stripe) {
    console.warn('Stripe not configured')
    return null
  }

  try {
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    })
    return customer.id
  } catch (error) {
    console.error('Failed to create Stripe customer:', error)
    return null
  }
}

export async function calculateVideoCost(durationInSeconds: number): Promise<number> {
  // $0.01 per second
  return Math.round(durationInSeconds) * 0.01
}

export async function createPaymentIntent(
  amount: number,
  customerId: string,
  metadata: Record<string, string>
) {
  if (!stripe) {
    throw new Error('Stripe not configured')
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    customer: customerId,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  })

  return paymentIntent
}

// Placeholder for future payment processing
export const PAYMENT_ENABLED = false
export const PRICE_PER_SECOND = 0.01
