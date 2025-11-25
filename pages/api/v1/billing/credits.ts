import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import { getUserCreditInfo } from '@/lib/credits';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return failure(res, 405, 'Method not allowed');
  }

  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();
  const creditInfo = await getUserCreditInfo(db, authResult.organizationId);

  if (!creditInfo) {
    return failure(res, 404, 'Organization not found');
  }

  return success(res, {
    credits: creditInfo.credits,
    autoTopUpEnabled: creditInfo.autoTopUpEnabled,
    autoTopUpThreshold: creditInfo.autoTopUpThreshold,
    autoTopUpAmount: creditInfo.autoTopUpAmount,
    hasPaymentMethod: !!creditInfo.stripeCustomerId, // Simplified check
  });
}
