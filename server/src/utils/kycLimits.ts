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
 * Convert any currency amount to USD-equivalent for limit accounting.
 * For now uses a static rate table — should be replaced with live FX from
 * `getMarketDataProvider()` once real Binance integration is wired.
 */
const STATIC_USD_RATES: Record<string, number> = {
  USDT: 1, USD: 1, EUR: 1.08, GBP: 1.25, AED: 0.27, SAR: 0.27, EGP: 0.020, LYD: 0.21,
  BTC: 65_000, ETH: 3_200, SOL: 150, BNB: 600, XRP: 0.55, ADA: 0.45,
  DOGE: 0.15, MATIC: 0.7, DOT: 7, AVAX: 35,
};

export function toUsd(amount: number | Prisma.Decimal, currency: string): number {
  const n = typeof amount === 'number' ? amount : Number(amount.toString());
  const rate = STATIC_USD_RATES[currency] ?? 1;
  return Math.abs(n) * rate;
}

interface UsageWindow {
  dailyUsd: number;
  monthlyUsd: number;
}

async function getUsage(userId: string, action: LimitedAction): Promise<UsageWindow> {
  const types = TX_TYPES_FOR_ACTION[action];
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const txs = await prisma.transaction.findMany({
    where: { userId, type: { in: types }, createdAt: { gte: monthAgo } },
    select: { amount: true, currency: true, createdAt: true },
  });

  let dailyUsd = 0;
  let monthlyUsd = 0;
  for (const tx of txs) {
    const usd = toUsd(tx.amount, tx.currency);
    monthlyUsd += usd;
    if (tx.createdAt >= dayAgo) dailyUsd += usd;
  }
  return { dailyUsd, monthlyUsd };
}

/**
 * Throw `AppError` if the requested action would breach the user's KYC tier
 * limits. Call this BEFORE the database write that would commit the funds.
 *
 * @example
 *   await enforceKycLimit(userId, 'SEND', 250, 'EUR');
 */
export async function enforceKycLimit(
  userId: string,
  action: LimitedAction,
  amount: number | Prisma.Decimal,
  currency: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycTier: true, kycStatus: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const tier: KYCTier = user.kycTier;
  const ceiling = KYC_LIMITS[tier][action];
  const requestedUsd = toUsd(amount, currency);

  if (ceiling.perTx === 0) {
    throw new AppError(`${action} requires higher KYC tier (current: ${tier})`, 403);
  }
  if (requestedUsd > ceiling.perTx) {
    throw new AppError(
      `Amount exceeds per-transaction limit for ${tier}: ${ceiling.perTx} USD-eq`,
      400,
    );
  }

  const usage = await getUsage(userId, action);
  if (usage.dailyUsd + requestedUsd > ceiling.daily) {
    throw new AppError(
      `Amount would exceed daily ${action} limit for ${tier} ` +
      `(used ${usage.dailyUsd.toFixed(2)} / ${ceiling.daily} USD-eq today)`,
      400,
    );
  }
  if (usage.monthlyUsd + requestedUsd > ceiling.monthly) {
    throw new AppError(
      `Amount would exceed monthly ${action} limit for ${tier} ` +
      `(used ${usage.monthlyUsd.toFixed(2)} / ${ceiling.monthly} USD-eq this month)`,
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
    select: { kycTier: true },
  });
  if (!user) throw new AppError('User not found', 404);

  const tier = user.kycTier;
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
