import type { NextApiRequest, NextApiResponse } from 'next';
import { authenticate } from '@/lib/api/auth';
import { failure, success } from '@/lib/api/responses';
import { getDb } from '@server/db';
import {
  getUserCreditInfo,
  getCreditPrice,
  setPreferredCurrency,
  type SupportedCurrency,
} from '@/lib/credits';
import { EUR_TO_USD_RATE } from '@/lib/currency';
import { detectCurrencyFromIP, getClientIP } from '@/lib/currency/geo-detection';

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

  // Auto-detect and set currency on first visit if no preference is set
  let preferredCurrency: SupportedCurrency = creditInfo.preferredCurrency as SupportedCurrency;
  if (!preferredCurrency) {
    const clientIP = getClientIP(req.headers as Record<string, string | string[] | undefined>);
    if (clientIP) {
      preferredCurrency = await detectCurrencyFromIP(clientIP);
      // Save the detected preference so it persists
      await setPreferredCurrency(db, authResult.organizationId, preferredCurrency);
    } else {
      preferredCurrency = 'USD';
    }
  }

  return success(res, {
    credits: creditInfo.credits,
    autoTopUpEnabled: creditInfo.autoTopUpEnabled,
    autoTopUpThreshold: creditInfo.autoTopUpThreshold,
    autoTopUpAmount: creditInfo.autoTopUpAmount,
    hasPaymentMethod: !!creditInfo.stripeCustomerId,
    // Currency info
    preferredCurrency,
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
