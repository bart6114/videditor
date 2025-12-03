import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import {
  getUserCreditInfo,
  setPreferredCurrency,
  getCreditPrice,
  type SupportedCurrency,
} from '@/lib/credits';
import { EUR_TO_USD_RATE } from '@/lib/currency';
import { detectCurrencyFromIP, getClientIP } from '@/lib/currency/geo-detection';

const updateCurrencySchema = z.object({
  currency: z.enum(['EUR', 'USD']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authResult = await authenticate(req);
  if (!authResult.authenticated) {
    return failure(res, 401, authResult.error);
  }

  const db = getDb();

  if (req.method === 'GET') {
    // Get current currency info
    const creditInfo = await getUserCreditInfo(db, authResult.organizationId);

    if (!creditInfo) {
      return failure(res, 404, 'Organization not found');
    }

    // Detect currency from IP if no preference set
    let detectedCurrency: SupportedCurrency = 'USD';
    const clientIP = getClientIP(req.headers as Record<string, string | string[] | undefined>);
    if (clientIP) {
      detectedCurrency = await detectCurrencyFromIP(clientIP);
    }

    const preferredCurrency = (creditInfo.preferredCurrency as SupportedCurrency) || null;

    return success(res, {
      preferredCurrency,
      detectedCurrency,
      effectiveCurrency: preferredCurrency || detectedCurrency,
      pricing: {
        EUR: {
          pricePerCredit: getCreditPrice('EUR'),
          symbol: '€',
        },
        USD: {
          pricePerCredit: getCreditPrice('USD'),
          symbol: '$',
        },
      },
      exchangeRate: EUR_TO_USD_RATE,
    });
  }

  if (req.method === 'PATCH') {
    // Update currency preference
    const parsed = updateCurrencySchema.safeParse(req.body);
    if (!parsed.success) {
      return failure(res, 400, 'Invalid request body', parsed.error.flatten());
    }

    await setPreferredCurrency(db, authResult.organizationId, parsed.data.currency);

    return success(res, {
      preferredCurrency: parsed.data.currency,
    });
  }

  return failure(res, 405, 'Method not allowed');
}
