/**
 * KYC tier-based daily/monthly limits.
 *
 * All limits are denominated in USD-equivalent so we can normalise across
 * currencies. The aggregator queries the user's `Transaction` history for the
 * relevant period and sums by `type`, then compares against the tier ceiling.
 *
 * Update this table to change risk policy — no code changes elsewhere needed.
 */

import { Prisma, KYCTier, TransactionType } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

export type LimitedAction = 'SEND' | 'WITHDRAW' | 'ONRAMP_BUY' | 'OFFRAMP_SELL';

interface LimitWindow {
  daily: number;     // USD per 24h
  monthly: number;   // USD per 30d
  perTx: number;     // USD per single tx
}

// Tunable risk policy. ALL VALUES IN USD-EQUIVALENT.
export const KYC_LIMITS: Record<KYCTier, Record<LimitedAction, LimitWindow>> = {
  TIER_0: {
    SEND:         { perTx: 100,    daily: 200,    monthly: 500 },
    WITHDRAW:     { perTx: 0,      daily: 0,      monthly: 0 },         // blocked
    ONRAMP_BUY:   { perTx: 200,    daily: 200,    monthly: 500 },
    OFFRAMP_SELL: { perTx: 0,      daily: 0,      monthly: 0 },         // blocked
  },
  TIER_1: {
    SEND:         { perTx: 1_000,  daily: 2_000,  monthly: 10_000 },
    WITHDRAW:     { perTx: 1_000,  daily: 2_000,  monthly: 10_000 },
    ONRAMP_BUY:   { perTx: 2_000,  daily: 5_000,  monthly: 20_000 },
    OFFRAMP_SELL: { perTx: 1_000,  daily: 2_000,  monthly: 10_000 },
  },
  TIER_2: {
    SEND:         { perTx: 10_000, daily: 25_000, monthly: 100_000 },
    WITHDRAW:     { perTx: 10_000, daily: 25_000, monthly: 100_000 },
    ONRAMP_BUY:   { perTx: 25_000, daily: 50_000, monthly: 250_000 },
    OFFRAMP_SELL: { perTx: 10_000, daily: 25_000, monthly: 100_000 },
  },
  TIER_3: {
    SEND:         { perTx: 250_000, daily: 1_000_000, monthly: 10_000_000 },
    WITHDRAW:     { perTx: 250_000, daily: 1_000_000, monthly: 10_000_000 },
    ONRAMP_BUY:   { perTx: 500_000, daily: 2_000_000, monthly: 20_000_000 },
    OFFRAMP_SELL: { perTx: 250_000, daily: 1_000_000, monthly: 10_000_000 },
  },
};

// Maps `LimitedAction` to which Transaction.type rows count toward the bucket.
const TX_TYPES_FOR_ACTION: Record<LimitedAction, TransactionType[]> = {
  SEND:         ['TRANSFER_OUT'],
  WITHDRAW:     ['WITHDRAWAL'],
  ONRAMP_BUY:   ['BUY'],          // BUY rows include on-ramp settlement once routed through wallet
  OFFRAMP_SELL: ['SELL'],
};

/**
 * Static last-resort USD rates, used only when no live price is available.
 */
const STATIC_USD_RATES: Record<string, number> = {
  USDT: 1, USD: 1, EUR: 1.08, GBP: 1.25, AED: 0.27, SAR: 0.27, EGP: 0.020, LYD: 0.21,
  BTC: 65_000, ETH: 3_200, SOL: 150, BNB: 600, XRP: 0.55, ADA: 0.45,
  DOGE: 0.15, MATIC: 0.7, DOT: 7, AVAX: 35,
};

const FIAT = new Set(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'TRY', 'TND']);

/** Synchronous USD valuation from the static table (fallback / tests). */
export function toUsd(amount: number | Prisma.Decimal, currency: string): number {
  const n = typeof amount === 'number' ? amount : Number(amount.toString());
  const rate = STATIC_USD_RATES[currency] ?? 1;
  return Math.abs(n) * rate;
}

/** USD value of one unit of `currency`: live price first, static table last. */
async function usdRate(currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === 'USD' || cur === 'USDT' || cur === 'USDC') return 1;
  try {
    if (FIAT.has(cur)) {
      const { getRate } = await import('../services/exchange/fxRateProvider.service');
      const pair = await getRate(cur, 'USD');
      const px = Number(pair.sellPrice || pair.buyPrice);
      if (Number.isFinite(px) && px > 0) return px;
    } else {
      const { getMarketPrice } = await import('../services/exchange/priceEngine.service');
      const px = Number(await getMarketPrice(`${cur}USDT`));
      if (Number.isFinite(px) && px > 0) return px;
    }
  } catch { /* fall through to the static table */ }
  return STATIC_USD_RATES[cur] ?? 1;
}

/**
 * The tier limits actually apply to. Anyone not currently APPROVED is held to
 * TIER_0, whatever tier is stored (a rejected user keeps no old limits), and
 * an approved user whose tier was never set is treated as TIER_1.
 */
export function effectiveTier(user: { kycTier: KYCTier; kycStatus: string }): KYCTier {
  if (user.kycStatus !== 'APPROVED') return 'TIER_0';
  return user.kycTier === 'TIER_0' ? 'TIER_1' : user.kycTier;
}

interface UsageWindow {
  dailyUsd: number;
  monthlyUsd: number;
}

interface UsageRow { amount: Prisma.Decimal; currency: string; createdAt: Date }

async function getUsage(userId: string, action: LimitedAction): Promise<UsageWindow> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let rows: UsageRow[];
  if (action === 'WITHDRAW') {
    // Count the withdrawal records themselves (fiat requests that weren't
    // cancelled/rejected, plus on-chain sends that didn't fail) — on-chain
    // withdrawals never create a Transaction row.
    const [requests, onChain] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId, createdAt: { gte: monthAgo }, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        select: { amount: true, currency: true, createdAt: true },
      }),
      prisma.onChainTransaction.findMany({
        where: { userId, type: 'WITHDRAWAL', createdAt: { gte: monthAgo }, status: { not: 'FAILED' } },
        select: { amount: true, asset: true, createdAt: true },
      }),
    ]);
    rows = [
      ...requests.map((r) => ({ amount: r.amount, currency: r.currency as string, createdAt: r.createdAt })),
      ...onChain.map((r) => ({ amount: r.amount, currency: r.asset, createdAt: r.createdAt })),
    ];
  } else {
    rows = (await prisma.transaction.findMany({
      where: { userId, type: { in: TX_TYPES_FOR_ACTION[action] }, createdAt: { gte: monthAgo } },
      select: { amount: true, currency: true, createdAt: true },
    })).map((r) => ({ amount: r.amount, currency: r.currency as string, createdAt: r.createdAt }));
  }

  const rates = new Map<string, number>();
  let dailyUsd = 0;
  let monthlyUsd = 0;
  for (const row of rows) {
    if (!rates.has(row.currency)) rates.set(row.currency, await usdRate(row.currency));
    const usd = Math.abs(Number(row.amount.toString())) * rates.get(row.currency)!;
    monthlyUsd += usd;
    if (row.createdAt >= dayAgo) dailyUsd += usd;
  }
  return { dailyUsd, monthlyUsd };
}

/**
 * Throw `AppError` if the requested action would breach the user's KYC tier
 * limits. Call this BEFORE the database write that would commit the funds.
 *
 * Limits are a risk control checked just before the write, not inside it,
 * so two simultaneous requests can each pass against the same usage.
 *
 * @example
 *   await enforceKycLimit(userId, 'SEND', 250, 'EUR');
 */
export async function enforceKycLimit(
  userId: string,
  action: LimitedAction,
  amount: number | string | Prisma.Decimal,
  currency: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycTier: true, kycStatus: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const tier = effectiveTier(user);
  const ceiling = KYC_LIMITS[tier][action];
  const requestedUsd = Math.abs(Number(amount.toString())) * (await usdRate(currency));

  if (ceiling.perTx === 0) {
    throw new AppError('Verify your identity to use this feature', 403);
  }
  if (requestedUsd > ceiling.perTx) {
    throw new AppError(
      `Amount exceeds your per-transaction limit of ${ceiling.perTx} USD. Complete a higher verification level to raise it.`,
      400,
    );
  }

  const usage = await getUsage(userId, action);
  if (usage.dailyUsd + requestedUsd > ceiling.daily) {
    throw new AppError(
      `This would exceed your daily limit (used ${usage.dailyUsd.toFixed(2)} of ${ceiling.daily} USD today)`,
      400,
    );
  }
  if (usage.monthlyUsd + requestedUsd > ceiling.monthly) {
    throw new AppError(
      `This would exceed your monthly limit (used ${usage.monthlyUsd.toFixed(2)} of ${ceiling.monthly} USD this month)`,
      400,
    );
  }
}

/**
 * Read-only helper for the UI: returns remaining headroom for each action.
 * Useful for "you can still send $X today" widgets.
 */
export async function getKycHeadroom(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycTier: true, kycStatus: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const tier = effectiveTier(user);
  const actions: LimitedAction[] = ['SEND', 'WITHDRAW', 'ONRAMP_BUY', 'OFFRAMP_SELL'];
  const headroom: Record<string, { tier: KYCTier; daily: { used: number; limit: number; remaining: number }; monthly: { used: number; limit: number; remaining: number }; perTx: number }> = {};

  for (const action of actions) {
    const ceiling = KYC_LIMITS[tier][action];
    const usage = await getUsage(userId, action);
    headroom[action] = {
      tier,
      daily:   { used: usage.dailyUsd,   limit: ceiling.daily,   remaining: Math.max(0, ceiling.daily - usage.dailyUsd) },
      monthly: { used: usage.monthlyUsd, limit: ceiling.monthly, remaining: Math.max(0, ceiling.monthly - usage.monthlyUsd) },
      perTx:   ceiling.perTx,
    };
  }
  return headroom;
}
