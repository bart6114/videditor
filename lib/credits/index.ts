import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { DB } from '@server/db';
import {
  organizations,
  creditTransactions,
  type CreditTransaction,
  type NewCreditTransaction,
} from '@server/db/schema';

// Re-export client-safe constants
export {
  CREDIT_PRICE_CENTS,
  MIN_PURCHASE_CREDITS,
  DEFAULT_AUTO_TOPUP_THRESHOLD,
  DEFAULT_AUTO_TOPUP_AMOUNT,
  DEFAULT_FREE_CREDITS,
  CREDIT_COSTS,
  CREDIT_PACKAGES,
  calculatePrice,
  formatPrice,
  formatCreditPrice,
} from './constants';

// Import for local use in this file
import { CREDIT_COSTS } from './constants';

export type CreditTransactionType = 'purchase' | 'auto_topup' | 'usage' | 'refund' | 'adjustment';

export interface CreditMetadata {
  jobId?: string;
  projectId?: string;
  shortsCount?: number;
  description?: string;
  performedById?: string;
  [key: string]: unknown;
}

/**
 * Get organization's current credit balance
 * @param db - Database instance
 * @param organizationId - Organization ID
 */
export async function getUserCredits(db: DB, organizationId: string): Promise<number> {
  const [org] = await db
    .select({ credits: organizations.credits })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return org?.credits ?? 0;
}

// Alias for clarity
export const getOrganizationCredits = getUserCredits;

/**
 * Get organization's credit info including auto top-up settings
 * @param db - Database instance
 * @param organizationId - Organization ID
 */
export async function getUserCreditInfo(db: DB, organizationId: string) {
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

  return org ?? null;
}

// Alias for clarity
export const getOrganizationCreditInfo = getUserCreditInfo;

/**
 * Add credits to organization account (atomic operation with transaction log)
 * @param db - Database instance
 * @param organizationId - Organization ID
 * @param amount - Number of credits to add
 * @param type - Transaction type
 * @param metadata - Additional metadata
 * @param stripePaymentIntentId - Stripe payment intent ID
 */
export async function addCredits(
  db: DB,
  organizationId: string,
  amount: number,
  type: CreditTransactionType,
  metadata?: CreditMetadata,
  stripePaymentIntentId?: string
): Promise<CreditTransaction> {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  // Use a transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // Update organization credits and get new balance
    const [updatedOrg] = await tx
      .update(organizations)
      .set({
        credits: sql`${organizations.credits} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning({ credits: organizations.credits });

    if (!updatedOrg) {
      throw new Error('Organization not found');
    }

    // Create transaction record
    const transaction: NewCreditTransaction = {
      id: crypto.randomUUID(),
      organizationId,
      performedById: metadata?.performedById ?? null,
      type,
      amount,
      balanceAfter: updatedOrg.credits,
      description: metadata?.description ?? getDefaultDescription(type, amount),
      stripePaymentIntentId: stripePaymentIntentId ?? null,
      metadata: metadata ?? null,
    };

    const [created] = await tx.insert(creditTransactions).values(transaction).returning();
    return created;
  });

  return result;
}

/**
 * Deduct credits from organization account (atomic operation with transaction log)
 * Returns the transaction record, or null if insufficient credits
 * @param db - Database instance
 * @param organizationId - Organization ID
 * @param amount - Number of credits to deduct
 * @param metadata - Additional metadata (including performedById for tracking who did it)
 */
export async function deductCredits(
  db: DB,
  organizationId: string,
  amount: number,
  metadata?: CreditMetadata
): Promise<CreditTransaction | null> {
  if (amount <= 0) {
    throw new Error('Credit amount must be positive');
  }

  // Use a transaction to ensure atomicity
  const result = await db.transaction(async (tx) => {
    // Check current balance first
    const [currentOrg] = await tx
      .select({ credits: organizations.credits })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!currentOrg || currentOrg.credits < amount) {
      return null; // Insufficient credits
    }

    // Deduct credits
    const [updatedOrg] = await tx
      .update(organizations)
      .set({
        credits: sql`${organizations.credits} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning({ credits: organizations.credits });

    // Create transaction record
    const transaction: NewCreditTransaction = {
      id: crypto.randomUUID(),
      organizationId,
      performedById: metadata?.performedById ?? null,
      type: 'usage',
      amount: -amount, // Negative for deductions
      balanceAfter: updatedOrg.credits,
      description: metadata?.description ?? `Used ${amount} credit${amount !== 1 ? 's' : ''}`,
      metadata: metadata ?? null,
    };

    const [created] = await tx.insert(creditTransactions).values(transaction).returning();
    return created;
  });

  return result;
}

/**
 * Check if organization has sufficient credits for an operation
 */
export async function hasEnoughCredits(db: DB, organizationId: string, required: number): Promise<boolean> {
  const credits = await getUserCredits(db, organizationId);
  return credits >= required;
}

/**
 * Calculate credit cost for a job based on type and payload
 */
export function calculateJobCost(
  jobType: string,
  payload?: { shortsCount?: number; socialPlatforms?: string[] }
): number {
  if (jobType !== 'analysis') {
    return 0; // Only analysis jobs cost credits
  }

  const shortsCount = payload?.shortsCount ?? 3;
  return shortsCount * CREDIT_COSTS.shortGeneration;
}

/**
 * Get organization's transaction history
 * @param db - Database instance
 * @param organizationId - Organization ID
 * @param limit - Max number of transactions
 * @param offset - Offset for pagination
 */
export async function getTransactionHistory(
  db: DB,
  organizationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CreditTransaction[]> {
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.organizationId, organizationId))
    .orderBy(sql`${creditTransactions.createdAt} DESC`)
    .limit(limit)
    .offset(offset);
}

/**
 * Update organization's auto top-up settings
 * @param db - Database instance
 * @param organizationId - Organization ID
 * @param settings - Auto top-up settings
 */
export async function updateAutoTopUpSettings(
  db: DB,
  organizationId: string,
  settings: {
    enabled?: boolean;
    threshold?: number;
    amount?: number;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = { updatedAt: new Date() };

  if (settings.enabled !== undefined) {
    updatePayload.autoTopUpEnabled = settings.enabled;
  }
  if (settings.threshold !== undefined) {
    updatePayload.autoTopUpThreshold = settings.threshold;
  }
  if (settings.amount !== undefined) {
    updatePayload.autoTopUpAmount = settings.amount;
  }

  await db.update(organizations).set(updatePayload).where(eq(organizations.id, organizationId));
}

/**
 * Update organization's Stripe customer ID
 * @param db - Database instance
 * @param organizationId - Organization ID
 * @param stripeCustomerId - Stripe customer ID
 */
export async function setStripeCustomerId(
  db: DB,
  organizationId: string,
  stripeCustomerId: string
): Promise<void> {
  await db
    .update(organizations)
    .set({
      stripeCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
}

/**
 * Disable auto top-up (called on payment failure)
 * @param db - Database instance
 * @param organizationId - Organization ID
 */
export async function disableAutoTopUp(db: DB, organizationId: string): Promise<void> {
  await db
    .update(organizations)
    .set({
      autoTopUpEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
}

// Helper function to generate default descriptions
function getDefaultDescription(type: CreditTransactionType, amount: number): string {
  const absAmount = Math.abs(amount);
  switch (type) {
    case 'purchase':
      return `Purchased ${absAmount} credit${absAmount !== 1 ? 's' : ''}`;
    case 'auto_topup':
      return `Auto top-up: ${absAmount} credit${absAmount !== 1 ? 's' : ''}`;
    case 'usage':
      return `Used ${absAmount} credit${absAmount !== 1 ? 's' : ''}`;
    case 'refund':
      return `Refund: ${absAmount} credit${absAmount !== 1 ? 's' : ''}`;
    case 'adjustment':
      return `Admin adjustment: ${amount > 0 ? '+' : ''}${amount} credit${absAmount !== 1 ? 's' : ''}`;
    default:
      return `${absAmount} credit${absAmount !== 1 ? 's' : ''}`;
  }
}
