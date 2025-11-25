import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { getTransactionHistory } from '@/lib/credits';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return failure(res, 400, 'Invalid query parameters', parsed.error.flatten());
  }

  const { limit, offset } = parsed.data;
  const db = getDb();

  const transactions = await getTransactionHistory(db, authResult.organizationId, limit, offset);

  return success(res, {
    transactions: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      balanceAfter: tx.balanceAfter,
      description: tx.description,
      createdAt: tx.createdAt.toISOString(),
    })),
    pagination: {
      limit,
      offset,
      hasMore: transactions.length === limit,
    },
  });
}
