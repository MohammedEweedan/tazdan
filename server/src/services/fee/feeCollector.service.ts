/** Fee reporting only. Native revenue is posted by the originating journal.
 * A USD valuation never converts assets or creates a spendable USDT balance. */
import { Prisma, type Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { getRate } from '../exchange/fxRateProvider.service';
import { isLedgerCurrency } from '../ledger/ledger.service';
import { AppError } from '../../middleware/errorHandler';

async function valuation(amount: Decimal, currency: string): Promise<{ amountUsd: Decimal | null; valuationSource: string }> {
  if (currency === 'USD') return { amountUsd: amount, valuationSource: 'USD_NATIVE' };
  if (currency === 'USDT') return { amountUsd: amount, valuationSource: 'USDT_PEG_ESTIMATE' };
  try {
    const rate = await getRate(currency, 'USD');
    const value = new Decimal(rate.sellPrice);
    if (value.isFinite() && value.gt(0) && !/fallback|stale|floor|placeholder/i.test(rate.source) &&
        Date.now() - rate.fetchedAt.getTime() <= 5 * 60_000) {
      return { amountUsd: amount.mul(value).toDecimalPlaces(8, Decimal.ROUND_DOWN), valuationSource: rate.source };
    }
  } catch { /* Preserve native revenue; missing valuation is visible, never invented. */ }
  return { amountUsd: null, valuationSource: 'UNPRICED' };
}

export type FeeSource =
  | 'order'
  | 'crypto_order'
  | 'withdrawal'
  | 'crypto_withdrawal'
  | 'p2p_trade'
  | 'swap'
  | 'card_spend'
  | 'card_order'
  | 'manual';

export interface CollectFeeInput {
  /** Where the fee originated. */
  source:      FeeSource;
  /** ID of the source record (orderId, withdrawalId, etc). */
  sourceId?:   string;
  /** User who paid the fee. */
  payerId?:    string;
  /** Fee amount in the fee currency. */
  amount:      Decimal | number | string;
  /** Currency in which the fee was charged. */
  currency:    string;
  description?: string;
  metadata?:   Record<string, any>;
  /** Pass your prisma transaction client when inside a $transaction. */
  tx?:         any;
}

/** Record once, atomically with the originating money transaction when tx is supplied. */
export async function collectFee(input: CollectFeeInput): Promise<string | null> {
  const amount = new Decimal(input.amount);
  if (!amount.isFinite() || amount.lt(0) || amount.decimalPlaces() > 8) throw new AppError('Invalid fee amount', 400);
  if (amount.isZero()) return null;
  const currency = input.currency.trim().toUpperCase();
  if (!isLedgerCurrency(currency)) throw new AppError(`Fee accounting does not support ${currency}`, 400);
  if (!input.tx) return prisma.$transaction(tx => collectFee({ ...input, tx }));
  const client = input.tx;
  if (input.sourceId) {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fee:${input.source}:${input.sourceId}`}))`;
    const prior = await client.platformFee.findFirst({ where: { source: input.source, sourceId: input.sourceId } });
    if (prior) {
      if (prior.currency !== currency || !new Decimal(prior.amount).eq(amount)) throw new AppError('Fee reference already used with different terms', 409, 'DUPLICATE_REQUEST');
      return prior.id;
    }
  }
  const priced = await valuation(amount, currency);
  const fee = await client.platformFee.create({ data: {
    source: input.source, sourceId: input.sourceId ?? null, payerId: input.payerId ?? null,
    amount, currency: currency as Currency, ...priced, description: input.description ?? null,
    metadata: { ...(input.metadata ?? {}), originalAmount: amount.toString(), originalCurrency: currency,
      accounting: 'NATIVE_CURRENCY_REVENUE', usdValuationOnly: true } as Prisma.InputJsonValue,
  } });
  return fee.id;
}

/** Kept for callers/tests that previously cleared the corporate-user mirror. */
export function _resetPlatformUserCache(): void { /* Revenue has no user-wallet mirror. */ }
