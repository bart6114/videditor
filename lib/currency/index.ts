// Fixed exchange rate, overridable via env var
// Default: 1 EUR = 1.16 USD
export const EUR_TO_USD_RATE = parseFloat(process.env.EUR_TO_USD_RATE || '1.16')

export type SupportedCurrency = 'EUR' | 'USD'

export const CURRENCY_CONFIG = {
  EUR: {
    symbol: '€',
    code: 'EUR' as const,
    locale: 'de-DE',
  },
  USD: {
    symbol: '$',
    code: 'USD' as const,
    locale: 'en-US',
  },
} as const

/**
 * Convert EUR amount to USD using fixed exchange rate
 * Always rounds to 2 decimal places
 */
export function convertEurToUsd(eurAmount: number): number {
  return Math.round(eurAmount * EUR_TO_USD_RATE * 100) / 100
}

/**
 * Convert USD amount to EUR using fixed exchange rate
 * Always rounds to 2 decimal places
 */
export function convertUsdToEur(usdAmount: number): number {
  return Math.round((usdAmount / EUR_TO_USD_RATE) * 100) / 100
}

/**
 * Format a monetary amount with currency symbol
 * Always shows 2 decimal places
 */
export function formatCurrency(amount: number, currency: SupportedCurrency): string {
  const config = CURRENCY_CONFIG[currency]
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
