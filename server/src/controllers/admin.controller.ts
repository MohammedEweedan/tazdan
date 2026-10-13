import { Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { SPREAD_SETTING_KEY, invalidateSpreadCache, getMarketPrice, getConfiguredSpread } from '../services/exchange/priceEngine.service';
import { postLedger, isLedgerCurrency } from '../services/ledger/ledger.service';
import { assertTransitioned, releaseReserve, settleReserve } from '../services/wallet/atomicWallet';
import { collectFee } from '../services/fee/feeCollector.service';
import { generateReferralCode } from '../utils/helpers';
import { createUserWallets } from '../services/wallet/walletDerivation.service';
import { writeAudit } from '../services/platform/audit';
import { recordTransition } from '../services/platform/lifecycle';
import { markWithdrawalHistory } from '../services/wallet/withdrawalHistory';
import { toWire as messageWire } from './message.controller';
import { assertNotSelf } from '../services/platform/segregation';
import { canSeePii } from '../services/platform/pii';
import { getRedisClient } from '../utils/redis';

const rateSchema = z.object({
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive(),
});

const INITIAL_CURRENCIES = ['USDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'] as const;

function adminTempPassword(): string {
  return `Tz-${crypto.randomBytes(6).toString('base64url')}9!`;
}

async function uniqueAdminUsername(seed: string): Promise<string> {
  const base = seed
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._]+/g, '.')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 24) || `user${Date.now().toString(36)}`;
  let candidate = base.length >= 3 ? base : `${base}001`;
  for (let i = 0; i < 50; i += 1) {
    const exists = await prisma.user.findFirst({ where: { username: candidate }, select: { id: true } });
    if (!exists) return candidate;
    const suffix = `${i + 2}`;
    candidate = `${base.slice(0, Math.max(3, 30 - suffix.length))}${suffix}`;
  }
  return `${base.slice(0, 20)}${crypto.randomInt(10000, 99999)}`;
}

type CreditOutcome =
  | { pendingApproval: false; reference: string; ledgerGroupId: string }
  | { pendingApproval: true; approvalId: string };

/**
 * A staff credit to a customer: a controlled adjustment (USER ⟷ ADJUSTMENT).
 * Up to MANUAL_ADJUSTMENT_SINGLE_USD it posts now; above that it becomes a
 * maker-checker request a second staff member must approve.
 */
/** Rolling-24h caps on credits one person may post without a second approver. */
const DAILY_STAFF_SINGLE_CONTROL_USD = (single: number) => Number(process.env.MANUAL_ADJUSTMENT_DAILY_STAFF_USD ?? single * 5);
const DAILY_CUSTOMER_SINGLE_CONTROL_USD = (single: number) => Number(process.env.MANUAL_ADJUSTMENT_DAILY_CUSTOMER_USD ?? single);

/**
 * USD already credited under single control (no approval request) in the last
 * 24 hours, by this staff member and to this customer. Read from the
 * append-only audit trail that postAdjustment writes.
 */
export async function singleControlCreditsUsd(staffId: string, userId: string): Promise<{ staffUsd: number; customerUsd: number }> {
  const { valueInUsd } = await import('../utils/kycLimits');
  const rows = await prisma.auditLog.findMany({
    where: { action: 'LEDGER_ADJUSTMENT_CREDIT', createdAt: { gte: new Date(Date.now() - 86_400_000) }, OR: [{ userId: staffId }, { entityId: userId }] },
    select: { userId: true, entityId: true, newValues: true },
    take: 2000,
  });
  let staffUsd = 0;
  let customerUsd = 0;
  for (const r of rows) {
    const v = (r.newValues ?? {}) as Record<string, any>;
    if (v.approvalRequestId) continue; // dual-controlled credits are not single-control usage
    const usd = await valueInUsd(String(v.amount ?? '0'), String(v.currency ?? 'USD')).catch(() => Number(v.amount ?? 0));
    if (r.userId === staffId) staffUsd += usd;
    if (r.entityId === userId) customerUsd += usd;
  }
  return { staffUsd, customerUsd };
}

// Single-control credits are serialised so parallel requests cannot all pass
// the cumulative check before any of them is recorded.
let creditChain: Promise<unknown> = Promise.resolve();
async function serialiseCredits<T>(fn: () => Promise<T>): Promise<T> {
  const run = creditChain.then(fn, fn);
  creditChain = run.catch(() => undefined);
  return run;
}

async function creditOrRequestApproval(req: AuthRequest, input: { userId: string; currency: string; amount: string; reason: string }): Promise<CreditOutcome> {
  return serialiseCredits(() => creditOrRequestApprovalNow(req, input));
}

async function creditOrRequestApprovalNow(req: AuthRequest, input: { userId: string; currency: string; amount: string; reason: string }): Promise<CreditOutcome> {
  const { postAdjustment, validateAdjustment, SINGLE_CONTROL_LIMIT_USD } = await import('../services/ledger/adjustments.service');
  validateAdjustment({ userId: input.userId, currency: input.currency, amount: input.amount, direction: 'CREDIT' });
  // Nobody credits their own account, with or without a second approver.
  assertNotSelf(req.user!.id, [input.userId], 'manual_credit', { ipAddress: req.ip, path: req.originalUrl });
  const { valueInUsd } = await import('../utils/kycLimits');
  const usd = await valueInUsd(input.amount, input.currency);
  const single = SINGLE_CONTROL_LIMIT_USD();
  let needsApproval = usd > single;
  if (!needsApproval) {
    // Splitting a large credit into many small ones must not avoid dual
    // control: cap what one person may post alone per day, and what one
    // customer may receive that way.
    const used = await singleControlCreditsUsd(req.user!.id, input.userId);
    needsApproval = used.staffUsd + usd > DAILY_STAFF_SINGLE_CONTROL_USD(single)
      || used.customerUsd + usd > DAILY_CUSTOMER_SINGLE_CONTROL_USD(single);
    // Several API workers each serialise only themselves; hold a short
    // cross-worker lock when Redis is there, and send to approval if busy.
    const redis = getRedisClient();
    if (!needsApproval && redis) {
      const got = await redis.set('lock:single-control-credit', req.user!.id, { NX: true, PX: 15_000 }).catch(() => null);
      if (got !== 'OK') needsApproval = true;
      else {
        try {
          const result = await postAdjustment({
            userId: input.userId, currency: input.currency, amount: input.amount, direction: 'CREDIT', reason: input.reason,
            requestedById: req.user!.id, approvedById: req.user!.id,
          });
          return { pendingApproval: false, reference: result.reference, ledgerGroupId: result.ledgerGroupId };
        } finally {
          await redis.del('lock:single-control-credit').catch(() => undefined);
        }
      }
    }
  }
  if (needsApproval) {
    const { requestApproval } = await import('../services/platform/approvals.service');
    const { loadStaffContext } = await import('../services/platform/rbac');
    const staff = await loadStaffContext(req.user!.id);
    if (!staff) throw new AppError('Staff access required', 403);
    const approval = await requestApproval({
      type: 'LEDGER_ADJUSTMENT',
      payload: { userId: input.userId, currency: input.currency, amount: input.amount, direction: 'CREDIT' },
      reason: input.reason.length >= 10 ? input.reason : `Manual credit: ${input.reason}`,
      requestedById: req.user!.id,
      subjectType: 'USER',
      subjectId: input.userId,
      permissions: staff.permissions,
      req,
    });
    return { pendingApproval: true, approvalId: approval.id };
  }
  const result = await postAdjustment({
    userId: input.userId, currency: input.currency, amount: input.amount, direction: 'CREDIT', reason: input.reason,
    requestedById: req.user!.id, approvedById: req.user!.id,
  });
  return { pendingApproval: false, reference: result.reference, ledgerGroupId: result.ledgerGroupId };
}

/**
 * A live rate override changes every customer price on the pair, so in
 * production it needs a second approver like the cockpit's FX override. The
 * legacy admin console wrote the override directly (and indefinitely), which
 * let one person reprice a pair. Development keeps the direct write for the
 * simulators.
 */
function fxOverridesNeedApproval(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.FX_OVERRIDE_REQUIRE_APPROVAL === '1';
}

async function requestLegacyFxOverride(req: AuthRequest, p: { base: string; quote: string; buyPrice: number; sellPrice: number; reason: string }) {
  await import('../services/exchange/fxOverride.service'); // registers the FX_OVERRIDE handler
  const { requestApproval } = await import('../services/platform/approvals.service');
  const { loadStaffContext } = await import('../services/platform/rbac');
  const staff = req.staff ?? await loadStaffContext(req.user!.id);
  if (!staff) throw new AppError('Staff access required', 403);
  return requestApproval({
    type: 'FX_OVERRIDE',
    payload: { base: p.base, quote: p.quote, buyPrice: p.buyPrice, sellPrice: p.sellPrice, expiresInMinutes: 120 },
    reason: p.reason.length >= 10 ? p.reason : `Rate override: ${p.reason}`,
    requestedById: req.user!.id,
    subjectType: 'FX_PAIR',
    subjectId: `${p.base}/${p.quote}`,
    permissions: staff.permissions,
    req,
  });
}

export class AdminController {
  // ── Dashboard ──────────────────────────────────────────────────
  static async getDashboard(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const todayStart  = new Date(new Date().setHours(0, 0, 0, 0));
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const weekStart   = new Date(todayStart.getTime() - 7  * 24 * 60 * 60 * 1000);
      const prevWeekStart = new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000);
      const monthStart  = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prevMonthStart = new Date(todayStart.getTime() - 60 * 24 * 60 * 60 * 1000);
      const yearStart   = new Date(todayStart.getTime() - 365 * 24 * 60 * 60 * 1000);
      const prevYearStart = new Date(todayStart.getTime() - 730 * 24 * 60 * 60 * 1000);

      const FILLED: any = { in: ['FILLED', 'PARTIALLY_FILLED'] };

      // ── Helpers ────────────────────────────────────────────────
      // Total volume of FILLED orders in the window
      const orderVolInRange = (gte: Date, lt?: Date) =>
        prisma.order.aggregate({
          where: { status: FILLED, createdAt: lt ? { gte, lt } : { gte } },
          _sum: { total: true },
        });

      // Fees collected in the window — sourced from the PlatformFee
      // ledger so we capture every kind of fee (orders, withdrawals,
      // P2P trades, crypto orders), not just trading fees on orders.
      const feeInRange = async (gte: Date, lt?: Date) => {
        const [feeAgg, volAgg] = await Promise.all([
          (prisma as any).platformFee.aggregate({
            where: { createdAt: lt ? { gte, lt } : { gte } },
            _sum:  { amountUsd: true },
          }),
          orderVolInRange(gte, lt),
        ]);
        return {
          _sum: {
            fee:   feeAgg?._sum?.amountUsd ?? 0,
            total: volAgg?._sum?.total     ?? 0,
          },
        };
      };

      const txCountInRange = (gte: Date, lt?: Date) => Promise.all([
        prisma.order.count({       where: { createdAt: lt ? { gte, lt } : { gte } } }),
        prisma.deposit.count({     where: { createdAt: lt ? { gte, lt } : { gte } } }),
        prisma.withdrawal.count({  where: { createdAt: lt ? { gte, lt } : { gte } } }),
        prisma.transfer.count({    where: { createdAt: lt ? { gte, lt } : { gte } } }),
        (prisma as any).p2PTrade.count({        where: { createdAt: lt ? { gte, lt } : { gte } } }).catch(() => 0),
        (prisma as any).cardTransaction.count({ where: { createdAt: lt ? { gte, lt } : { gte } } }).catch(() => 0),
      ]).then(([o, d, w, t, p, c]) => ({
        orders: o, deposits: d, withdrawals: w, transfers: t, p2pTrades: p, cardTransactions: c,
        total: o + d + w + t + p + c,
      }));

      const [
        totalUsers, activeUsers, suspendedUsers,
        newUsersToday, newUsersWeek, newUsersMonth,
        pendingDeposits, pendingWithdrawals, pendingKYC,
        totalOrders, frozenUsers,

        // Fees & volume by window
        todayAgg,     yesterdayAgg,
        weekAgg,      prevWeekAgg,
        monthAgg,     prevMonthAgg,
        yearAgg,      prevYearAgg,
        totalAgg,

        // Transaction counts by window
        todayTx, yesterdayTx, weekTx, prevWeekTx, monthTx, prevMonthTx, yearTx, totalTx,

        // Lifetime sums by currency
        totalDepositsUSD, totalDepositsUSDT,
        totalWithdrawalsUSD, totalWithdrawalsUSDT,

        // Recent activity
        recentOrders, recentDeposits, recentWithdrawals,

        buyOrders, sellOrders,
        ordersByPairRaw,
        userGrowthRaw,
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
        prisma.user.count({ where: { role: 'USER', status: 'SUSPENDED' } }),
        prisma.user.count({ where: { role: 'USER', createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { role: 'USER', createdAt: { gte: weekStart } } }),
        prisma.user.count({ where: { role: 'USER', createdAt: { gte: monthStart } } }),
        // Deposits awaiting admin action are created as WAITING_CONFIRMATION
        // (some legacy/manual ones may be PENDING) — count BOTH so the
        // dashboard's "deposits awaiting" badge reflects the real queue.
        prisma.deposit.count({    where: { status: { in: ['WAITING_CONFIRMATION', 'PENDING'] } } }),
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.user.count({       where: { kycStatus: 'PENDING' } }),
        prisma.order.count(),
        prisma.user.count({ where: { role: 'USER', status: 'SUSPENDED' } }),

        // FEE/VOLUME aggregates
        feeInRange(todayStart),
        feeInRange(yesterdayStart, todayStart),
        feeInRange(weekStart),
        feeInRange(prevWeekStart, weekStart),
        feeInRange(monthStart),
        feeInRange(prevMonthStart, monthStart),
        feeInRange(yearStart),
        feeInRange(prevYearStart, yearStart),
        (async () => {
          const [feeAgg, volAgg] = await Promise.all([
            (prisma as any).platformFee.aggregate({ _sum: { amountUsd: true } }),
            prisma.order.aggregate({ where: { status: FILLED }, _sum: { total: true } }),
          ]);
          return { _sum: { fee: feeAgg?._sum?.amountUsd ?? 0, total: volAgg?._sum?.total ?? 0 } };
        })(),

        // TRANSACTION COUNTS
        txCountInRange(todayStart),
        txCountInRange(yesterdayStart, todayStart),
        txCountInRange(weekStart),
        txCountInRange(prevWeekStart, weekStart),
        txCountInRange(monthStart),
        txCountInRange(prevMonthStart, monthStart),
        txCountInRange(yearStart),
        txCountInRange(new Date(0)),

        // Lifetime sums
        prisma.deposit.aggregate({    where: { status: 'CONFIRMED', currency: 'USD' },  _sum: { amount: true } }),
        prisma.deposit.aggregate({    where: { status: 'CONFIRMED', currency: 'USDT' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { status: 'COMPLETED', currency: 'USD' },  _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { status: 'COMPLETED', currency: 'USDT' }, _sum: { amount: true } }),

        // Recent activity
        prisma.order.findMany({       orderBy: { createdAt: 'desc' }, take: 15, include: { user: { select: { email: true, firstName: true, lastName: true } } } }),
        prisma.deposit.findMany({     where: { status: { in: ['WAITING_CONFIRMATION', 'PENDING'] } },   orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { email: true, firstName: true } } } }),
        prisma.withdrawal.findMany({  where: { status: 'PENDING' },   orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { email: true, firstName: true } } } }),

        prisma.order.count({ where: { side: 'BUY'  } }),
        prisma.order.count({ where: { side: 'SELL' } }),
        prisma.order.groupBy({ by: ['baseCurrency', 'quoteCurrency'], _count: { id: true }, _sum: { total: true }, orderBy: { _count: { id: 'desc' } } }),
        prisma.user.groupBy({ by: ['createdAt'], where: { createdAt: { gte: weekStart } }, _count: { id: true }, orderBy: { createdAt: 'asc' } }),
      ]);

      // Fees by source — for the "where revenue comes from" donut.
      const feesBySourceRaw = await (prisma as any).platformFee.groupBy({
        by: ['source'],
        _sum:   { amountUsd: true },
        _count: { id: true },
      });
      const feesBySource = (feesBySourceRaw as any[]).map((r) => ({
        source: r.source,
        totalUsd: Number(r._sum?.amountUsd ?? 0),
        count:    Number(r._count?.id     ?? 0),
      }));

      const num = (v: any): number => {
        if (v === null || v === undefined) return 0;
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const sumOf = (agg: any, key: 'fee' | 'total'): number => num(agg?._sum?.[key]);
      const pctDelta = (current: number, prev: number) => {
        if (prev === 0) return current > 0 ? 100 : 0;
        return ((current - prev) / prev) * 100;
      };
      const periodStats = (curr: any, prev: any, currTx: any, prevTx: any) => ({
        fees:        sumOf(curr, 'fee'),
        prevFees:    sumOf(prev, 'fee'),
        feesDelta:   pctDelta(sumOf(curr, 'fee'),   sumOf(prev, 'fee')),
        volume:      sumOf(curr, 'total'),
        prevVolume:  sumOf(prev, 'total'),
        volumeDelta: pctDelta(sumOf(curr, 'total'), sumOf(prev, 'total')),
        txCount:     currTx.total,
        prevTxCount: prevTx.total,
        txDelta:     pctDelta(currTx.total,         prevTx.total),
      });

      // Format orders by pair
      const ordersByPair = (ordersByPairRaw as any[]).map((p) => ({
        pair: `${p.baseCurrency}/${p.quoteCurrency}`,
        count: p._count.id,
        volume: num(p._sum.total),
      }));

      // Aggregate user growth by date (last 7 days)
      const growthMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        growthMap[d.toISOString().slice(0, 10)] = 0;
      }
      (userGrowthRaw as any[]).forEach((r) => {
        const key = new Date(r.createdAt).toISOString().slice(0, 10);
        if (growthMap[key] !== undefined) growthMap[key] += r._count.id;
      });
      const userGrowth = Object.entries(growthMap).map(([date, count]) => ({ date, count }));

      res.json({
        // ── Top-line counts ────────────────────────────────────
        totalUsers, activeUsers, suspendedUsers, frozenUsers,
        newUsersToday, newUsersWeek, newUsersMonth,
        pendingDeposits, pendingWithdrawals, pendingKYC,
        totalOrders, buyOrders, sellOrders,

        // ── Period comparison ──────────────────────────────────
        today:     periodStats(todayAgg,     yesterdayAgg, todayTx,     yesterdayTx),
        week:      periodStats(weekAgg,      prevWeekAgg,  weekTx,      prevWeekTx),
        month:     periodStats(monthAgg,     prevMonthAgg, monthTx,     prevMonthTx),
        year:      periodStats(yearAgg,      prevYearAgg,  yearTx,      prevWeekTx /* placeholder */),

        // ── Lifetime ───────────────────────────────────────────
        totalFees:        sumOf(totalAgg, 'fee'),
        totalVolume:      sumOf(totalAgg, 'total'),
        totalTransactions: totalTx.total,
        totalOrdersCount: totalTx.orders,
        totalDepositsCount: totalTx.deposits,
        totalWithdrawalsCount: totalTx.withdrawals,

        totalDepositsUSD:     num(totalDepositsUSD._sum.amount),
        totalDepositsUSDT:    num(totalDepositsUSDT._sum.amount),
        totalWithdrawalsUSD:  num(totalWithdrawalsUSD._sum.amount),
        totalWithdrawalsUSDT: num(totalWithdrawalsUSDT._sum.amount),

        // ── Charts & lists ─────────────────────────────────────
        ordersByPair,
        userGrowth,
        feesBySource,
        recentOrders,
        recentDeposits,
        recentWithdrawals,

        // ── Legacy aliases (so old admin index keeps working) ──
        todayFees:        sumOf(todayAgg, 'fee'),
        todayOrderVolume: sumOf(todayAgg, 'total'),
        monthOrderVolume: sumOf(monthAgg, 'total'),
        todayOrders:      todayTx.orders,
        totalOrdersMonth: monthTx.orders,
      });
    } catch (error) { next(error); }
  }

  // ── Exchange Rates ─────────────────────────────────────────────
  //
  // Conventions used by the platform:
  //   buyPrice  = how much QUOTE the user pays for 1 unit of BASE when BUYING base
  //   sellPrice = how much QUOTE the user RECEIVES for 1 unit of BASE when SELLING base
  // So buyPrice > sellPrice — the gap is the platform spread.
  static async updateRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const data = rateSchema.parse(req.body);
      if (data.buyPrice <= data.sellPrice) {
        throw new AppError('Buy price must be greater than sell price (spread is positive)', 400);
      }
      if (data.buyPrice <= 0 || data.sellPrice <= 0) {
        throw new AppError('Prices must be positive', 400);
      }

      const baseU  = base.toUpperCase()  as any;
      const quoteU = quote.toUpperCase() as any;
      const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'Manual rate set from admin console';
      if (fxOverridesNeedApproval()) {
        const approval = await requestLegacyFxOverride(req, { base: baseU, quote: quoteU, buyPrice: data.buyPrice, sellPrice: data.sellPrice, reason });
        return res.status(202).json({ pendingApproval: true, approvalId: approval.id, message: 'Rate overrides need a second approver. The request is waiting in the cockpit approvals queue.' });
      }
      const previous = await prisma.exchangeRate.findUnique({ where: { baseCurrency_quoteCurrency: { baseCurrency: baseU, quoteCurrency: quoteU } } });
      const rate = await prisma.exchangeRate.upsert({
        where:  { baseCurrency_quoteCurrency: { baseCurrency: baseU, quoteCurrency: quoteU } },
        update: { buyPrice: data.buyPrice, sellPrice: data.sellPrice, setBy: req.user!.id, isActive: true, overrideReason: reason, overrideExpiresAt: null },
        create: { baseCurrency: baseU, quoteCurrency: quoteU, buyPrice: data.buyPrice, sellPrice: data.sellPrice, setBy: req.user!.id, isActive: true, overrideReason: reason },
      });

      const { invalidateRate } = await import('../services/exchange/fxRateProvider.service');
      invalidateRate(rate.baseCurrency as string, rate.quoteCurrency as string);
      invalidateRate(rate.quoteCurrency as string, rate.baseCurrency as string);
      const { invalidateRatesCache } = await import('../routes/rates');
      invalidateRatesCache();

      const io = req.app.get('io');
      if (io) io.to('prices').emit('price:update', { baseCurrency: rate.baseCurrency, quoteCurrency: rate.quoteCurrency, buyPrice: rate.buyPrice, sellPrice: rate.sellPrice });

      await writeAudit(prisma, {
        actorId: req.user!.id, action: 'UPDATE_RATE', entity: 'ExchangeRate', entityId: rate.id,
        before: previous ? { buyPrice: previous.buyPrice, sellPrice: previous.sellPrice, isActive: previous.isActive } : null,
        after: { pair: `${baseU}/${quoteU}`, buyPrice: data.buyPrice, sellPrice: data.sellPrice }, reason, req,
      });
      res.json({ rate });
    } catch (error) { next(error); }
  }

  /** Clear the admin override and fall back to the live FX provider. */
  static async clearRateOverride(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const baseU  = base.toUpperCase()  as any;
      const quoteU = quote.toUpperCase() as any;
      const rate = await prisma.exchangeRate.update({
        where: { baseCurrency_quoteCurrency: { baseCurrency: baseU, quoteCurrency: quoteU } },
        data:  { isActive: false, setBy: null },
      }).catch(() => null);

      if (!rate) throw new AppError('Pair not found', 404);

      const { invalidateRate } = await import('../services/exchange/fxRateProvider.service');
      invalidateRate(rate.baseCurrency as string, rate.quoteCurrency as string);
      invalidateRate(rate.quoteCurrency as string, rate.baseCurrency as string);
      const { invalidateRatesCache } = await import('../routes/rates');
      invalidateRatesCache();

      await prisma.auditLog.create({
        data: { userId: req.user!.id, action: 'CLEAR_RATE_OVERRIDE', entity: 'ExchangeRate', entityId: rate.id },
      });
      res.json({ rate });
    } catch (error) { next(error); }
  }

  /**
   * Force a refresh from the FX provider, returning the new live rate.
   *
   * Refresh now CLEARS any admin override on the pair first. Previously it just
   * called getRate, which short-circuits to a fresh override — so refreshing an
   * overridden pair (e.g. USD/LYD stuck at 8.43) re-returned the same frozen
   * value and looked broken. Clearing the override makes "Refresh" do what it
   * says: pull the live upstream (Fulus-first) rate.
   */
  static async refreshRateFromApi(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const baseU  = base.toUpperCase();
      const quoteU = quote.toUpperCase();
      const { getRate, invalidateRate } = await import('../services/exchange/fxRateProvider.service');

      // Demote any override on this pair so getRate consults the live provider.
      // Best-effort — the row may not exist yet (first-ever fetch).
      await prisma.exchangeRate.updateMany({
        where: { baseCurrency: baseU as any, quoteCurrency: quoteU as any, isActive: true },
        data:  { isActive: false, setBy: null },
      }).catch(() => undefined);

      invalidateRate(baseU, quoteU);
      invalidateRate(quoteU, baseU);
      const { invalidateRatesCache } = await import('../routes/rates');
      invalidateRatesCache();
      const fresh = await getRate(baseU, quoteU);
      await prisma.auditLog.create({
        data: { userId: req.user!.id, action: 'REFRESH_RATE_FROM_API', entity: 'ExchangeRate', entityId: `${baseU}/${quoteU}`, newValues: { source: fresh.source } },
      });
      res.json({ rate: fresh });
    } catch (error) { next(error); }
  }

  // ── Deposits ───────────────────────────────────────────────────
  static async getDeposits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status.toUpperCase();

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          where, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.deposit.count({ where }),
      ]);
      res.json({ deposits, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async confirmDeposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Shared with /api/deposits/:id/confirm: segregation of duties, dual
      // control above DEPOSIT_DUAL_CONTROL_USD and an exactly-once credit.
      const { confirmBankDeposit } = await import('../services/wallet/bankDeposits.service');
      const result = await confirmBankDeposit({
        depositId: req.params.id, staffId: req.user!.id, notes: typeof req.body?.notes === 'string' ? req.body.notes : null,
        permissions: req.staff?.permissions, req,
      });
      if (!result.credited) {
        return res.status(202).json({ message: 'A second staff member must approve this deposit before it is credited', pendingApproval: true, approvalId: result.approvalId });
      }
      res.json({ message: 'Deposit confirmed and funds credited' });
    } catch (error) { next(error); }
  }

  static async rejectDeposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findUnique({ where: { id: req.params.id } });
      if (!deposit) throw new AppError('Deposit not found', 404);
      if (!['WAITING_CONFIRMATION', 'PENDING'].includes(deposit.status)) {
        throw new AppError('Deposit is not awaiting confirmation', 400);
      }

      await prisma.$transaction(async (tx) => {
        const moved = await tx.deposit.updateMany({
          where: { id: deposit.id, status: { in: ['WAITING_CONFIRMATION', 'PENDING'] } },
          data: { status: 'REJECTED', adminNotes: req.body.reason || 'Rejected by admin', confirmedBy: req.user!.id },
        });
        assertTransitioned(moved, 'Deposit already processed');
        await recordTransition(tx, { entityType: 'DEPOSIT', entityId: deposit.id, fromState: deposit.status, toState: 'REJECTED', actorType: 'STAFF', actorId: req.user!.id, reason: req.body.reason || null });
        await writeAudit(tx, { actorId: req.user!.id, action: 'REJECT_DEPOSIT', entity: 'Deposit', entityId: deposit.id, before: { status: deposit.status }, after: { status: 'REJECTED' }, reason: req.body.reason || null, req });
      });
      await prisma.notification.create({ data: { userId: deposit.userId, title: 'Deposit Rejected', message: `Your deposit of ${deposit.amount} ${deposit.currency} has been rejected. Reason: ${req.body.reason || 'N/A'}`, type: 'deposit' } });
      res.json({ message: 'Deposit rejected' });
    } catch (error) { next(error); }
  }

  // ── Withdrawals ────────────────────────────────────────────────
  static async getWithdrawals(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status.toUpperCase();

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.withdrawal.count({ where }),
      ]);
      res.json({ withdrawals, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async processWithdrawal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
      if (!withdrawal) throw new AppError('Withdrawal not found', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('Withdrawal is not pending', 400);
      // Neither the release nor one of the multi-sig approvals may come from the owner.
      assertNotSelf(req.user!.id, [withdrawal.userId], 'process_withdrawal', { ipAddress: req.ip, path: req.originalUrl });

      // ── MULTI-SIG GATE ──────────────────────────────────────────────
      // Withdrawals at/above WITHDRAWAL_MULTISIG_USD require N distinct admin
      // approvals (WITHDRAWAL_MULTISIG_N, default 2) before funds are released.
      // A single compromised admin session therefore cannot drain the treasury.
      const thresholdUsd = Number(process.env.WITHDRAWAL_MULTISIG_USD ?? '10000');
      const requiredApprovals = Math.max(1, Number(process.env.WITHDRAWAL_MULTISIG_N ?? '2'));
      // Value the withdrawal in USD (1:1 for USD/USDT/USDC; FX otherwise).
      let usdValue = Number(withdrawal.amount);
      if (!['USD', 'USDT', 'USDC'].includes(withdrawal.currency)) {
        try {
          const { getRate } = await import('../services/exchange/fxRateProvider.service');
          const pair = await getRate(withdrawal.currency, 'USD');
          usdValue = Number(withdrawal.amount) * Number(pair.buyPrice || pair.sellPrice || 1);
        } catch { /* fall back to raw amount */ }
      }

      if (usdValue >= thresholdUsd && requiredApprovals > 1) {
        // Record this admin's approval (idempotent per admin).
        await prisma.withdrawalApproval.upsert({
          where: { withdrawalId_adminId: { withdrawalId: withdrawal.id, adminId: req.user!.id } },
          update: { decision: 'APPROVE', note: req.body.notes },
          create: { withdrawalId: withdrawal.id, adminId: req.user!.id, decision: 'APPROVE', note: req.body.notes },
        });
        const approvals = await prisma.withdrawalApproval.count({
          where: { withdrawalId: withdrawal.id, decision: 'APPROVE' },
        });
        if (approvals < requiredApprovals) {
          await writeAudit(prisma, { actorId: req.user!.id, action: 'WITHDRAWAL_APPROVAL', entity: 'Withdrawal', entityId: withdrawal.id, after: { approvals, required: requiredApprovals }, reason: req.body?.notes ?? null, req });
          return res.json({
            message: `Approval recorded (${approvals}/${requiredApprovals}). Awaiting ${requiredApprovals - approvals} more admin approval(s) before release.`,
            pending: true, approvals, required: requiredApprovals,
          });
        }
        // Threshold met → fall through to release.
      }

      await prisma.$transaction(async (tx: any) => {
        // Claim the transition first: a second concurrent approval (another
        // admin, a double-click) finds it no longer PENDING and pays nothing.
        const moved = await tx.withdrawal.updateMany({
          where: { id: withdrawal.id, status: 'PENDING' },
          data: { status: 'COMPLETED', processedAt: new Date(), processedBy: req.user!.id, adminNotes: req.body.notes },
        });
        assertTransitioned(moved, 'Withdrawal already processed');
        const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: withdrawal.userId, currency: withdrawal.currency } } });
        const balanceBefore = parseFloat(wallet?.balance.toString() || '0');
        const amount = parseFloat(withdrawal.amount.toString());

        // Spend the reservation made at request time. Refuses (409) if the
        // reserved funds don't cover it rather than pushing the wallet negative.
        await settleReserve(tx, withdrawal.userId, withdrawal.currency, withdrawal.amount);
        // One history row per withdrawal: mark the request-time row completed.
        // Withdrawals created before that row existed get one now.
        const updatedRows = await markWithdrawalHistory(tx, withdrawal.reference, 'COMPLETED');
        if (updatedRows === 0) {
          await tx.transaction.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL', currency: withdrawal.currency, amount: new Decimal(-amount), fee: withdrawal.fee, balanceBefore, balanceAfter: balanceBefore - amount, reference: withdrawal.reference, description: `Withdrawal processed`, metadata: { withdrawalId: withdrawal.id, status: 'COMPLETED' } } });
        }

        // Ledger mirror: user balance leaves — net goes off-platform, fee to platform.
        if (isLedgerCurrency(withdrawal.currency)) {
          const feeD = new Decimal(withdrawal.fee.toString());
          const net = new Decimal(withdrawal.amount.toString()).minus(feeD);
          await postLedger(tx, {
            refType: 'withdrawal', refId: withdrawal.id, memo: `Withdrawal ${withdrawal.currency}`,
            legs: [
              { type: 'USER', userId: withdrawal.userId, currency: withdrawal.currency as any, amount: new Decimal(withdrawal.amount.toString()).neg() },
              { type: 'SYSTEM_OFFRAMP', currency: withdrawal.currency as any, amount: net },
              ...(feeD.gt(0) ? [{ type: 'PLATFORM' as const, currency: withdrawal.currency as any, amount: feeD }] : []),
            ],
          }, { allowNegativeUser: true });
        }

        // The fee is revenue only once the withdrawal actually completes —
        // booking it at request time kept it even when the user cancelled or
        // the request was rejected.
        if (new Decimal(withdrawal.fee.toString()).gt(0)) {
          await collectFee({
            tx,
            source: 'withdrawal',
            sourceId: withdrawal.id,
            payerId: withdrawal.userId,
            amount: new Decimal(withdrawal.fee.toString()),
            currency: withdrawal.currency,
            description: `Withdrawal fee · ${withdrawal.currency}`,
            metadata: { network: withdrawal.network ?? null },
          });
        }

        // If USDT withdrawal, queue on-chain send
        if (withdrawal.currency === 'USDT' && withdrawal.walletAddress) {
          await tx.onChainTx.create({
            data: {
              withdrawalId: withdrawal.id,
              toAddress: withdrawal.walletAddress,
              network: withdrawal.network || 'TRC20',
              amount: withdrawal.netAmount,
              currency: 'USDT',
              status: 'QUEUED',
            },
          });
        }

        await tx.notification.create({ data: { userId: withdrawal.userId, title: 'Withdrawal Completed', message: `Your withdrawal of ${withdrawal.netAmount} ${withdrawal.currency} has been completed.${withdrawal.currency === 'USDT' ? ` USDT sent to ${withdrawal.walletAddress}` : ''}`, type: 'withdrawal' } });
        await recordTransition(tx, { entityType: 'WITHDRAWAL', entityId: withdrawal.id, fromState: 'PENDING', toState: 'COMPLETED', actorType: 'STAFF', actorId: req.user!.id, reason: req.body?.notes ?? null });
        await writeAudit(tx, { actorId: req.user!.id, action: 'PROCESS_WITHDRAWAL', entity: 'Withdrawal', entityId: withdrawal.id, before: { status: 'PENDING' }, after: { status: 'COMPLETED', amount: withdrawal.amount, currency: withdrawal.currency }, reason: req.body?.notes ?? null, req });
      });
      res.json({ message: 'Withdrawal processed' });
    } catch (error) { next(error); }
  }

  static async rejectWithdrawal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
      if (!withdrawal) throw new AppError('Withdrawal not found', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('Withdrawal is not pending', 400);

      // Unfreeze + mark rejected atomically. No ledger leg: rejecting only
      // releases the `frozen` reservation — no real balance ever moved (the
      // settlement, which does move money, is the only ledgered withdrawal step).
      await prisma.$transaction(async (tx) => {
        const moved = await tx.withdrawal.updateMany({
          where: { id: withdrawal.id, status: 'PENDING' },
          data: { status: 'REJECTED', adminNotes: req.body.reason || 'Rejected by admin', processedBy: req.user!.id },
        });
        assertTransitioned(moved, 'Withdrawal already processed');
        await releaseReserve(tx, withdrawal.userId, withdrawal.currency, withdrawal.amount);
        await markWithdrawalHistory(tx, withdrawal.reference, 'REJECTED');
        await tx.notification.create({ data: { userId: withdrawal.userId, title: 'Withdrawal Rejected', message: `Your withdrawal has been rejected. Reason: ${req.body.reason || 'N/A'}`, type: 'withdrawal' } });
        await recordTransition(tx, { entityType: 'WITHDRAWAL', entityId: withdrawal.id, fromState: 'PENDING', toState: 'REJECTED', actorType: 'STAFF', actorId: req.user!.id, reason: req.body.reason || null });
        await writeAudit(tx, { actorId: req.user!.id, action: 'REJECT_WITHDRAWAL', entity: 'Withdrawal', entityId: withdrawal.id, before: { status: 'PENDING' }, after: { status: 'REJECTED' }, reason: req.body.reason || null, req });
      });
      res.json({ message: 'Withdrawal rejected and funds unfrozen' });
    } catch (error) { next(error); }
  }

  // ── KYC ────────────────────────────────────────────────────────
  static async getKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const where: any = { kycStatus: { not: 'NOT_SUBMITTED' } };
      // PENDING also covers verified customers asking for a higher level
      // (they stay APPROVED while their new documents are reviewed).
      if (status?.toUpperCase() === 'PENDING') {
        where.kycStatus = undefined;
        where.OR = [{ kycStatus: 'PENDING' }, { kycStatus: 'APPROVED', kycDocuments: { some: { status: 'PENDING' } } }];
      } else if (status) where.kycStatus = status.toUpperCase();

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where, select: { id: true, email: true, firstName: true, lastName: true, phone: true, kycStatus: true, kycTier: true, createdAt: true, kycDocuments: true },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.user.count({ where }),
      ]);
      res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async approveKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // The tier drives every transaction limit, so approval must set it.
      // Identity documents alone justify TIER_1; the reviewer passes TIER_2
      // (address verified) or TIER_3 (source of funds reviewed) explicitly.
      const { tier } = z.object({
        tier: z.enum(['TIER_1', 'TIER_2', 'TIER_3']).default('TIER_1'),
      }).parse(req.body ?? {});
      assertNotSelf(req.user!.id, [req.params.userId], 'kyc_approve', { ipAddress: req.ip, path: req.originalUrl });
      const before = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { kycStatus: true, kycTier: true } });
      if (!before) throw new AppError('User not found', 404);
      await prisma.user.update({ where: { id: req.params.userId }, data: { kycStatus: 'APPROVED', kycTier: tier } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'KYC_APPROVE', entity: 'User', entityId: req.params.userId, before, after: { kycStatus: 'APPROVED', kycTier: tier }, reason: req.body?.note ?? null, req });
      await prisma.kYCDocument.updateMany({ where: { userId: req.params.userId, status: 'PENDING' }, data: { status: 'APPROVED', reviewedBy: req.user!.id, reviewedAt: new Date() } });
      await prisma.notification.create({ data: { userId: req.params.userId, title: 'KYC Approved', message: 'Your identity verification has been approved. You can now trade.', type: 'kyc' } });
      res.json({ message: 'KYC approved' });
    } catch (error) { next(error); }
  }

  static async rejectKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      assertNotSelf(req.user!.id, [req.params.userId], 'kyc_reject', { ipAddress: req.ip, path: req.originalUrl });
      const before = await prisma.user.findUnique({ where: { id: req.params.userId }, select: { kycStatus: true, kycTier: true } });
      if (!before) throw new AppError('User not found', 404);
      // Declining a verified customer's request for a higher level leaves the
      // level they already have; only the new documents are rejected.
      if (before.kycStatus === 'APPROVED') {
        await prisma.kYCDocument.updateMany({ where: { userId: req.params.userId, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: req.body.reason, reviewedBy: req.user!.id, reviewedAt: new Date() } });
        await writeAudit(prisma, { actorId: req.user!.id, action: 'KYC_UPGRADE_REJECT', entity: 'User', entityId: req.params.userId, before, after: before, reason: req.body?.reason ?? null, req });
        await prisma.notification.create({ data: { userId: req.params.userId, title: 'Limit increase declined', message: `We couldn't raise your verification level. Reason: ${req.body.reason || 'N/A'}. Your current limits are unchanged.`, type: 'kyc' } });
        res.json({ message: 'Upgrade request rejected; current level kept' });
        return;
      }
      await prisma.user.update({ where: { id: req.params.userId }, data: { kycStatus: 'REJECTED', kycTier: 'TIER_0' } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'KYC_REJECT', entity: 'User', entityId: req.params.userId, before, after: { kycStatus: 'REJECTED', kycTier: 'TIER_0' }, reason: req.body?.reason ?? null, req });
      await prisma.kYCDocument.updateMany({ where: { userId: req.params.userId, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: req.body.reason, reviewedBy: req.user!.id, reviewedAt: new Date() } });
      await prisma.notification.create({ data: { userId: req.params.userId, title: 'KYC Rejected', message: `Your identity verification was rejected. Reason: ${req.body.reason || 'N/A'}`, type: 'kyc' } });
      res.json({ message: 'KYC rejected' });
    } catch (error) { next(error); }
  }

  // ── Users ──────────────────────────────────────────────────────
  static async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        email: z.string().email(),
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        username: z.string().min(3).max(30).regex(/^[a-z0-9._]+$/i).optional().or(z.literal('')),
        phoneCountryCode: z.string().min(1).max(4).regex(/^\d+$/).optional().or(z.literal('')),
        phone: z.string().min(4).max(20).optional().or(z.literal('')),
        country: z.string().length(2).optional().or(z.literal('')),
        dateOfBirth: z.coerce.date().optional(),
        password: z.string().min(8).max(128).optional().or(z.literal('')),
        status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).default('ACTIVE'),
        kycStatus: z.enum(['NOT_SUBMITTED', 'PENDING', 'APPROVED']).default('NOT_SUBMITTED'),
        emailVerified: z.boolean().default(true),
        relationship: z.string().max(120).optional().or(z.literal('')),
        note: z.string().max(500).optional().or(z.literal('')),
        initialBalances: z.array(z.object({
          currency: z.string().min(1).max(10),
          amount: z.number().positive(),
        })).max(12).optional(),
      });
      const data = schema.parse(req.body);
      // Opening balances are controlled adjustments (validated before the
      // account exists so a bad currency doesn't leave a half-created user).
      if (data.initialBalances?.length) {
        const { validateAdjustment } = await import('../services/ledger/adjustments.service');
        for (const b of data.initialBalances) validateAdjustment({ userId: 'new-user', currency: b.currency.toUpperCase(), amount: b.amount, direction: 'CREDIT' });
      }
      const email = data.email.trim().toLowerCase();
      const phoneDigits = data.phone?.replace(/\D/g, '') ?? '';
      const normalisedPhone = data.phoneCountryCode && phoneDigits ? `+${data.phoneCountryCode}${phoneDigits}` : null;
      const username = data.username?.trim()
        ? data.username.trim().toLowerCase()
        : await uniqueAdminUsername(`${data.firstName}.${data.lastName}`);

      const [existingEmail, existingPhone, existingHandle] = await Promise.all([
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
        normalisedPhone ? prisma.user.findUnique({ where: { phone: normalisedPhone }, select: { id: true } }) : Promise.resolve(null),
        prisma.user.findFirst({ where: { username }, select: { id: true } }),
      ]);
      if (existingEmail) throw new AppError('A user with this email already exists', 400);
      if (existingPhone) throw new AppError('A user with this phone already exists', 400);
      if (existingHandle) throw new AppError('A user with this handle already exists', 400);

      const generatedPassword = data.password ? null : adminTempPassword();
      const passwordHash = await bcrypt.hash(data.password || generatedPassword!, 12);
      const referralCode = generateReferralCode();

      const user = await prisma.$transaction(async (tx: any) => {
        const created = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            phone: normalisedPhone,
            phoneCountryCode: data.phoneCountryCode || null,
            country: data.country ? data.country.toUpperCase() : null,
            dateOfBirth: data.dateOfBirth,
            username,
            profilePublic: true,
            referralCode,
            status: data.status,
            kycStatus: data.kycStatus,
            emailVerified: data.emailVerified,
          },
          select: {
            id: true, email: true, firstName: true, lastName: true, username: true,
            phone: true, country: true, status: true, kycStatus: true, emailVerified: true,
            referralCode: true, createdAt: true,
          },
        });

        await tx.wallet.createMany({
          data: INITIAL_CURRENCIES.map((currency) => ({ userId: created.id, currency })),
          skipDuplicates: true,
        });

        await tx.auditLog.create({
          data: {
            userId: req.user!.id,
            action: 'ADMIN_CREATE_USER',
            entity: 'User',
            entityId: created.id,
            newValues: {
              email,
              username,
              status: data.status,
              kycStatus: data.kycStatus,
              emailVerified: data.emailVerified,
              relationship: data.relationship || null,
              note: data.note || null,
              initialBalances: data.initialBalances ?? [],
            },
          },
        });

        await tx.notification.create({
          data: {
            userId: created.id,
            title: 'Welcome to tazdan',
            message: 'Your account was created by the tazdan team. Please sign in and change your password.',
            type: 'security',
          },
        });

        return created;
      });

      createUserWallets(user.id).catch((e) => {
        console.error('[wallet] createUserWallets failed for admin-created user', user.id, e);
      });

      // Same control as a manual credit: posted against ADJUSTMENT up to the
      // single-control limit, otherwise queued for a second approver. (Opening
      // balances used to be booked as outside money by one person, CL-48.)
      const openingBalances: Array<{ currency: string; amount: number } & CreditOutcome> = [];
      for (const b of data.initialBalances ?? []) {
        const reason = `Opening balance at onboarding: ${data.note || data.relationship || 'no note'}`.slice(0, 500);
        const outcome = await creditOrRequestApproval(req, { userId: user.id, currency: b.currency.toUpperCase(), amount: String(b.amount), reason });
        openingBalances.push({ currency: b.currency.toUpperCase(), amount: b.amount, ...outcome });
      }
      const queued = openingBalances.filter((b) => b.pendingApproval).length;

      res.status(201).json({
        user,
        openingBalances,
        temporaryPassword: generatedPassword,
        message: `${generatedPassword ? 'User created. Temporary password returned once.' : 'User created.'}${queued ? ` ${queued} opening balance${queued > 1 ? 's' : ''} above the single-control limit await a second approver.` : ''}`,
      });
    } catch (error) { next(error); }
  }

  // A user's full balance sheet — fiat/stable Wallet rows + on-chain crypto
  // columns + altBalances — so an admin can see what they hold before crediting.
  static async getUserBalances(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.id;
      const [walletRows, uw] = await Promise.all([
        prisma.wallet.findMany({ where: { userId }, orderBy: { currency: 'asc' } }),
        prisma.userWallet.findUnique({ where: { userId } }),
      ]);
      const wallets = walletRows.map((w) => ({ currency: w.currency, balance: w.balance.toString(), frozen: w.frozen.toString() }));
      const crypto: { currency: string; balance: string }[] = [];
      if (uw) {
        const native: Record<string, any> = { ETH: uw.ethBalance, BTC: uw.btcBalance, SOL: uw.solBalance, 'USDT (ERC20)': uw.usdtErc20Bal, 'USDT (TRC20)': uw.usdtTrc20Bal };
        for (const [k, v] of Object.entries(native)) if (v != null && Number(v) !== 0) crypto.push({ currency: k, balance: v.toString() });
        const alts = (uw.altBalances && typeof uw.altBalances === 'object' ? uw.altBalances : {}) as Record<string, unknown>;
        for (const [sym, v] of Object.entries(alts)) if (Number(v) !== 0) crypto.push({ currency: sym, balance: String(v) });
      }
      res.json({ wallets, crypto });
    } catch (error) { next(error); }
  }

  static async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const kycStatus = req.query.kycStatus as string | undefined;
      const where: any = { role: 'USER' };
      if (status) where.status = status.toUpperCase();
      if (kycStatus) where.kycStatus = kycStatus.toUpperCase();
      // Matching on email/phone would let staff without customers.pii recover
      // masked contact details one character at a time.
      if (search) where.OR = [
        ...(canSeePii(req) ? [{ email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search, mode: 'insensitive' } }] : []),
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where, select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true, kycStatus: true, createdAt: true, lastLoginAt: true, wallets: true },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.user.count({ where }),
      ]);
      res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) throw new AppError('Invalid status', 400);
      const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: { status: true, role: true } });
      if (!before) throw new AppError('User not found', 404);
      if (before.role === 'ADMIN' && status !== 'ACTIVE' && req.params.id === req.user!.id) {
        throw new AppError('You cannot suspend your own staff account', 400);
      }
      await prisma.user.update({ where: { id: req.params.id }, data: { status } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'UPDATE_USER_STATUS', entity: 'User', entityId: req.params.id, before: { status: before.status }, after: { status }, reason: req.body?.reason ?? null, req });
      // A ban/suspension must take effect NOW, not when the access token
      // expires — kill refresh tokens and live access tokens together.
      if (status !== 'ACTIVE') {
        const { revokeAllUserSessions } = await import('../middleware/auth');
        await revokeAllUserSessions(req.params.id);
      }
      res.json({ message: `User status updated to ${status}` });
    } catch (error) { next(error); }
  }

  // ── Settings ───────────────────────────────────────────────────
  static async getSettings(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Ensure the configurable quote spread always appears in the panel,
      // seeded at the current default on first view.
      await prisma.platformSettings.upsert({
        where: { key: SPREAD_SETTING_KEY },
        update: {},
        create: {
          key: SPREAD_SETTING_KEY,
          value: process.env.QUOTE_SPREAD_PCT ?? '0.025',
          description: 'Quote spread as a decimal fraction (0.025 = 2.5%). Marks BUY prices up and SELL prices down.',
        },
      });
      // Physical-card order fee (USD). Seeded at the $20 product minimum so it
      // always shows up in the panel and is editable inline.
      await prisma.platformSettings.upsert({
        where: { key: 'card_physical_order_fee' },
        update: {},
        create: {
          key: 'card_physical_order_fee',
          value: '20',
          description: 'One-off fee (USD) to order a physical card. Minimum 20.',
        },
      });
      const settings = await prisma.platformSettings.findMany({ orderBy: { key: 'asc' } });
      res.json({ settings });
    } catch (error) { next(error); }
  }

  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { settings } = req.body;
      for (const [key, value] of Object.entries(settings)) {
        // The quote spread is a decimal fraction in [0, 0.5). Reject anything
        // out of range so a typo can't mint absurd or negative quotes.
        if (key === SPREAD_SETTING_KEY) {
          const n = Number(value);
          if (!Number.isFinite(n) || n < 0 || n >= 0.5) {
            throw new AppError('quote_spread_pct must be a fraction between 0 and 0.5 (e.g. 0.025 = 2.5%)', 400);
          }
        }
        // The physical-card order fee is floored at the $20 product minimum.
        if (key === 'card_physical_order_fee') {
          const n = Number(value);
          if (!Number.isFinite(n) || n < 20) {
            throw new AppError('card_physical_order_fee must be a number of at least 20 (USD)', 400);
          }
        }
        const previous = await prisma.platformSettings.findUnique({ where: { key } });
        await prisma.platformSettings.upsert({
          where: { key }, update: { value: String(value), updatedBy: req.user!.id },
          create: { key, value: String(value), updatedBy: req.user!.id },
        });
        await writeAudit(prisma, { actorId: req.user!.id, action: 'UPDATE_SETTING', entity: 'PlatformSettings', entityId: key, before: previous ? { value: previous.value } : null, after: { value: String(value) }, reason: req.body?.reason ?? null, req });
      }
      if (Object.prototype.hasOwnProperty.call(settings, SPREAD_SETTING_KEY)) {
        invalidateSpreadCache();
      }
      res.json({ message: 'Settings updated' });
    } catch (error) { next(error); }
  }

  // ── Fund integrity + ledger reconciliation (treasury safety) ───
  static async getFundIntegrity(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { auditFundIntegrity } = await import('../services/ledger/fundIntegrity.service');
      const { reconcileLedger, isTradingHalted } = await import('../services/ledger/reconcile.service');
      // Audit read-only here (don't trip the halt from a manual view).
      const [funds, ledger, halted] = await Promise.all([
        auditFundIntegrity({ haltOnBreach: false }),
        reconcileLedger(),
        isTradingHalted(),
      ]);
      res.json({ tradingHalted: halted, funds, ledger });
    } catch (error) { next(error); }
  }

  // Clear a trading halt after an investigation (admin only, audit-logged).
  static async clearTradingHalt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { setTradingHalt } = await import('../services/ledger/reconcile.service');
      await setTradingHalt(false, `cleared by admin ${req.user!.id}`);
      await prisma.auditLog.create({
        data: { action: 'CLEAR_TRADING_HALT', entity: 'ledger', userId: req.user!.id },
      }).catch(() => { /* audit log is best-effort */ });
      res.json({ message: 'Trading halt cleared' });
    } catch (error) { next(error); }
  }

  // Acknowledge a currency's historical unbacked value after investigation.
  // Moves no money (the old version booked an admin credit to make the
  // warning go away); records who looked and what they found, so any later
  // unbacked value stands out. Audit-logged inside acknowledgeBaseline.
  static async reconcileFundIntegrity(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        currency: z.string().min(1).max(10),
        note: z.string().min(10, 'Write what was found (at least 10 characters)').max(500),
      });
      const { currency, note } = schema.parse(req.body);
      const { acknowledgeBaseline } = await import('../services/ledger/fundIntegrity.service');
      const result = await acknowledgeBaseline({ currency, staffId: req.user!.id, note, req });
      res.json({
        message: `Acknowledged ${result.acknowledgedAmount} ${result.currency} of historical unbacked value. No money moved.`,
        ...result,
        // Fields the older admin app reads.
        reconciledAmount: result.acknowledgedAmount,
        diffAfter: result.unbackedSinceBaseline,
      });
    } catch (error) { next(error); }
  }

  static async backfillLedgerOpeningBalances(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { backfillLedgerOpeningBalances } = await import('../services/ledger/backfill.service');
      const report = await backfillLedgerOpeningBalances();
      await prisma.auditLog.create({
        data: {
          userId: req.user!.id,
          action: 'LEDGER_OPENING_BALANCE_BACKFILL',
          entity: 'ledger',
          newValues: report as any,
        },
      }).catch(() => {});
      res.json({
        message: 'Ledger opening-balance backfill completed. Set LEDGER_ALLOW_NEGATIVE_USER=0 after reviewing the report.',
        report,
      });
    } catch (error) { next(error); }
  }

  static async getOperationalReadiness(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { buildOperationalReadiness } = await import('../services/ops/operationalReadiness.service');
      res.json(await buildOperationalReadiness());
    } catch (error) { next(error); }
  }

  static async runDailyClose(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({ date: z.string().datetime().optional() });
      const { date } = schema.parse(req.body ?? {});
      const { runDailyClose } = await import('../services/ops/operationalReadiness.service');
      const result = await runDailyClose(req.user!.id, date ? new Date(date) : new Date());
      res.json({ message: 'Daily close completed', ...result });
    } catch (error) { next(error); }
  }

  static async markAuditLogReviewed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({ note: z.string().max(500).optional() });
      const { note } = schema.parse(req.body ?? {});
      const { markAuditLogReviewed } = await import('../services/ops/operationalReadiness.service');
      const review = await markAuditLogReviewed(req.user!.id, note);
      res.json({ message: 'Audit log review recorded', review });
    } catch (error) { next(error); }
  }

  // ── FX status (LYD scrape + order-book skew, for cross-check) ───
  static async getFxStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const hours = Math.min(168, Math.max(1, parseInt(String(req.query.hours ?? '24'), 10) || 24));
      const { getScrapedLydRates, getRate } = await import('../services/exchange/fxRateProvider.service');
      const { lydOrderBookState, getLydHistory, getPairHistory } = await import('../services/exchange/lydOrderBook.service');
      const { FULUS_CURRENCIES, fulusCachedRates } = await import('../services/exchange/fulus.service');

      const [lydScraped, history] = await Promise.all([getScrapedLydRates(), getLydHistory(hours)]);

      // Per-currency block: live buy/sell (Fulus-first via getRate) + history line
      // for each currency we carry vs LYD. Powers the admin sparkline strip.
      const currencies = await Promise.all(
        FULUS_CURRENCIES.map(async (code) => {
          const pair = `${code}/LYD`;
          const [rate, hist] = await Promise.all([
            getRate(code, 'LYD').catch(() => null),
            code === 'USD' ? Promise.resolve(history) : getPairHistory(pair, hours).catch(() => []),
          ]);
          return {
            code,
            pair,
            buyPrice:  rate ? Number(rate.buyPrice)  : null,
            sellPrice: rate ? Number(rate.sellPrice) : null,
            source:    rate ? rate.source : null,
            history:   (hist as Array<{ t: number; price: number }>).map((h) => ({ t: h.t, price: h.price })),
          };
        }),
      );

      res.json({
        lydParallelScraped: lydScraped,      // LYD per 1 unit, straight from the scrape (fallback)
        fulusCached: fulusCachedRates(),     // Latest webhook/poll-fed Fulus values for admin visibility
        lydOrderBook: lydOrderBookState(),   // net flow + current upward skew
        usdLydHistory: history,              // [{ t, price, volumeUsd, skewPct }] — USD/LYD candlestick
        currencies,                          // [{ code, pair, buyPrice, sellPrice, source, history }]
        historyHours: hours,
        generatedAt: Date.now(),
      });
    } catch (error) { next(error); }
  }

  // ── Exposure & total holdings ──────────────────────────────────
  // Aggregates every user's crypto + fiat balances, values them at the
  // current market price, and computes the platform's payout exposure if
  // all users were to liquidate instantly at our SELL price (market minus
  // the configured spread). The gap between holdings value and exposure is
  // the spread cushion we'd capture on a mass liquidation.
  static async getExposure(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // 1) Crypto: sum the dedicated Decimal columns across all UserWallets.
      const cryptoAgg = await prisma.userWallet.aggregate({
        _sum: { ethBalance: true, btcBalance: true, solBalance: true, usdtErc20Bal: true, usdtTrc20Bal: true },
      });
      const holdings: Record<string, number> = {
        ETH:  Number(cryptoAgg._sum.ethBalance ?? 0),
        BTC:  Number(cryptoAgg._sum.btcBalance ?? 0),
        SOL:  Number(cryptoAgg._sum.solBalance ?? 0),
        USDT: Number(cryptoAgg._sum.usdtErc20Bal ?? 0) + Number(cryptoAgg._sum.usdtTrc20Bal ?? 0),
      };

      // 2) Crypto: fold in the altBalances JSON ledger (BNB, XRP, …).
      const alts = await prisma.userWallet.findMany({ select: { altBalances: true } });
      for (const w of alts) {
        const bal = (w.altBalances ?? {}) as Record<string, unknown>;
        for (const [sym, v] of Object.entries(bal)) {
          const n = Number(v);
          if (Number.isFinite(n) && n !== 0) holdings[sym.toUpperCase()] = (holdings[sym.toUpperCase()] ?? 0) + n;
        }
      }

      // 3) Fiat: sum Wallet balances per currency.
      const fiatRows = await prisma.wallet.groupBy({ by: ['currency'], _sum: { balance: true } });

      // 4) Price every crypto symbol (USDT/USD/USDC = 1). Failures are skipped
      //    and surfaced in `unpriced` so the dashboard can flag incomplete data.
      const spread = Number(await getConfiguredSpread());
      const STABLE = new Set(['USDT', 'USDC', 'USD']);
      const priced: { symbol: string; amount: number; price: number; valueUsd: number }[] = [];
      const unpriced: string[] = [];
      await Promise.all(Object.entries(holdings).map(async ([sym, amount]) => {
        if (amount === 0) return;
        if (STABLE.has(sym)) { priced.push({ symbol: sym, amount, price: 1, valueUsd: amount }); return; }
        try {
          const price = Number(await getMarketPrice(`${sym}USDT`));
          priced.push({ symbol: sym, amount, price, valueUsd: amount * price });
        } catch {
          unpriced.push(sym);
        }
      }));

      const cryptoValueUsd = priced.reduce((s, r) => s + r.valueUsd, 0);

      // 5) Fiat → USD via the FX provider (USD/USDT/USDC = 1).
      const { getRate } = await import('../services/exchange/fxRateProvider.service');
      let fiatValueUsd = 0;
      const fiatBreakdown: { currency: string; amount: number; valueUsd: number }[] = [];
      for (const row of fiatRows) {
        const cur = String(row.currency);
        const amount = Number(row._sum.balance ?? 0);
        if (amount === 0) continue;
        let valueUsd = amount;
        if (!STABLE.has(cur) && cur !== 'USD') {
          try {
            const pair = await getRate(cur, 'USD');
            const usdPerUnit = Number(pair.buyPrice || pair.sellPrice);
            valueUsd = usdPerUnit > 0 ? amount * usdPerUnit : amount;
          } catch { /* fall back to 1:1 */ }
        }
        fiatValueUsd += valueUsd;
        fiatBreakdown.push({ currency: cur, amount, valueUsd });
      }

      const totalHoldingsUsd = cryptoValueUsd + fiatValueUsd;
      // Exposure: what we'd owe if every crypto holding were sold instantly at
      // our SELL price (market × (1 − spread)). Fiat is already cash we owe.
      const cryptoPayoutUsd = cryptoValueUsd * (1 - spread);
      const exposureUsd = cryptoPayoutUsd + fiatValueUsd;
      const spreadCushionUsd = cryptoValueUsd - cryptoPayoutUsd;

      res.json({
        generatedAt: Date.now(),
        spreadPct: spread,
        totals: {
          totalHoldingsUsd,
          cryptoValueUsd,
          fiatValueUsd,
          exposureUsd,
          spreadCushionUsd,
        },
        crypto: priced.sort((a, b) => b.valueUsd - a.valueUsd),
        fiat: fiatBreakdown.sort((a, b) => b.valueUsd - a.valueUsd),
        unpriced,
      });
    } catch (error) { next(error); }
  }

  // ── Orders ─────────────────────────────────────────────────────
  static async getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const [orders, total] = await Promise.all([
        prisma.order.findMany({ include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.order.count(),
      ]);
      res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  // ── Audit Log ──────────────────────────────────────────────────
  static async getAuditLog(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.auditLog.count(),
      ]);
      res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  // ── On-Chain USDT Transactions ─────────────────────────────────
  static async getOnChainTxs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const [txs, total] = await Promise.all([
        prisma.onChainTx.findMany({ include: { withdrawal: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.onChainTx.count(),
      ]);
      res.json({ txs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async markOnChainTxSent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { txHash } = req.body;
      if (!txHash) throw new AppError('Transaction hash is required', 400);
      const tx = await prisma.onChainTx.findUnique({ where: { id: req.params.id } });
      if (!tx) throw new AppError('On-chain TX not found', 404);
      await prisma.onChainTx.update({ where: { id: tx.id }, data: { status: 'SENT', txHash, sentAt: new Date() } });
      res.json({ message: 'On-chain TX marked as sent' });
    } catch (error) { next(error); }
  }

  // ── AML Flags ──────────────────────────────────────────────────
  static async getAMLFlags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const limit = 20;

      const where: any = {};
      if (status) where.status = status;
      if (severity) where.severity = severity;

      const [flags, total] = await Promise.all([
        prisma.aMLFlag.findMany({
          where,
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.aMLFlag.count({ where }),
      ]);

      const summary = await Promise.all([
        prisma.aMLFlag.count({ where: { status: 'OPEN' } }),
        prisma.aMLFlag.count({ where: { status: 'REVIEWING' } }),
        prisma.aMLFlag.count({ where: { status: 'ESCALATED' } }),
        prisma.aMLFlag.count({ where: { severity: 'CRITICAL' } }),
      ]);

      res.json({
        flags, total, page, pages: Math.ceil(total / limit),
        summary: { open: summary[0], reviewing: summary[1], escalated: summary[2], critical: summary[3] },
      });
    } catch (error) { next(error); }
  }

  static async resolveAMLFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;
      if (!['CLEARED', 'ESCALATED', 'FROZEN'].includes(status)) throw new AppError('Invalid status', 400);

      const flag = await prisma.aMLFlag.findUnique({ where: { id } });
      if (!flag) throw new AppError('AML flag not found', 404);
      assertNotSelf(req.user!.id, [flag.userId], 'aml_flag_resolve', { ipAddress: req.ip, path: req.originalUrl });

      await prisma.aMLFlag.update({
        where: { id },
        data: { status, resolution, reviewedBy: req.user!.id, reviewedAt: new Date() },
      });

      // If freezing, freeze user's wallets and kill their live sessions —
      // an AML freeze that waits out a token TTL isn't a freeze.
      if (status === 'FROZEN') {
        await prisma.user.update({ where: { id: flag.userId }, data: { status: 'SUSPENDED' } });
        const { revokeAllUserSessions } = await import('../middleware/auth');
        await revokeAllUserSessions(flag.userId);
      }

      res.json({ message: `AML flag ${status.toLowerCase()}` });
    } catch (error) { next(error); }
  }

  // ── Support Escalations ─────────────────────────────────────────
  /**
   * List all support escalations for the admin queue, with the
   * raising user, counterparty user, and trade summary attached.
   */
  static async getEscalations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = (req.query.status as string | undefined)?.toUpperCase();
      const valid = status && ['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED'].includes(status);
      const where: any = valid ? { status } : {};

      const escalations = await (prisma as any).supportEscalation.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
          raisedBy:      { select: { id: true, email: true, firstName: true, lastName: true, username: true } },
          assignedAgent: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });

      // Counterparty (no direct relation), and optional trade summary
      const counterIds = Array.from(new Set(escalations.map((e: any) => e.counterpartyId).filter(Boolean)));
      const tradeIds   = Array.from(new Set(escalations.map((e: any) => e.tradeId).filter(Boolean)));
      const [counterparties, trades] = await Promise.all([
        counterIds.length ? prisma.user.findMany({
          where: { id: { in: counterIds as string[] } },
          select: { id: true, email: true, firstName: true, lastName: true, username: true },
        }) : Promise.resolve([]),
        tradeIds.length ? (prisma as any).p2PTrade.findMany({
          where: { id: { in: tradeIds as string[] } },
          select: { id: true, status: true, amount: true, currency: true, fiatAmount: true, fiatCurrency: true, baseAsset: true, fiatAsset: true },
        }) : Promise.resolve([]),
      ]);
      const counterMap = new Map(counterparties.map((u: any) => [u.id, u]));
      const tradeMap   = new Map(trades.map((t: any) => [t.id, t]));

      const enriched = escalations.map((e: any) => ({
        ...e,
        counterparty: counterMap.get(e.counterpartyId) ?? null,
        trade: e.tradeId ? tradeMap.get(e.tradeId) ?? null : null,
      }));

      const summary = await Promise.all([
        (prisma as any).supportEscalation.count({ where: { status: 'OPEN' } }),
        (prisma as any).supportEscalation.count({ where: { status: 'ASSIGNED' } }),
        (prisma as any).supportEscalation.count({ where: { status: 'RESOLVED' } }),
      ]);

      res.json({
        escalations: enriched,
        summary: { open: summary[0], assigned: summary[1], resolved: summary[2] },
      });
    } catch (error) { next(error); }
  }

  /** Assign self as the agent on an escalation. */
  static async assignEscalation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      // Conditional: only an OPEN/ASSIGNED escalation can be (re)assigned.
      const moved = await prisma.supportEscalation.updateMany({
        where: { id, status: { in: ['OPEN', 'ASSIGNED'] } },
        data: { status: 'ASSIGNED', assignedAgentId: req.user!.id },
      });
      if (moved.count !== 1) throw new AppError('Escalation is already closed or does not exist', 409);
      const updated = await prisma.supportEscalation.findUnique({ where: { id } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'ESCALATION_ASSIGNED', entity: 'SupportEscalation', entityId: id, after: { assignedAgentId: req.user!.id }, req });
      res.json({ escalation: updated });
    } catch (error) { next(error); }
  }

  /** Resolve an escalation with an optional resolution note. */
  static async resolveEscalation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const note = typeof req.body?.resolutionNote === 'string' ? req.body.resolutionNote : null;
      // Conditional: a second resolve must not post the system notice twice.
      const moved = await prisma.supportEscalation.updateMany({
        where: { id, status: { in: ['OPEN', 'ASSIGNED'] } },
        data: { status: 'RESOLVED', resolutionNote: note, resolvedAt: new Date(), assignedAgentId: req.user!.id },
      });
      if (moved.count !== 1) throw new AppError('Escalation is already resolved or does not exist', 409);
      const updated = await prisma.supportEscalation.findUniqueOrThrow({ where: { id } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'ESCALATION_RESOLVED', entity: 'SupportEscalation', entityId: id, after: { status: 'RESOLVED' }, reason: note ?? undefined, req });

      // Drop a SYSTEM notice into both participants' threads
      const support = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
      if (support && updated) {
        const content = note
          ? `Escalation #${updated.id.slice(0, 8)} resolved by support: ${note}`
          : `Escalation #${updated.id.slice(0, 8)} marked as resolved by support.`;
        const notices = await prisma.$transaction([updated.raisedById, updated.counterpartyId].map((receiverId) =>
          prisma.message.create({
            data: { senderId: support.id, receiverId, content, type: 'SYSTEM', metadata: { escalationId: updated.id } as any, tradeId: updated.tradeId },
          })));
        // Push them live — previously they only appeared after a refresh/poll.
        const io = req.app.get('io');
        if (io) for (const n of notices) io.to([`user:${n.receiverId}`, `user:${support.id}`]).emit('message:new', messageWire(n));
      }

      res.json({ escalation: updated });
    } catch (error) { next(error); }
  }

  /** GET /api/admin/rates — list every exchange rate (active + overridden). */
  static async getRates(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rates = await prisma.exchangeRate.findMany({
        orderBy: [{ baseCurrency: 'asc' }, { quoteCurrency: 'asc' }],
      });
      // Decorate with who set it (display name)
      const setterIds = Array.from(new Set(rates.map((r) => r.setBy).filter(Boolean))) as string[];
      const setters = setterIds.length
        ? await prisma.user.findMany({
            where: { id: { in: setterIds } },
            select: { id: true, email: true, firstName: true, lastName: true },
          })
        : [];
      const setterMap = new Map(setters.map((u) => [u.id, u]));

      // Decorate each pair with the CURRENT live provider rate (override-bypassed)
      // and the EFFECTIVE rate users actually get from getRate(). The stored
      // row is audit state, not necessarily the active price: it may be an old
      // non-override persistence row or a stale manual override whose freshness
      // window has expired.
      const { getLiveProviderRate, getRate } = await import('../services/exchange/fxRateProvider.service');
      const decorated = await Promise.all(
        rates.map(async (r) => {
          const base = r.baseCurrency as string;
          const quote = r.quoteCurrency as string;
          const [live, effective] = await Promise.all([
            getLiveProviderRate(base, quote).catch(() => null),
            getRate(base, quote).catch(() => null),
          ]);
          return { live, effective };
        }),
      );

      res.json({
        rates: rates.map((r, i) => ({
          ...r,
          buyPrice:  Number(r.buyPrice),
          sellPrice: Number(r.sellPrice),
          setByUser: r.setBy ? setterMap.get(r.setBy) ?? null : null,
          // Null when no provider can price the pair right now.
          live: decorated[i].live
            ? { buyPrice: Number(decorated[i].live!.buyPrice), sellPrice: Number(decorated[i].live!.sellPrice), source: decorated[i].live!.source }
            : null,
          effective: decorated[i].effective
            ? {
                buyPrice:  Number(decorated[i].effective!.buyPrice),
                sellPrice: Number(decorated[i].effective!.sellPrice),
                source:    decorated[i].effective!.source,
                fetchedAt: decorated[i].effective!.fetchedAt,
              }
            : null,
        })),
      });
    } catch (error) { next(error); }
  }

  /** POST /api/admin/rates — create a new rate pair. */
  static async createRate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        baseCurrency:  z.string().min(2),
        quoteCurrency: z.string().min(2),
        buyPrice:  z.number().positive(),
        sellPrice: z.number().positive(),
      });
      const data = schema.parse(req.body);
      if (data.buyPrice <= data.sellPrice) {
        throw new AppError('Buy price must be greater than sell price', 400);
      }
      const baseU  = data.baseCurrency.toUpperCase()  as any;
      const quoteU = data.quoteCurrency.toUpperCase() as any;
      if (fxOverridesNeedApproval()) {
        const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'New rate pair from admin console';
        const approval = await requestLegacyFxOverride(req, { base: baseU, quote: quoteU, buyPrice: data.buyPrice, sellPrice: data.sellPrice, reason });
        return res.status(202).json({ pendingApproval: true, approvalId: approval.id, message: 'Rate overrides need a second approver. The request is waiting in the cockpit approvals queue.' });
      }
      const rate = await prisma.exchangeRate.upsert({
        where:  { baseCurrency_quoteCurrency: { baseCurrency: baseU, quoteCurrency: quoteU } },
        update: { buyPrice: data.buyPrice, sellPrice: data.sellPrice, isActive: true, setBy: req.user!.id },
        create: { baseCurrency: baseU, quoteCurrency: quoteU, buyPrice: data.buyPrice, sellPrice: data.sellPrice, isActive: true, setBy: req.user!.id },
      });
      const { invalidateRate } = await import('../services/exchange/fxRateProvider.service');
      invalidateRate(rate.baseCurrency as string, rate.quoteCurrency as string);
      invalidateRate(rate.quoteCurrency as string, rate.baseCurrency as string);
      const { invalidateRatesCache } = await import('../routes/rates');
      invalidateRatesCache();
      res.status(201).json({ rate });
    } catch (error) { next(error); }
  }

  /**
   * Freeze a user: status SUSPENDED, every session revoked, and a USER-scope
   * control so no money path accepts their activity even before outstanding
   * access tokens expire.
   *
   * Wallet `frozen` amounts are NOT touched. They hold specific reservations
   * (pending withdrawals, budget locks, claim links, P2P escrow); overwriting
   * them used to destroy those reservations on unfreeze.
   */
  static async freezeUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reason = (req.body?.reason as string | undefined)?.trim() || 'Frozen pending review';
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, status: true } });
      if (!user) throw new AppError('User not found', 404);
      if (user.role === 'ADMIN') {
        throw new AppError('Cannot freeze admin accounts', 403);
      }

      await prisma.user.update({ where: { id }, data: { status: 'SUSPENDED' } });
      const { revokeAllUserSessions } = await import('../middleware/auth');
      await revokeAllUserSessions(id);
      const { setControl } = await import('../services/platform/controls.service');
      await setControl({ scope: 'USER', key: id, blocked: true, reason: `Account frozen: ${reason}`, actorId: req.user!.id, req });

      await writeAudit(prisma, {
        actorId: req.user!.id, action: 'FREEZE_USER', entity: 'User', entityId: id,
        before: { status: user.status }, after: { status: 'SUSPENDED' }, reason, req,
      });

      await prisma.notification.create({
        data: {
          userId: id,
          title:   'Account Frozen',
          message: req.body?.reason ? `Your account has been frozen by support: ${reason}` : 'Your account has been frozen pending review. Contact support.',
          type:    'security',
        },
      });

      res.json({ message: 'User frozen', userId: id });
    } catch (error) { next(error); }
  }

  /** Unfreeze: restore ACTIVE status and lift the account-level control. */
  static async unfreezeUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reason = (req.body?.reason as string | undefined)?.trim() || 'Unfrozen via admin console';
      assertNotSelf(req.user!.id, [id], 'unfreeze_user', { ipAddress: req.ip, path: req.originalUrl });
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!user) throw new AppError('User not found', 404);

      await prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
      const { setControl } = await import('../services/platform/controls.service');
      await setControl({ scope: 'USER', key: id, blocked: false, reason, actorId: req.user!.id, req });

      await writeAudit(prisma, {
        actorId: req.user!.id, action: 'UNFREEZE_USER', entity: 'User', entityId: id,
        before: { status: user.status }, after: { status: 'ACTIVE' }, reason, req,
      });

      await prisma.notification.create({
        data: {
          userId: id,
          title:   'Account Unfrozen',
          message: 'Your account is active again. You can now trade and withdraw normally.',
          type:    'security',
        },
      });

      res.json({ message: 'User unfrozen', userId: id });
    } catch (error) { next(error); }
  }

  /**
   * Stop an in-flight order, withdrawal or deposit. Only objects still
   * awaiting processing can be stopped; completed money movements are never
   * rewritten (corrections are separate reversing entries). Stopping a
   * pending withdrawal releases its reservation in the same transaction.
   */
  static async freezeTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { kind, id } = req.params;
      const reason = (req.body?.reason as string | undefined)?.trim() || 'Frozen by admin';
      const actorId = req.user!.id;

      switch (kind) {
        case 'order': {
          const updated = await prisma.$transaction(async (tx) => {
            const moved = await tx.order.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
            assertTransitioned(moved, 'Only pending orders can be stopped');
            await recordTransition(tx, { entityType: 'ORDER', entityId: id, fromState: 'PENDING', toState: 'CANCELLED', actorType: 'STAFF', actorId, reason });
            await writeAudit(tx, { actorId, action: 'FREEZE_ORDER', entity: 'Order', entityId: id, before: { status: 'PENDING' }, after: { status: 'CANCELLED' }, reason, req });
            return tx.order.findUniqueOrThrow({ where: { id } });
          });
          res.json({ transaction: updated });
          return;
        }
        case 'withdrawal': {
          const updated = await prisma.$transaction(async (tx) => {
            const w = await tx.withdrawal.findUnique({ where: { id } });
            if (!w) throw new AppError('Withdrawal not found', 404);
            const moved = await tx.withdrawal.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED', adminNotes: reason, processedBy: actorId } });
            assertTransitioned(moved, 'Only pending withdrawals can be stopped');
            await releaseReserve(tx, w.userId, w.currency, w.amount);
            await markWithdrawalHistory(tx, w.reference, 'CANCELLED');
            await recordTransition(tx, { entityType: 'WITHDRAWAL', entityId: id, fromState: 'PENDING', toState: 'CANCELLED', actorType: 'STAFF', actorId, reason });
            await writeAudit(tx, { actorId, action: 'FREEZE_WITHDRAWAL', entity: 'Withdrawal', entityId: id, before: { status: 'PENDING' }, after: { status: 'CANCELLED', reservationReleased: w.amount }, reason, req });
            return tx.withdrawal.findUniqueOrThrow({ where: { id } });
          });
          res.json({ transaction: updated });
          return;
        }
        case 'deposit': {
          const updated = await prisma.$transaction(async (tx) => {
            const d = await tx.deposit.findUnique({ where: { id }, select: { status: true } });
            if (!d) throw new AppError('Deposit not found', 404);
            const moved = await tx.deposit.updateMany({
              where: { id, status: { in: ['WAITING_CONFIRMATION', 'PENDING'] } },
              data: { status: 'REJECTED', adminNotes: reason, confirmedBy: actorId },
            });
            assertTransitioned(moved, 'Only deposits awaiting confirmation can be stopped');
            await recordTransition(tx, { entityType: 'DEPOSIT', entityId: id, fromState: d.status, toState: 'REJECTED', actorType: 'STAFF', actorId, reason });
            await writeAudit(tx, { actorId, action: 'FREEZE_DEPOSIT', entity: 'Deposit', entityId: id, before: { status: d.status }, after: { status: 'REJECTED' }, reason, req });
            return tx.deposit.findUniqueOrThrow({ where: { id } });
          });
          res.json({ transaction: updated });
          return;
        }
        default:
          throw new AppError('Unsupported transaction kind. Use order|withdrawal|deposit', 400);
      }
    } catch (error) { next(error); }
  }

  /**
   * Send a message AS the support user to a target user. Admins use
   * this to reply in support threads — the message appears to the
   * user as coming from @support, not from the admin's personal handle.
   */
  static async sendAsSupport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        userId:  z.string().uuid(),
        content: z.string().min(1).max(4000),
        escalationId: z.string().uuid().optional(),
        tradeId:      z.string().uuid().optional(),
      });
      const data = schema.parse(req.body);

      const support = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
      if (!support) throw new AppError('Support user not provisioned', 500);

      const message = await prisma.message.create({
        data: {
          senderId:   support.id,
          receiverId: data.userId,
          content:    data.content,
          type:       'TEXT',
          metadata:   {
            sentByAdmin:   req.user!.id,
            escalationId:  data.escalationId ?? null,
            tradeId:       data.tradeId      ?? null,
          } as any,
          tradeId:    data.tradeId,
        },
      });

      // Full wire shape, to the customer AND the support account's own sessions
      // (the partial payload lacked readAt/editedAt/deletedAt/tradeId).
      const io = req.app.get('io');
      if (io) io.to([`user:${data.userId}`, `user:${support.id}`]).emit('message:new', messageWire(message));

      // If the last inbound message from this user came via WhatsApp, mirror the reply there.
      try {
        const lastWa = await (prisma as any).whatsAppMessage.findFirst({
          where: { userId: data.userId, direction: 'IN' },
          orderBy: { createdAt: 'desc' },
          select: { phoneNumber: true },
        });
        if (lastWa?.phoneNumber) {
          const { sendWhatsAppText } = await import('../services/whatsapp/twilio.service');
          await sendWhatsAppText({ to: `+${lastWa.phoneNumber}`, body: data.content, userId: data.userId });
        }
      } catch (waErr) {
        console.warn('[admin:sendAsSupport] WA mirror failed', (waErr as Error).message);
      }

      res.status(201).json({ message });
    } catch (error) { next(error); }
  }

  /**
   * Real-time platform metrics: connected sockets, recent volume,
   * commission totals, latency probes. Used by the admin dashboard.
   */
  static async getMetrics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const fiveMinAgo  = new Date(Date.now() - 5 * 60 * 1000);
      const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo   = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const io = req.app.get('io');
      const onlineSockets = io?.engine?.clientsCount ?? 0;

      const [
        onlineUsers,
        recentOrders5m,
        recentDeposits5m,
        recentWithdrawals5m,
        recentTransfers5m,
        recentP2P5m,
        recentCardTx5m,
        totalCommissions,
        commissions24h,
        commissions5m,
        feesBySource,
      ] = await Promise.all([
        prisma.user.count({ where: { lastLoginAt: { gte: oneHourAgo } } }).catch(() => 0),
        prisma.order.count({         where: { createdAt: { gte: fiveMinAgo } } }),
        prisma.deposit.count({       where: { createdAt: { gte: fiveMinAgo } } }),
        prisma.withdrawal.count({    where: { createdAt: { gte: fiveMinAgo } } }),
        prisma.transfer.count({      where: { createdAt: { gte: fiveMinAgo } } }),
        (prisma as any).p2PTrade.count({       where: { createdAt: { gte: fiveMinAgo } } }).catch(() => 0),
        (prisma as any).cardTransaction.count({ where: { createdAt: { gte: fiveMinAgo } } }).catch(() => 0),
        (prisma as any).platformFee.aggregate({ _sum: { amountUsd: true } }),
        (prisma as any).platformFee.aggregate({
          where: { createdAt: { gte: oneDayAgo } },
          _sum:  { amountUsd: true },
        }),
        (prisma as any).platformFee.aggregate({
          where: { createdAt: { gte: fiveMinAgo } },
          _sum:  { amountUsd: true },
        }),
        (prisma as any).platformFee.groupBy({
          by: ['source'],
          _sum: { amountUsd: true },
          _count: { id: true },
        }),
      ]);

      const txCount5m =
        recentOrders5m + recentDeposits5m + recentWithdrawals5m +
        recentTransfers5m + recentP2P5m + recentCardTx5m;
      const fees5m   = Number(commissions5m?._sum?.amountUsd ?? 0);
      const txPerMin   = txCount5m / 5;
      const feesPerMin = fees5m    / 5;

      res.json({
        onlineSockets,
        onlineUsers,
        // ── Per-minute rates (averaged over the last 5 minutes) ───────
        txPerMin,
        feesPerMin,
        // ── 5-minute window breakdown ─────────────────────────────────
        recentTransactions5m: txCount5m,
        recentOrders5m,
        recentDeposits5m,
        recentWithdrawals5m,
        recentTransfers5m,
        recentP2P5m,
        recentCardTx5m,
        // ── Fee totals ────────────────────────────────────────────────
        commissions5mUSD:    fees5m,
        commissions24hUSD:   Number(commissions24h?._sum?.amountUsd  ?? 0),
        totalCommissionsUSD: Number(totalCommissions?._sum?.amountUsd ?? 0),
        // ── Fees grouped by source ────────────────────────────────────
        feesBySource: (feesBySource as any[]).map((r) => ({
          source: r.source,
          totalUsd: Number(r._sum?.amountUsd ?? 0),
          count:    Number(r._count?.id      ?? 0),
        })),
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion:   process.version,
        memoryMb:      Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp:     new Date().toISOString(),
      });
    } catch (error) { next(error); }
  }

  /**
   * Manual balance credit — a controlled ledger adjustment (USER ⟷ ADJUSTMENT).
   * Up to MANUAL_ADJUSTMENT_SINGLE_USD it posts immediately; above that it
   * becomes a maker-checker request that a second staff member must approve.
   */
  static async manualCredit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        userId:   z.string().uuid(),
        currency: z.string().min(1).max(10).toUpperCase(),
        amount:   z.union([z.number().positive(), z.string().min(1)]),
        note:     z.string().max(500).optional(),
      });
      const { userId, currency, amount, note } = schema.parse(req.body);
      const reason = note?.trim() || 'Manual adjustment';

      const outcome = await creditOrRequestApproval(req, { userId, currency, amount: String(amount), reason });
      if (outcome.pendingApproval) {
        const { SINGLE_CONTROL_LIMIT_USD } = await import('../services/ledger/adjustments.service');
        res.status(202).json({
          ok: true,
          pendingApproval: true,
          approvalId: outcome.approvalId,
          message: `This credit needs a second approver (single credits above ${SINGLE_CONTROL_LIMIT_USD()} USD, and daily single-control totals, are dual-controlled). Request ${outcome.approvalId} is waiting in the cockpit approvals queue.`,
        });
        return;
      }
      res.json({ ok: true, userId, currency, amount, reference: outcome.reference, ledgerGroupId: outcome.ledgerGroupId });
    } catch (error) { next(error); }
  }

  /**
   * Dev/simulator helper — directly credit a wallet balance.
   * Blocked in production (NODE_ENV=production). Safe for staging/dev.
   */
  static async seedBalance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (process.env.NODE_ENV === 'production') {
        throw new AppError('Not available in production', 403);
      }
      const { userId, currency, amount } = z.object({
        userId:   z.string().uuid(),
        currency: z.string().min(1).max(10).toUpperCase(),
        amount:   z.number().positive(),
      }).parse(req.body);

      const dec = new Decimal(amount);
      const cur = currency as any;
      const reference = `SIM-${Date.now()}`;
      const wallet = await prisma.$transaction(async (tx: any) => {
        const updated = await tx.wallet.upsert({
          where:  { userId_currency: { userId, currency: cur } },
          create: { userId, currency: cur, balance: dec },
          update: { balance: { increment: dec } },
        });
        if (isLedgerCurrency(currency)) {
          await postLedger(tx, {
            refType: 'sim_seed_credit',
            refId: reference,
            memo: '[simulator] seed balance',
            legs: [
              { type: 'SYSTEM_ONRAMP', currency: cur, amount: dec.neg() },
              { type: 'USER', userId, currency: cur, amount: dec },
            ],
          });
        }
        await tx.transaction.create({
          data: {
            userId,
            type:          'DEPOSIT',
            currency:      cur,
            amount:        dec,
            fee:           new Decimal(0),
            balanceBefore: new Decimal(updated.balance).minus(dec),
            balanceAfter:  updated.balance,
            description:   '[simulator] seed balance',
            reference,
          },
        });
        return updated;
      });
      res.json({ ok: true, currency, amount, newBalance: wallet.balance });
    } catch (error) { next(error); }
  }

  static async backfillFees(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const CHUNK = 200;
      let imported = { orders: 0, withdrawals: 0, cryptoOrders: 0, p2pTrades: 0 };

      // Orders with fee > 0 that have no PlatformFee row
      const orders = await prisma.order.findMany({
        where: { fee: { gt: 0 } },
        select: { id: true, fee: true, quoteCurrency: true, userId: true, createdAt: true },
        take: CHUNK,
      });
      for (const o of orders) {
        const exists = await prisma.platformFee.findFirst({ where: { sourceId: o.id, source: 'ORDER' } });
        if (!exists) {
          await prisma.platformFee.create({
            data: {
              source: 'ORDER', sourceId: o.id, payerId: o.userId,
              currency: o.quoteCurrency as any, amount: o.fee,
              amountUsd: o.fee,
              createdAt: o.createdAt,
            },
          });
          imported.orders++;
        }
      }

      // Withdrawals with fee > 0
      const withdrawals = await prisma.withdrawal.findMany({
        where: { fee: { gt: 0 } },
        select: { id: true, fee: true, currency: true, userId: true, createdAt: true },
        take: CHUNK,
      });
      for (const w of withdrawals) {
        const exists = await prisma.platformFee.findFirst({ where: { sourceId: w.id, source: 'WITHDRAWAL' } });
        if (!exists) {
          await prisma.platformFee.create({
            data: {
              source: 'WITHDRAWAL', sourceId: w.id, payerId: w.userId,
              currency: w.currency as any, amount: w.fee,
              amountUsd: w.fee,
              createdAt: w.createdAt,
            },
          });
          imported.withdrawals++;
        }
      }

      // P2P trades — skipped: P2PTrade model does not carry a platformFee column

      const total = imported.orders + imported.withdrawals + imported.cryptoOrders + imported.p2pTrades;
      res.json({ message: `Backfill complete — imported ${total} records`, imported, total });
    } catch (error) { next(error); }
  }
}
