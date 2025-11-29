// Credit pricing constants - client-safe, can be imported anywhere
export const CREDIT_PRICE_CENTS = 10; // $0.10 per credit
export const MIN_PURCHASE_CREDITS = 10; // Minimum 10 credits ($1.00)
export const DEFAULT_AUTO_TOPUP_THRESHOLD = 5;
export const DEFAULT_AUTO_TOPUP_AMOUNT = 10;
export const DEFAULT_FREE_CREDITS = 100; // Free credits for new organizations

// Credit costs per action
export const CREDIT_COSTS = {
  shortGeneration: 1, // 1 credit per short
} as const;

// Credit packages for purchase
export const CREDIT_PACKAGES = [
  { credits: 10 },
  { credits: 25 },
  { credits: 50 },
  { credits: 100 },
] as const;

/**
 * Calculate price in dollars from credits
 */
export function calculatePrice(credits: number): number {
  return (credits * CREDIT_PRICE_CENTS) / 100;
}

/**
 * Format price as string (e.g., "$1.00")
 */
export function formatPrice(credits: number): string {
  return `$${calculatePrice(credits).toFixed(2)}`;
}

/**
 * Format credit price per unit (e.g., "$0.10")
 */
export function formatCreditPrice(): string {
  return `$${(CREDIT_PRICE_CENTS / 100).toFixed(2)}`;
}
