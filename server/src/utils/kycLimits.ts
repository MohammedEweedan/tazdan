/**
 * KYC tier-based per-transaction, daily and monthly limits.
 *
 * All limits are denominated in USD-equivalent so we can normalise across
 * currencies. Periods are calendar periods in LIMITS_TIMEZONE (default
 * Africa/Tripoli): the daily limit resets at local midnight and the monthly
 * limit at local midnight on the 1st, so a customer can be told exactly when
 * they can continue ("from 01/11/2026").
 *
 * `limitStatus` is the single source for both the app (shown before the
 * customer confirms, so no security code is sent for an order that cannot go
 * through) and `enforceKycLimit` (the server-side check, whose LIMIT_EXCEEDED
 * error carries the same details).
 *
 * Update the table to change risk policy — no code changes elsewhere needed.
 */

import { Prisma, KYCTier, TransactionType } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from '../middleware/errorHandler';

export type LimitedAction = 'SEND' | 'WITHDRAW' | 'ONRAMP_BUY' | 'OFFRAMP_SELL';

interface LimitWindow {
  daily: number;     // USD per calendar day
  monthly: number;   // USD per calendar month
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
export async function usdRate(currency: string): Promise<number> {
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

/** USD value of an amount of `currency`, live price first. */
export async function valueInUsd(amount: number | string | Prisma.Decimal, currency: string): Promise<number> {
  return Math.abs(Number(amount.toString())) * (await usdRate(currency));
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

function assetOf(metadata: unknown): string | null {
  const a = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).asset : null;
  return typeof a === 'string' && /^[A-Z0-9_]{2,15}$/.test(a.toUpperCase()) ? a.toUpperCase().replace(/_(ERC20|TRC20|BEP20)$/, '') : null;
}

// ── Calendar periods in the limits time zone ─────────────────────────
export const LIMITS_TIMEZONE = () => process.env.LIMITS_TIMEZONE ?? 'Africa/Tripoli';

function zonedParts(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).reduce<Record<string, number>>((m, p) => (p.type === 'literal' ? m : { ...m, [p.type]: Number(p.value) }), {});
  return { y: parts.year, m: parts.month, d: parts.day, h: parts.hour, mi: parts.minute, s: parts.second };
}
/** UTC instant of local midnight on y-m-d in the zone. */
function zonedMidnight(y: number, m: number, d: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d));
  const p = zonedParts(guess, tz);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - guess.getTime();
  return new Date(guess.getTime() - offset);
}
export function limitPeriods(now = new Date(), tz = LIMITS_TIMEZONE()) {
  const p = zonedParts(now, tz);
  const dayStart = zonedMidnight(p.y, p.m, p.d, tz);
  const next = new Date(Date.UTC(p.y, p.m - 1, p.d + 1));
  const dayEnd = zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), tz);
  const monthStart = zonedMidnight(p.y, p.m, 1, tz);
  const nm = new Date(Date.UTC(p.y, p.m, 1));
  const monthEnd = zonedMidnight(nm.getUTCFullYear(), nm.getUTCMonth() + 1, 1, tz);
  return { dayStart, dayEnd, monthStart, monthEnd };
}
/** dd/mm/yyyy in the limits zone. */
export function formatLimitDate(d: Date, tz = LIMITS_TIMEZONE()): string {
  const p = zonedParts(d, tz);
  return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y}`;
}

async function getUsage(userId: string, action: LimitedAction, now = new Date()): Promise<UsageWindow> {
  const { dayStart, monthStart } = limitPeriods(now);

  let rows: UsageRow[];
  if (action === 'WITHDRAW') {
    // Count the withdrawal records themselves (fiat requests that weren't
    // cancelled/rejected, plus on-chain sends that didn't fail) — on-chain
    // withdrawals never create a Transaction row.
    const [requests, onChain] = await Promise.all([
      prisma.withdrawal.findMany({
        where: { userId, createdAt: { gte: monthStart }, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        select: { amount: true, currency: true, createdAt: true },
      }),
      prisma.onChainTransaction.findMany({
        where: { userId, type: 'WITHDRAWAL', createdAt: { gte: monthStart }, status: { not: 'FAILED' } },
        select: { amount: true, asset: true, createdAt: true },
      }),
    ]);
    rows = [
      ...requests.map((r) => ({ amount: r.amount, currency: r.currency as string, createdAt: r.createdAt })),
      ...onChain.map((r) => ({ amount: r.amount, currency: r.asset, createdAt: r.createdAt })),
    ];
  } else {
    rows = (await prisma.transaction.findMany({
      where: { userId, type: { in: TX_TYPES_FOR_ACTION[action] }, createdAt: { gte: monthStart } },
      select: { amount: true, currency: true, createdAt: true, metadata: true },
    })).map((r) => ({
      amount: r.amount,
      // Long-tail coins sent person-to-person are recorded under a
      // placeholder currency (USDT) with the real asset in metadata; value
      // them as the asset actually sent. (Trade rows carry the traded asset
      // in metadata while amount is the settlement amount — not applicable.)
      currency: (action === 'SEND' ? assetOf(r.metadata) : null) ?? (r.currency as string),
      createdAt: r.createdAt,
    }));
    if (action === 'SEND') {
      // Value already committed to leave but not yet booked as TRANSFER_OUT:
      // pending claim links (booked when claimed) and P2P escrow handed to a
      // buyer (booked as a SELL on completion). Without these, many pending
      // links or trades — each under the per-transaction cap — added up to
      // far more than the daily limit.
      const [links, trades] = await Promise.all([
        prisma.claimLink.findMany({
          where: { senderId: userId, status: 'PENDING', createdAt: { gte: monthStart } },
          select: { amount: true, asset: true, createdAt: true },
        }),
        prisma.p2PTrade.findMany({
          where: { sellerId: userId, status: { notIn: ['CANCELLED', 'EXPIRED'] }, createdAt: { gte: monthStart } },
          select: { cryptoAmount: true, currency: true, baseAsset: true, createdAt: true },
        }),
      ]);
      for (const l of links) rows.push({ amount: l.amount, currency: l.asset as string, createdAt: l.createdAt });
      for (const t of trades) rows.push({ amount: t.cryptoAmount, currency: (t.baseAsset ?? t.currency) as string, createdAt: t.createdAt });
    }
  }

  const rates = new Map<string, number>();
  let dailyUsd = 0;
  let monthlyUsd = 0;
  for (const row of rows) {
    if (!rates.has(row.currency)) rates.set(row.currency, await usdRate(row.currency));
    const usd = Math.abs(Number(row.amount.toString())) * rates.get(row.currency)!;
    monthlyUsd += usd;
    if (row.createdAt >= dayStart) dailyUsd += usd;
  }
  return { dailyUsd, monthlyUsd };
}

const TIER_ORDER: KYCTier[] = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];
const round2 = (n: number) => Math.floor(n * 100) / 100;

export interface LimitStatus {
  action: LimitedAction;
  tier: KYCTier;
  /** Feature not available at this verification level. */
  blocked: boolean;
  perTxUsd: number;
  daily: { limitUsd: number; usedUsd: number; remainingUsd: number; resetsAt: string; resetsOn: string };
  monthly: { limitUsd: number; usedUsd: number; remainingUsd: number; resetsAt: string; resetsOn: string };
  /** Largest single amount allowed right now (USD). */
  maxNowUsd: number;
  /** When maxNowUsd is 0 because a period is used up: when it frees (ISO and dd/mm/yyyy). */
  availableAgainAt: string | null;
  availableAgainOn: string | null;
  /** The next verification level and what it allows for this action, if any. */
  nextTier: { tier: KYCTier; perTxUsd: number; dailyUsd: number; monthlyUsd: number } | null;
}

/** What the customer can do now for one action, and when that changes. */
export async function limitStatus(userId: string, action: LimitedAction, now = new Date()): Promise<LimitStatus> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { kycTier: true, kycStatus: true } });
  if (!user) throw new AppError('User not found', 404);
  const tier = effectiveTier(user);
  const ceiling = KYC_LIMITS[tier][action];
  const usage = await getUsage(userId, action, now);
  const { dayEnd, monthEnd } = limitPeriods(now);
  const dailyRemaining = Math.max(0, ceiling.daily - usage.dailyUsd);
  const monthlyRemaining = Math.max(0, ceiling.monthly - usage.monthlyUsd);
  const blocked = ceiling.perTx === 0;
  const maxNow = blocked ? 0 : round2(Math.min(ceiling.perTx, dailyRemaining, monthlyRemaining));
  // Used up: the monthly limit binds until next month, otherwise until tomorrow.
  let again: Date | null = null;
  if (!blocked && maxNow < 0.01) again = monthlyRemaining < 0.01 ? monthEnd : dayEnd;
  const idx = TIER_ORDER.indexOf(tier);
  const next = TIER_ORDER.slice(idx + 1).find((t) => KYC_LIMITS[t][action].monthly > ceiling.monthly) ?? null;
  return {
    action, tier, blocked,
    perTxUsd: ceiling.perTx,
    daily: { limitUsd: ceiling.daily, usedUsd: round2(usage.dailyUsd), remainingUsd: round2(dailyRemaining), resetsAt: dayEnd.toISOString(), resetsOn: formatLimitDate(dayEnd) },
    monthly: { limitUsd: ceiling.monthly, usedUsd: round2(usage.monthlyUsd), remainingUsd: round2(monthlyRemaining), resetsAt: monthEnd.toISOString(), resetsOn: formatLimitDate(monthEnd) },
    maxNowUsd: maxNow,
    availableAgainAt: again ? again.toISOString() : null,
    availableAgainOn: again ? formatLimitDate(again) : null,
    nextTier: next ? { tier: next, perTxUsd: KYC_LIMITS[next][action].perTx, dailyUsd: KYC_LIMITS[next][action].daily, monthlyUsd: KYC_LIMITS[next][action].monthly } : null,
  };
}

const VERB: Record<LimitedAction, string> = { SEND: 'send', WITHDRAW: 'withdraw', ONRAMP_BUY: 'buy', OFFRAMP_SELL: 'sell' };
const usdText = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`;

/**
 * Throw `AppError` (LIMIT_EXCEEDED, with the limit status in `details`) if
 * the requested action would breach the user's KYC tier limits. Call this
 * BEFORE any step-up challenge and before the write that commits the funds.
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
  const status = await limitStatus(userId, action);
  const requestedUsd = Math.abs(Number(amount.toString())) * (await usdRate(currency));
  const verb = VERB[action];
  const upgrade = status.nextTier ? ' or raise your verification level' : '';

  if (status.blocked) {
    throw new AppError(`Verify your identity to ${verb}`, 403, 'LIMIT_EXCEEDED', { ...status, window: 'TIER', requestedUsd });
  }
  if (requestedUsd > status.perTxUsd) {
    throw new AppError(
      `The most you can ${verb} in one go is ${usdText(status.perTxUsd)}. Use a smaller amount${upgrade}.`,
      400, 'LIMIT_EXCEEDED', { ...status, window: 'PER_TX', requestedUsd },
    );
  }
  if (requestedUsd > status.monthly.remainingUsd) {
    throw new AppError(
      status.monthly.remainingUsd < 0.01
        ? `You've reached your monthly limit to ${verb}. You can ${verb} again from ${status.monthly.resetsOn}${upgrade}.`
        : `You can ${verb} up to ${usdText(status.monthly.remainingUsd)} more this month (resets ${status.monthly.resetsOn})${upgrade}.`,
      400, 'LIMIT_EXCEEDED', { ...status, window: 'MONTHLY', requestedUsd },
    );
  }
  if (requestedUsd > status.daily.remainingUsd) {
    throw new AppError(
      status.daily.remainingUsd < 0.01
        ? `You've reached today's limit to ${verb}. You can ${verb} again from ${status.daily.resetsOn}${upgrade}.`
        : `You can ${verb} up to ${usdText(status.daily.remainingUsd)} more today (resets ${status.daily.resetsOn})${upgrade}.`,
      400, 'LIMIT_EXCEEDED', { ...status, window: 'DAILY', requestedUsd },
    );
  }
}

/** All four actions, for the app and the cockpit. */
export async function allLimitStatuses(userId: string) {
  const actions: LimitedAction[] = ['SEND', 'WITHDRAW', 'ONRAMP_BUY', 'OFFRAMP_SELL'];
  const statuses = await Promise.all(actions.map((a) => limitStatus(userId, a)));
  return Object.fromEntries(actions.map((a, i) => [a, statuses[i]])) as Record<LimitedAction, LimitStatus>;
}

/**
 * Read-only helper for the cockpit: remaining headroom for each action.
 */
export async function getKycHeadroom(userId: string) {
  const all = await allLimitStatuses(userId);
  const headroom: Record<string, { tier: KYCTier; daily: { used: number; limit: number; remaining: number }; monthly: { used: number; limit: number; remaining: number }; perTx: number }> = {};
  for (const [action, st] of Object.entries(all)) {
    headroom[action] = {
      tier: st.tier,
      daily: { used: st.daily.usedUsd, limit: st.daily.limitUsd, remaining: st.daily.remainingUsd },
      monthly: { used: st.monthly.usedUsd, limit: st.monthly.limitUsd, remaining: st.monthly.remainingUsd },
      perTx: st.perTxUsd,
    };
  }
  return headroom;
}
