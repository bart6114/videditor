import {
  type SupportedCurrency,
  EUR_TO_USD_RATE,
  convertEurToUsd,
  formatCurrency,
} from '@/lib/currency'

// Credit pricing constants - client-safe, can be imported anywhere
// Base price in EUR cents (source of truth)
export const CREDIT_PRICE_EUR_CENTS = 20 // €0.20 per credit

// Legacy USD constant for backwards compatibility
// Calculated from EUR base price using fixed exchange rate
export const CREDIT_PRICE_CENTS = Math.round(CREDIT_PRICE_EUR_CENTS * EUR_TO_USD_RATE) // ~23 cents USD

export const MIN_PURCHASE_CREDITS = 10 // Minimum 10 credits
export const DEFAULT_AUTO_TOPUP_THRESHOLD = 5
export const DEFAULT_AUTO_TOPUP_AMOUNT = 10
export const DEFAULT_FREE_CREDITS = 100 // Free credits for new organizations

// Credit costs per action
export const CREDIT_COSTS = {
  shortGeneration: 1, // 1 credit per short
} as const

// Credit packages for purchase
export const CREDIT_PACKAGES = [
  { credits: 10 },
  { credits: 25 },
  { credits: 50 },
  { credits: 100 },
] as const

// Re-export currency types
export type { SupportedCurrency } from '@/lib/currency'

/**
 * Get the price per credit in the specified currency
 */
export function getCreditPrice(currency: SupportedCurrency): number {
  const eurPrice = CREDIT_PRICE_EUR_CENTS / 100 // €0.20
  if (currency === 'EUR') {
    return eurPrice
  }
  return convertEurToUsd(eurPrice)
}

/**
 * Calculate price from credits in the specified currency
 */
export function calculatePriceInCurrency(
  credits: number,
  currency: SupportedCurrency
): number {
  return Math.round(credits * getCreditPrice(currency) * 100) / 100
}

/**
 * Format price with currency symbol (e.g., "€2.00" or "$2.32")
 */
export function formatPriceWithCurrency(
  credits: number,
  currency: SupportedCurrency
): string {
  const amount = calculatePriceInCurrency(credits, currency)
  return formatCurrency(amount, currency)
}

/**
 * Format credit price per unit with currency (e.g., "€0.20" or "$0.23")
 */
export function formatCreditPriceWithCurrency(currency: SupportedCurrency): string {
  return formatCurrency(getCreditPrice(currency), currency)
}

// Legacy functions for backwards compatibility (USD only)

/**
 * @deprecated Use calculatePriceInCurrency(credits, 'USD') instead
 */
export function calculatePrice(credits: number): number {
  return calculatePriceInCurrency(credits, 'USD')
}

/**
 * @deprecated Use formatPriceWithCurrency(credits, 'USD') instead
 */
export function formatPrice(credits: number): string {
  return formatPriceWithCurrency(credits, 'USD')
}

/**
 * @deprecated Use formatCreditPriceWithCurrency('USD') instead
 */
export function formatCreditPrice(): string {
  return formatCreditPriceWithCurrency('USD')
}
