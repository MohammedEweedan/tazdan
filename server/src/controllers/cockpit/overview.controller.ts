/**
 * Cockpit: who am I, executive overview, system health.
 * Every figure is computed from live platform data at request time.
 */
import type { NextFunction, Response } from 'express';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { getRedisClient } from '../../utils/redis';
import { snapshot } from '../../services/platform/metrics';
import { isTradingHalted } from '../../services/ledger/reconcile.service';
import { FUND_CLASS } from '../../services/ledger/ledger.service';
import { periodWindow, pct, systemUserIds, usdConverter } from './helpers';

export const CockpitOverviewController = {
  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, firstName: true, lastName: true, twoFactorEnabled: true, staffRoles: true, lastLoginAt: true },
      });
      res.json({
        user,
        roles: req.staff!.roles,
        permissions: [...req.staff!.permissions].sort(),
        implicitSuperAdmin: req.staff!.implicitSuperAdmin,
        environment: process.env.NODE_ENV ?? 'development',
      });
    } catch (e) { next(e); }
  },

  async overview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const w = periodWindow(req.query.period);
      const usd = usdConverter();
      const exclude = await systemUserIds();
      const customerWhere = { role: 'USER' as const, id: { notIn: exclude } };

      const inPeriod = (from: Date, to: Date) => ({ gte: from, lt: to });

      async function volumes(from: Date, to: Date) {
        const [dep, wd, tr, p2p, orders, swaps, rem] = await Promise.all([
          prisma.deposit.groupBy({ by: ['currency'], where: { status: 'CONFIRMED', confirmedAt: inPeriod(from, to) }, _sum: { amount: true }, _count: true }),
          prisma.withdrawal.groupBy({ by: ['currency'], where: { status: 'COMPLETED', processedAt: inPeriod(from, to) }, _sum: { amount: true }, _count: true }),
          prisma.transfer.groupBy({ by: ['currency'], where: { createdAt: inPeriod(from, to) }, _sum: { amount: true }, _count: true }),
          prisma.p2PTrade.groupBy({ by: ['currency'], where: { status: 'COMPLETED', completedAt: inPeriod(from, to) }, _sum: { cryptoAmount: true }, _count: true }),
          prisma.cryptoOrder.aggregate({ where: { status: { not: 'FAILED' }, createdAt: inPeriod(from, to) }, _sum: { quotedTotal: true }, _count: true }),
          prisma.transaction.groupBy({ by: ['currency'], where: { type: 'SELL', createdAt: inPeriod(from, to), metadata: { path: ['kind'], equals: 'swap' } }, _sum: { amount: true }, _count: true }),
          prisma.remittanceTransfer.groupBy({ by: ['sourceCurrency'], where: { state: { in: ['PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'COMPLETED'] }, paidAt: inPeriod(from, to) }, _sum: { sendAmount: true }, _count: true }),
        ]);
        const toRows = (rows: any[], key: string, field: string) => rows.map((r) => ({ currency: r[key], amount: r._sum[field] ?? 0 }));
        const count = (rows: any[]) => rows.reduce((n, r) => n + (r._count ?? 0), 0);
        const out = {
          deposits: { usd: await usd.sum(toRows(dep, 'currency', 'amount')), count: count(dep) },
          withdrawals: { usd: await usd.sum(toRows(wd, 'currency', 'amount')), count: count(wd) },
          transfers: { usd: await usd.sum(toRows(tr, 'currency', 'amount')), count: count(tr) },
          p2p: { usd: await usd.sum(toRows(p2p, 'currency', 'cryptoAmount')), count: count(p2p) },
          exchange: { usd: Math.round(Number(orders._sum.quotedTotal ?? 0) * 100) / 100, count: orders._count },
          fx: { usd: await usd.sum(toRows(swaps, 'currency', 'amount')), count: count(swaps) },
          remittance: { usd: await usd.sum(toRows(rem, 'sourceCurrency', 'sendAmount')), count: count(rem) },
        };
        const total = Object.values(out).reduce((n, v) => n + v.usd, 0);
        return { ...out, total: Math.round(total * 100) / 100 };
      }

      async function revenue(from: Date, to: Date) {
        // Corporate revenue = credits into PLATFORM ledger accounts.
        const rows = await prisma.$queryRaw<Array<{ currency: string; amount: string; reftype: string }>>`
          SELECT e."currency"::text AS currency, SUM(e."amount")::text AS amount, e."refType" AS reftype
          FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
          WHERE a."type" = 'PLATFORM' AND e."amount" > 0 AND e."createdAt" >= ${from} AND e."createdAt" < ${to}
            AND e."refType" <> 'fee_consolidation'
          GROUP BY e."currency", e."refType"
        `;
        const fees = await prisma.platformFee.groupBy({ by: ['source'], where: { createdAt: inPeriod(from, to) }, _sum: { amountUsd: true } });
        const feeUsd = fees.reduce((n, f) => n + Number(f._sum.amountUsd ?? 0), 0);
        const ledgerUsd = await usd.sum(rows.map((r) => ({ currency: r.currency, amount: r.amount })));
        return {
          totalUsd: Math.round((feeUsd + ledgerUsd) * 100) / 100,
          feesUsd: Math.round(feeUsd * 100) / 100,
          ledgerRevenueUsd: ledgerUsd,
          bySource: fees.map((f) => ({ source: f.source, usd: Math.round(Number(f._sum.amountUsd ?? 0) * 100) / 100 }))
            .concat(rows.map((r) => ({ source: r.reftype, usd: 0, currency: r.currency, amount: r.amount } as any))),
        };
      }

      const [
        totalCustomers, activeCustomers, prevActive, verified, businesses, newCustomers, prevNew,
        cur, prev, revCur, revPrev,
        walletSums, ledgerByType,
        depositsAwaiting, withdrawalsPending, kycPending, amlOpen, casesOpen, approvalsPending, escalationsOpen, reconOpen, remittanceReview,
        halted, activeControls, providers, failedLogins, accessDenied,
      ] = await Promise.all([
        prisma.user.count({ where: customerWhere }),
        prisma.user.count({ where: { ...customerWhere, lastLoginAt: inPeriod(w.from, w.to) } }),
        prisma.user.count({ where: { ...customerWhere, lastLoginAt: inPeriod(w.prevFrom, w.prevTo) } }),
        prisma.user.count({ where: { ...customerWhere, kycStatus: 'APPROVED' } }),
        prisma.user.count({ where: { ...customerWhere, accountType: 'BUSINESS' } }),
        prisma.user.count({ where: { ...customerWhere, createdAt: inPeriod(w.from, w.to) } }),
        prisma.user.count({ where: { ...customerWhere, createdAt: inPeriod(w.prevFrom, w.prevTo) } }),
        volumes(w.from, w.to),
        volumes(w.prevFrom, w.prevTo),
        revenue(w.from, w.to),
        revenue(w.prevFrom, w.prevTo),
        prisma.wallet.groupBy({ by: ['currency'], where: { userId: { notIn: exclude } }, _sum: { balance: true, frozen: true } }),
        prisma.ledgerAccount.groupBy({ by: ['type', 'currency'], _sum: { balance: true } }),
        prisma.deposit.count({ where: { status: { in: ['WAITING_CONFIRMATION', 'PENDING'] } } }),
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { kycStatus: 'PENDING' } }),
        prisma.aMLFlag.count({ where: { status: { in: ['OPEN', 'REVIEWING', 'ESCALATED'] } } }),
        prisma.complianceCase.count({ where: { status: { not: 'CLOSED' } } }),
        prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
        prisma.supportEscalation.count({ where: { status: { in: ['OPEN', 'ASSIGNED'] } } }),
        prisma.reconciliationItem.count({ where: { resolution: 'OPEN', status: { not: 'MATCHED' } } }),
        prisma.remittanceTransfer.count({ where: { state: 'MANUAL_REVIEW' } }),
        isTradingHalted(),
        prisma.controlSwitch.count({ where: { blocked: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
        prisma.provider.groupBy({ by: ['status'], _count: true }),
        prisma.securityEvent.count({ where: { type: { in: ['FAILED_LOGIN', 'MFA_FAILURE'] }, createdAt: inPeriod(w.from, w.to) } }),
        prisma.securityEvent.count({ where: { type: 'ACCESS_DENIED', createdAt: inPeriod(w.from, w.to) } }),
      ]);

      const balances = await Promise.all(walletSums.map(async (r) => {
        const balance = Number(r._sum.balance ?? 0);
        const frozen = Number(r._sum.frozen ?? 0);
        const rate = await usd.rate(r.currency);
        return { currency: r.currency, balance, held: frozen, available: balance - frozen, usd: Math.round(balance * rate * 100) / 100 };
      }));
      balances.sort((a, b) => b.usd - a.usd);

      const funds: Record<string, Record<string, number>> = { CUSTOMER: {}, SETTLEMENT: {}, CORPORATE: {} };
      for (const row of ledgerByType) {
        const cls = FUND_CLASS[row.type];
        funds[cls][row.currency] = (funds[cls][row.currency] ?? 0) + Number(row._sum.balance ?? 0);
      }
      const fundUsd: Record<string, number> = {};
      for (const [cls, byCur] of Object.entries(funds)) {
        let total = 0;
        for (const [c, v] of Object.entries(byCur)) total += v * (await usd.rate(c));
        fundUsd[cls] = Math.round(total * 100) / 100;
      }

      const margin = cur.total ? revCur.totalUsd / cur.total : 0;
      res.json({
        period: w.period,
        window: { from: w.from, to: w.to, previousFrom: w.prevFrom, previousTo: w.prevTo },
        customers: {
          total: totalCustomers,
          active: activeCustomers,
          activeChangePct: pct(activeCustomers, prevActive),
          verified,
          business: businesses,
          new: newCustomers,
          newChangePct: pct(newCustomers, prevNew),
        },
        volume: {
          current: cur,
          previous: prev,
          totalChangePct: pct(cur.total, prev.total),
        },
        revenue: {
          current: revCur,
          previous: revPrev,
          changePct: pct(revCur.totalUsd, revPrev.totalUsd),
          takeRatePct: Math.round(margin * 10000) / 100,
        },
        balances,
        customerBalancesUsd: Math.round(balances.reduce((n, b) => n + b.usd, 0) * 100) / 100,
        funds: { byClass: funds, usdByClass: fundUsd },
        queues: {
          depositsAwaiting, withdrawalsPending, kycPending, amlOpen, casesOpen,
          approvalsPending, escalationsOpen, reconciliationExceptions: reconOpen, remittanceManualReview: remittanceReview,
        },
        risk: { tradingHalted: halted, activeControls },
        providers: Object.fromEntries(providers.map((p) => [p.status, p._count])),
        security: { failedLogins, accessDenied },
        generatedAt: new Date(),
      });
    } catch (e) { next(e); }
  },

  /**
   * Daily series for the overview charts. Amounts are valued in USD at
   * today's rates (labelled as such in the cockpit), so the series shows
   * activity, not historical USD accounting.
   */
  async series(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = Math.min(365, Math.max(7, parseInt(String(req.query.days ?? '30'), 10) || 30));
      const from = new Date(Date.now() - days * 86400_000);
      const usd = usdConverter();
      const exclude = await systemUserIds();
      const q = <T>(sql: Promise<T>) => sql.catch(() => [] as unknown as T);
      const [dep, wd, tr, rem, fees, signups] = await Promise.all([
        q(prisma.$queryRaw<Array<{ day: Date; currency: string; amount: string }>>`
          SELECT date_trunc('day', "confirmedAt") AS day, "currency"::text AS currency, SUM("amount")::text AS amount
          FROM "Deposit" WHERE "status" = 'CONFIRMED' AND "confirmedAt" >= ${from} GROUP BY 1, 2`),
        q(prisma.$queryRaw<Array<{ day: Date; currency: string; amount: string }>>`
          SELECT date_trunc('day', "processedAt") AS day, "currency"::text AS currency, SUM("amount")::text AS amount
          FROM "Withdrawal" WHERE "status" = 'COMPLETED' AND "processedAt" >= ${from} GROUP BY 1, 2`),
        q(prisma.$queryRaw<Array<{ day: Date; currency: string; amount: string }>>`
          SELECT date_trunc('day', "createdAt") AS day, "currency"::text AS currency, SUM("amount")::text AS amount
          FROM "Transfer" WHERE "createdAt" >= ${from} GROUP BY 1, 2`),
        q(prisma.$queryRaw<Array<{ day: Date; currency: string; amount: string }>>`
          SELECT date_trunc('day', "paidAt") AS day, "sourceCurrency"::text AS currency, SUM("sendAmount")::text AS amount
          FROM "RemittanceTransfer" WHERE "paidAt" >= ${from} GROUP BY 1, 2`),
        q(prisma.$queryRaw<Array<{ day: Date; usd: string }>>`
          SELECT date_trunc('day', "createdAt") AS day, SUM("amountUsd")::text AS usd
          FROM "PlatformFee" WHERE "createdAt" >= ${from} GROUP BY 1`),
        q(prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
          SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS n
          FROM "User" WHERE "role" = 'USER' AND "createdAt" >= ${from} AND NOT ("id" = ANY(${exclude}::text[])) GROUP BY 1`),
      ]);
      const key = (d: Date) => new Date(d).toISOString().slice(0, 10);
      const buckets = new Map<string, { volumeUsd: number; depositsUsd: number; withdrawalsUsd: number; transfersUsd: number; remittanceUsd: number; feesUsd: number; signups: number }>();
      for (let i = days - 1; i >= 0; i--) {
        buckets.set(key(new Date(Date.now() - i * 86400_000)), { volumeUsd: 0, depositsUsd: 0, withdrawalsUsd: 0, transfersUsd: 0, remittanceUsd: 0, feesUsd: 0, signups: 0 });
      }
      const add = async (rows: Array<{ day: Date; currency: string; amount: string }>, field: 'depositsUsd' | 'withdrawalsUsd' | 'transfersUsd' | 'remittanceUsd') => {
        for (const r of rows) {
          const b = buckets.get(key(r.day));
          if (!b) continue;
          const v = Number(r.amount) * (await usd.rate(r.currency));
          b[field] += v;
          b.volumeUsd += v;
        }
      };
      await add(dep, 'depositsUsd'); await add(wd, 'withdrawalsUsd'); await add(tr, 'transfersUsd'); await add(rem, 'remittanceUsd');
      for (const f of fees) { const b = buckets.get(key(f.day)); if (b) b.feesUsd += Number(f.usd); }
      for (const s of signups) { const b = buckets.get(key(s.day)); if (b) b.signups += Number(s.n); }
      const round = (n: number) => Math.round(n * 100) / 100;
      res.json({
        days,
        valuation: 'USD at current rates',
        series: [...buckets.entries()].map(([day, b]) => ({
          day, volumeUsd: round(b.volumeUsd), depositsUsd: round(b.depositsUsd), withdrawalsUsd: round(b.withdrawalsUsd),
          transfersUsd: round(b.transfersUsd), remittanceUsd: round(b.remittanceUsd), feesUsd: round(b.feesUsd), signups: b.signups,
        })),
      });
    } catch (e) { next(e); }
  },

  async system(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const dbStart = Date.now();
      let database: { ok: boolean; latencyMs: number; connections?: number; maxConnections?: number; sizeMb?: number } = { ok: false, latencyMs: 0 };
      try {
        await prisma.$queryRaw`SELECT 1`;
        database = { ok: true, latencyMs: Date.now() - dbStart };
        const [conn] = await prisma.$queryRaw<Array<{ active: bigint; max: string; size: bigint }>>`
          SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS active,
                 current_setting('max_connections') AS max,
                 pg_database_size(current_database()) AS size
        `;
        database.connections = Number(conn.active);
        database.maxConnections = Number(conn.max);
        database.sizeMb = Math.round(Number(conn.size) / 1048576);
      } catch { /* reported as not ok */ }

      let redis: { ok: boolean; latencyMs?: number; configured: boolean } = { ok: false, configured: Boolean(process.env.REDIS_URL) };
      const client = getRedisClient();
      if (client) {
        const t = Date.now();
        try { await client.ping(); redis = { ok: true, latencyMs: Date.now() - t, configured: true }; } catch { /* not ok */ }
      }

      const [halted, largest, providerCalls, lastRecon, webhookRejects, lastSamples] = await Promise.all([
        isTradingHalted(),
        prisma.$queryRaw<Array<{ table: string; rows: bigint }>>`
          SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10
        `.catch(() => []),
        prisma.providerCall.groupBy({ by: ['providerCode'], where: { createdAt: { gte: new Date(Date.now() - 3600_000) } }, _count: true, _avg: { latencyMs: true } }),
        prisma.reconciliationRun.findFirst({ orderBy: { createdAt: 'desc' } }),
        prisma.securityEvent.count({ where: { type: 'WEBHOOK_REJECTED', createdAt: { gte: new Date(Date.now() - 86400_000) } } }),
        prisma.systemMetricSample.findMany({ where: { kind: 'API' }, orderBy: { createdAt: 'desc' }, take: 48, select: { createdAt: true, data: true } }),
      ]);

      res.json({
        status: database.ok && (redis.ok || !redis.configured) && !halted ? 'ok' : 'degraded',
        version: process.env.npm_package_version ?? '1.0.0',
        commit: process.env.GIT_COMMIT ?? null,
        environment: process.env.NODE_ENV ?? 'development',
        database,
        redis,
        tradingHalted: halted,
        api: snapshot(),
        providerCalls: providerCalls.map((p) => ({ provider: p.providerCode, callsLastHour: p._count, avgLatencyMs: Math.round(p._avg.latencyMs ?? 0) })),
        reconciliation: lastRecon ? { lastRunAt: lastRecon.createdAt, source: lastRecon.source, status: lastRecon.status, totals: lastRecon.totals } : null,
        webhookRejects24h: webhookRejects,
        largestTables: largest.map((t) => ({ table: t.table, rows: Number(t.rows) })),
        history: lastSamples.reverse().map((s) => ({ at: s.createdAt, totals: (s.data as any)?.totals ?? null })),
        generatedAt: new Date(),
      });
    } catch (e) { next(e); }
  },
};
