import Stripe from 'stripe'
import {
  CREDIT_PRICE_EUR_CENTS,
  type SupportedCurrency,
  getCreditPrice,
} from '@/lib/credits'
import { EUR_TO_USD_RATE } from '@/lib/currency'

// Initialize Stripe client
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

/**
 * Create Stripe customer for an organization
 * Email is optional - can be collected later during checkout
 */
export async function createCustomer(
  stripe: Stripe,
  email: string | null,
  organizationId: string,
  name?: string
): Promise<string> {
  const customer = await stripe.customers.create({
    ...(email && { email }), // Only include email if provided
    name,
    metadata: {
      organizationId,
    },
  })
  return customer.id
}

/**
 * Create or get existing Stripe customer for an organization
 */
export async function getOrCreateCustomer(
  stripe: Stripe,
  organizationId: string,
  email: string | null,
  name?: string
): Promise<string> {
  // Search for existing customer by organizationId in metadata
  const existingCustomers = await stripe.customers.search({
    query: `metadata['organizationId']:'${organizationId}'`,
    limit: 1,
  })

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id
  }

  // Create new customer
  return createCustomer(stripe, email, organizationId, name)
}

/**
 * Create a SetupIntent for saving a payment method
 */
export async function createSetupIntent(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.SetupIntent> {
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session', // Allow charging later without user present
  })
}

/**
 * Calculate amount in cents for a given number of credits and currency
 */
export function calculateAmountInCents(
  creditAmount: number,
  currency: SupportedCurrency
): number {
  // Get price per credit in the currency (returns dollars/euros)
  const pricePerCredit = getCreditPrice(currency)
  // Convert to cents and round
  return Math.round(creditAmount * pricePerCredit * 100)
}

/**
 * Create a PaymentIntent for purchasing credits
 */
export async function createCreditPurchasePaymentIntent(
  stripe: Stripe,
  customerId: string,
  creditAmount: number,
  currency: SupportedCurrency = 'USD',
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> {
  const amountInCents = calculateAmountInCents(creditAmount, currency)

  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: amountInCents,
    currency: currency.toLowerCase(),
    customer: customerId,
    description: `Purchase ${creditAmount} credits`,
    metadata: {
      type: 'credit_purchase',
      creditAmount: creditAmount.toString(),
      currency,
      exchangeRate: EUR_TO_USD_RATE.toString(),
    },
  }

  // If payment method provided, confirm immediately (for one-click purchases)
  if (paymentMethodId) {
    paymentIntentParams.payment_method = paymentMethodId
    paymentIntentParams.confirm = true
    paymentIntentParams.off_session = true
  }

  return stripe.paymentIntents.create(paymentIntentParams)
}

/**
 * Charge for auto top-up using saved payment method
 */
export async function chargeAutoTopUp(
  stripe: Stripe,
  customerId: string,
  creditAmount: number,
  paymentMethodId: string,
  currency: SupportedCurrency = 'USD'
): Promise<Stripe.PaymentIntent> {
  const amountInCents = calculateAmountInCents(creditAmount, currency)

  return stripe.paymentIntents.create({
    amount: amountInCents,
    currency: currency.toLowerCase(),
    customer: customerId,
    payment_method: paymentMethodId,
    confirm: true,
    off_session: true, // Charge without user present
    description: `Auto top-up: ${creditAmount} credits`,
    metadata: {
      type: 'auto_topup',
      creditAmount: creditAmount.toString(),
      currency,
      exchangeRate: EUR_TO_USD_RATE.toString(),
    },
  })
}

/**
 * Get customer's saved payment methods
 */
export async function getCustomerPaymentMethods(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
  })
  return paymentMethods.data
}

/**
 * Get customer's default payment method
 */
export async function getDefaultPaymentMethod(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.PaymentMethod | null> {
  const customer = await stripe.customers.retrieve(customerId)

  if (customer.deleted) {
    return null
  }

  const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method

  if (!defaultPaymentMethodId || typeof defaultPaymentMethodId !== 'string') {
    // No default, try to get first available
    const methods = await getCustomerPaymentMethods(stripe, customerId)
    return methods[0] ?? null
  }

  return stripe.paymentMethods.retrieve(defaultPaymentMethodId)
}

/**
 * Set customer's default payment method
 */
export async function setDefaultPaymentMethod(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  })
}

/**
 * Detach (remove) a payment method from customer
 */
export async function detachPaymentMethod(
  stripe: Stripe,
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  return stripe.paymentMethods.detach(paymentMethodId)
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
  stripe: Stripe,
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}
