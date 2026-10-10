/**
 * Remittance quotes.
 *
 * base rate      = mid of the FX engine pair (Fulus parallel rate first for
 *                  LYD; admin/treasury override honoured), destination per 1 source
 * customer rate  = base × (1 − corridor spread × (1 − tier discount))
 * fee            = corridor fixed fee + percent × send amount (source currency)
 * total debit    = send amount + fee
 *
 * Guard-rails: if the base rate is outside the corridor's floor/ceiling the
 * corridor refuses to quote (a rate anomaly must be investigated, not
 * clamped). Static fallback rates are refused in production; outside
 * production they are used but the quote's rateSource says so.
 *
 * A quote is an immutable price record (database-enforced) that can be
 * consumed exactly once before it expires.
 */
import type { Currency, Prisma, RemittanceCorridor } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { getRate } from '../exchange/fxRateProvider.service';
import { isBlocked } from '../platform/controls.service';
import { persistRoutes, rankRoutes, type RouteCandidate } from './routing';

const DECIMALS: Partial<Record<Currency, number>> = { LYD: 3, TND: 3 };
export const decimalsOf = (c: Currency) => DECIMALS[c] ?? 2;

export async function baseRate(source: Currency, dest: Currency): Promise<{ rate: Decimal; source: string }> {
  let pair;
  try {
    pair = await getRate(source, dest);
  } catch {
    throw new AppError(`No ${source}/${dest} rate is available`, 503, 'PROVIDER_UNAVAILABLE');
  }
  if (pair.source.startsWith('fallback:') && process.env.NODE_ENV === 'production') {
    throw new AppError(`Live ${source}/${dest} pricing is unavailable right now`, 503, 'PROVIDER_UNAVAILABLE');
  }
  const mid = new Decimal(pair.buyPrice).plus(pair.sellPrice).div(2);
  if (!mid.isFinite() || mid.lte(0)) throw new AppError(`Invalid ${source}/${dest} rate`, 503, 'PROVIDER_UNAVAILABLE');
  const label = pair.source.startsWith('fallback:') ? `${pair.source} (NON-PRODUCTION ONLY — static reference rate)` : pair.source;
  return { rate: mid, source: label };
}

export interface QuoteRequest {
  userId: string;
  corridorCode: string;
  sendAmount?: string | number;
  receiveAmount?: string | number;
  payoutMethod?: string;
  beneficiaryCountry?: string;
}

export interface QuoteView {
  quote: Prisma.RemittanceQuoteGetPayload<object>;
  corridor: Pick<RemittanceCorridor, 'code' | 'name' | 'status' | 'sourceCurrency' | 'destCurrency'>;
  routes: RouteCandidate[];
  sandbox: boolean;
}

export async function createQuote(req: QuoteRequest): Promise<QuoteView> {
  const corridor = await prisma.remittanceCorridor.findUnique({ where: { code: req.corridorCode } });
  if (!corridor) throw new AppError('Unknown corridor', 404);
  if (corridor.status === 'PAUSED' || corridor.status === 'DISABLED' || (await isBlocked('CORRIDOR', corridor.code))) {
    throw new AppError(`${corridor.name} is not accepting transfers right now`, 503, 'FEATURE_DISABLED');
  }
  if (corridor.status === 'SANDBOX_ONLY' && process.env.NODE_ENV === 'production') {
    throw new AppError(`${corridor.name} is not live yet — payout partner activation is required`, 503, 'PROVIDER_NOT_ACTIVATED');
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { kycTier: true, accountType: true } });
  if (!user) throw new AppError('User not found', 404);

  const src = corridor.sourceCurrency;
  const dst = corridor.destCurrency;
  const { rate: base, source: rateSource } = await baseRate(src, dst);
  if (corridor.rateFloor && base.lt(corridor.rateFloor.toString())) throw new AppError(`${corridor.code} rate is below the treasury floor — quoting paused for review`, 503, 'FEATURE_DISABLED');
  if (corridor.rateCeiling && base.gt(corridor.rateCeiling.toString())) throw new AppError(`${corridor.code} rate is above the treasury ceiling — quoting paused for review`, 503, 'FEATURE_DISABLED');

  const discounts = (corridor.tierSpreadDiscounts ?? {}) as Record<string, number>;
  const discount = Math.min(0.9, Math.max(0, Number(user.accountType === 'BUSINESS' ? discounts.BUSINESS ?? 0 : discounts[user.kycTier] ?? 0)));
  const spread = new Decimal(corridor.spreadPercent.toString()).mul(1 - discount);
  const customerRate = base.mul(new Decimal(1).minus(spread)).toDecimalPlaces(8, Decimal.ROUND_DOWN);

  let sendAmount: Decimal;
  let receiveAmount: Decimal;
  if (req.receiveAmount !== undefined && req.receiveAmount !== null && req.receiveAmount !== '') {
    receiveAmount = new Decimal(String(req.receiveAmount)).toDecimalPlaces(decimalsOf(dst), Decimal.ROUND_DOWN);
    sendAmount = receiveAmount.div(customerRate).toDecimalPlaces(decimalsOf(src), Decimal.ROUND_UP);
  } else if (req.sendAmount !== undefined && req.sendAmount !== null && req.sendAmount !== '') {
    sendAmount = new Decimal(String(req.sendAmount)).toDecimalPlaces(decimalsOf(src), Decimal.ROUND_DOWN);
    receiveAmount = sendAmount.mul(customerRate).toDecimalPlaces(decimalsOf(dst), Decimal.ROUND_DOWN);
  } else {
    throw new AppError('Give either sendAmount or receiveAmount', 400);
  }
  if (!sendAmount.isFinite() || sendAmount.lte(0) || receiveAmount.lte(0)) throw new AppError('Amount must be positive', 400);
  if (receiveAmount.lt(corridor.minAmount.toString())) throw new AppError(`Minimum for ${corridor.code} is ${corridor.minAmount} ${dst}`, 400, 'LIMIT_EXCEEDED');
  if (receiveAmount.gt(corridor.maxAmount.toString())) throw new AppError(`Maximum for ${corridor.code} is ${corridor.maxAmount} ${dst}`, 400, 'LIMIT_EXCEEDED');

  const fee = new Decimal(corridor.feeFixed.toString()).plus(sendAmount.mul(corridor.feePercent.toString())).toDecimalPlaces(decimalsOf(src), Decimal.ROUND_UP);
  const totalDebit = sendAmount.plus(fee);

  const payoutMethod = req.payoutMethod ?? corridor.payoutMethods[0] ?? 'BANK_ACCOUNT';
  if (!corridor.payoutMethods.includes(payoutMethod)) throw new AppError(`${payoutMethod} is not offered on ${corridor.code}`, 400);
  const destCountry = req.beneficiaryCountry ?? (corridor.destCountry === 'EU' ? 'DE' : corridor.destCountry);
  const routes = await rankRoutes({ destCountry, destCurrency: dst, payoutMethod, receiveAmount, customerRate });
  const best = routes.find((r) => r.eligible && r.rank === 1) ?? null;

  const quote = await prisma.$transaction(async (tx) => {
    const q = await tx.remittanceQuote.create({
      data: {
        userId: req.userId, corridorId: corridor.id, sourceCurrency: src, destCurrency: dst,
        sendAmount: sendAmount.toFixed(), feeAmount: fee.toFixed(), totalDebit: totalDebit.toFixed(),
        baseRate: base.toDecimalPlaces(8).toFixed(), customerRate: customerRate.toFixed(), spreadPercent: spread.toDecimalPlaces(6).toFixed(),
        receiveAmount: receiveAmount.toFixed(), rateSource, providerCode: best?.providerCode ?? null,
        routeScore: best?.score ?? null, deliveryMins: best?.estimatedDeliveryMins ?? null,
        expiresAt: new Date(Date.now() + corridor.quoteTtlSeconds * 1000),
      },
    });
    await persistRoutes(tx, routes, { quoteId: q.id }, dst, best?.providerCode);
    return q;
  });

  return {
    quote,
    corridor: { code: corridor.code, name: corridor.name, status: corridor.status, sourceCurrency: src, destCurrency: dst },
    routes,
    sandbox: corridor.status !== 'LIVE',
  };
}
