/**
 * Cockpit: finance & revenue and forecasting centres.
 * Revenue figures come from the ledger and the fee register; provider costs
 * are estimates from contracted terms and are labelled as such.
 */
import type { NextFunction, Response } from 'express';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { listPayoutAdapters } from '../../services/providers/registry';
import { poolPositions } from '../../services/treasury/pools.service';
import { forecastSeries } from '../../services/analytics/forecast';
import { systemUserIds, usdConverter } from './helpers';

function dayKeys(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  return out;
}

export const CockpitAnalyticsController = {
  async finance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = Math.min(365, Math.max(7, parseInt(String(req.query.days ?? '90'), 10) || 90));
      const from = new Date(Date.now() - days * 86400_000);
      const usd = usdConverter();

      const [fees, platformCredits, remPaid, payouts, business, volumes] = await Promise.all([
        prisma.platformFee.groupBy({ by: ['source'], where: { createdAt: { gte: from } }, _sum: { amountUsd: true }, _count: true }),
        prisma.$queryRaw<Array<{ reftype: string; currency: string; amount: string; month: Date }>>`
          SELECT e."refType" AS reftype, e."currency"::text AS currency, SUM(e."amount")::text AS amount, date_trunc('month', e."createdAt") AS month
          FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
          WHERE a."type" = 'PLATFORM' AND e."amount" > 0 AND e."createdAt" >= ${from} AND e."refType" NOT IN ('fee_consolidation')
          GROUP BY 1, 2, 4
        `,
        prisma.remittanceTransfer.findMany({ where: { paidAt: { gte: from } }, select: { sourceCurrency: true, feeAmount: true, sendAmount: true, receiveAmount: true, destCurrency: true, baseRate: true, corridorId: true, providerCode: true } }),
        prisma.remittancePayout.findMany({ where: { status: 'PAID', paidAt: { gte: from } }, select: { providerCode: true, amount: true, currency: true } }),
        prisma.user.findMany({ where: { accountType: 'BUSINESS' }, select: { id: true } }),
        prisma.$queryRaw<Array<{ product: string; currency: string; amount: string; day: Date }>>`
          SELECT 'deposits' AS product, "currency"::text AS currency, SUM("amount")::text AS amount, date_trunc('day', "confirmedAt") AS day FROM "Deposit" WHERE "status" = 'CONFIRMED' AND "confirmedAt" >= ${from} GROUP BY 2, 4
          UNION ALL SELECT 'withdrawals', "currency"::text, SUM("amount")::text, date_trunc('day', "processedAt") FROM "Withdrawal" WHERE "status" = 'COMPLETED' AND "processedAt" >= ${from} GROUP BY 2, 4
          UNION ALL SELECT 'transfers', "currency"::text, SUM("amount")::text, date_trunc('day', "createdAt") FROM "Transfer" WHERE "createdAt" >= ${from} GROUP BY 2, 4
          UNION ALL SELECT 'remittance', "sourceCurrency"::text, SUM("sendAmount")::text, date_trunc('day', "paidAt") FROM "RemittanceTransfer" WHERE "paidAt" >= ${from} GROUP BY 2, 4
          UNION ALL SELECT 'exchange', 'USDT', SUM("quotedTotal")::text, date_trunc('day', "createdAt") FROM "CryptoOrder" WHERE "status" <> 'FAILED' AND "createdAt" >= ${from} GROUP BY 4
          UNION ALL SELECT 'p2p', "currency"::text, SUM("cryptoAmount")::text, date_trunc('day', "completedAt") FROM "P2PTrade" WHERE "status" = 'COMPLETED' AND "completedAt" >= ${from} GROUP BY 2, 4
        `,
      ]);

      // Revenue by product.
      const revenue: Record<string, number> = {};
      for (const f of fees) revenue[f.source] = (revenue[f.source] ?? 0) + Number(f._sum.amountUsd ?? 0);
      let remFeeUsd = 0; let remFxUsd = 0;
      for (const t of remPaid) {
        const rate = await usd.rate(t.sourceCurrency);
        const atBase = Number(t.receiveAmount) / Number(t.baseRate);
        remFeeUsd += Number(t.feeAmount) * rate;
        remFxUsd += Math.max(0, Number(t.sendAmount) - atBase) * rate;
      }
      revenue['remittance fees'] = remFeeUsd;
      revenue['remittance FX margin'] = remFxUsd;

      // Estimated provider costs from contracted terms.
      const terms = new Map(listPayoutAdapters().map((a) => [a.descriptor.code, a.descriptor.terms]));
      let providerCostUsd = 0;
      const costByProvider: Record<string, number> = {};
      for (const p of payouts) {
        const t = terms.get(p.providerCode);
        if (!t) continue;
        const cost = (t.feeFixed + Number(p.amount) * t.feePercent) * (await usd.rate(p.currency));
        providerCostUsd += cost;
        costByProvider[p.providerCode] = (costByProvider[p.providerCode] ?? 0) + cost;
      }
      const networkFees = await prisma.onChainTransaction.aggregate({ where: { createdAt: { gte: from }, type: 'WITHDRAWAL' }, _sum: { gasUsed: true } });

      // Volume by product, currency, month.
      const byProduct: Record<string, number> = {};
      const byCurrency: Record<string, number> = {};
      const byMonth: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      for (const v of volumes) {
        const u = Number(v.amount) * (await usd.rate(v.currency));
        byProduct[v.product] = (byProduct[v.product] ?? 0) + u;
        byCurrency[v.currency] = (byCurrency[v.currency] ?? 0) + u;
        if (v.day) {
          const d = new Date(v.day).toISOString();
          byMonth[d.slice(0, 7)] = (byMonth[d.slice(0, 7)] ?? 0) + u;
          byDay[d.slice(0, 10)] = (byDay[d.slice(0, 10)] ?? 0) + u;
        }
      }
      const corridors = await prisma.remittanceCorridor.findMany({ select: { id: true, code: true } });
      const byCorridor: Record<string, number> = {};
      for (const t of remPaid) {
        const code = corridors.find((c) => c.id === t.corridorId)?.code ?? '?';
        byCorridor[code] = (byCorridor[code] ?? 0) + Number(t.sendAmount) * (await usd.rate(t.sourceCurrency));
      }
      const totalRevenue = Object.values(revenue).reduce((a, b) => a + b, 0);
      const gtv = Object.values(byProduct).reduce((a, b) => a + b, 0);
      const round = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));
      res.json({
        days,
        gtvUsd: Math.round(gtv * 100) / 100,
        revenueUsd: Math.round(totalRevenue * 100) / 100,
        revenueByProduct: round(revenue),
        providerCostsUsd: Math.round(providerCostUsd * 100) / 100,
        providerCostsByProvider: round(costByProvider),
        networkFeesNative: networkFees._sum.gasUsed?.toString() ?? '0',
        estimatedGrossMarginUsd: Math.round((totalRevenue - providerCostUsd) * 100) / 100,
        takeRatePct: gtv ? Math.round((totalRevenue / gtv) * 10000) / 100 : 0,
        volumeByProduct: round(byProduct), volumeByCurrency: round(byCurrency), volumeByMonth: round(byMonth), volumeByCorridor: round(byCorridor),
        dailyVolume: dayKeys(days).map((d) => ({ day: d, usd: Math.round((byDay[d] ?? 0) * 100) / 100 })),
        ledgerRevenueByType: platformCredits.map((p) => ({ refType: p.reftype, currency: p.currency, amount: p.amount, month: p.month })),
        businessCustomers: business.length,
        notes: [
          'Revenue: platform fee register plus remittance fee and FX margin recognised at payout (ledger PLATFORM credits).',
          'Provider costs are estimates from configured rail terms (sandbox terms until partner contracts are signed).',
          'USD values use current rates.',
        ],
      });
    } catch (e) { next(e); }
  },

  async forecasts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const historyDays = Math.min(365, Math.max(30, parseInt(String(req.query.days ?? '120'), 10) || 120));
      const horizon = Math.min(90, Math.max(7, parseInt(String(req.query.horizon ?? '30'), 10) || 30));
      const from = new Date(Date.now() - historyDays * 86400_000);
      const keys = dayKeys(historyDays);
      const usd = usdConverter();
      const exclude = await systemUserIds();

      const series = async (sql: Promise<Array<{ day: Date; currency?: string; v: string }>>, money = false) => {
        const rows = await sql.catch(() => []);
        const map: Record<string, number> = {};
        for (const r of rows) {
          const k = new Date(r.day).toISOString().slice(0, 10);
          map[k] = (map[k] ?? 0) + Number(r.v) * (money && r.currency ? await usd.rate(r.currency) : 1);
        }
        return keys.map((k) => map[k] ?? 0);
      };

      const [volume, revenue, signups, tickets, remittances, riskEvents] = await Promise.all([
        series(prisma.$queryRaw`
          SELECT date_trunc('day', "createdAt") AS day, "currency"::text AS currency, SUM("amount")::text AS v FROM "Transfer" WHERE "createdAt" >= ${from} GROUP BY 1, 2
          UNION ALL SELECT date_trunc('day', "confirmedAt"), "currency"::text, SUM("amount")::text FROM "Deposit" WHERE "status" = 'CONFIRMED' AND "confirmedAt" >= ${from} GROUP BY 1, 2
          UNION ALL SELECT date_trunc('day', "paidAt"), "sourceCurrency"::text, SUM("sendAmount")::text FROM "RemittanceTransfer" WHERE "paidAt" >= ${from} GROUP BY 1, 2
        `, true),
        // Fee register plus remittance fee + FX margin, which is recognised as a
        // PLATFORM ledger credit at payout rather than in the fee register.
        series(prisma.$queryRaw`
          SELECT date_trunc('day', "createdAt") AS day, 'USD' AS currency, SUM("amountUsd")::text AS v FROM "PlatformFee" WHERE "createdAt" >= ${from} GROUP BY 1
          UNION ALL SELECT date_trunc('day', e."createdAt"), e."currency"::text, SUM(e."amount")::text FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
          WHERE a."type" = 'PLATFORM' AND e."refType" = 'remittance_payout' AND e."amount" > 0 AND e."createdAt" >= ${from} GROUP BY 1, 2
        `, true),
        series(prisma.$queryRaw`SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::text AS v FROM "User" WHERE "role" = 'USER' AND "createdAt" >= ${from} AND NOT ("id" = ANY(${exclude}::text[])) GROUP BY 1`),
        series(prisma.$queryRaw`SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::text AS v FROM "SupportEscalation" WHERE "createdAt" >= ${from} GROUP BY 1`),
        series(prisma.$queryRaw`SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::text AS v FROM "RemittanceTransfer" WHERE "createdAt" >= ${from} GROUP BY 1`),
        series(prisma.$queryRaw`SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::text AS v FROM "RiskEvent" WHERE "createdAt" >= ${from} GROUP BY 1`),
      ]);

      const metric = (key: string, label: string, values: number[], unit: string) => ({
        key, label, unit,
        history: keys.map((d, i) => ({ day: d, value: Math.round(values[i] * 100) / 100 })),
        ...forecastSeries(keys, values, horizon),
      });

      // Treasury: days of cover per pool from 30-day average payout consumption.
      const pools = await poolPositions();
      const consumption = await prisma.treasuryMovement.groupBy({ by: ['poolId'], where: { type: 'CONSUME', createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _sum: { amount: true } });
      const liquidity = pools.map((p) => {
        const daily = Number(consumption.find((c) => c.poolId === p.id)?._sum.amount ?? 0) / 30;
        return {
          pool: p.code, currency: p.currency, available: Number(p.available), avgDailyPayout: Math.round(daily * 100) / 100,
          daysOfCover: daily > 0 ? Math.round((Number(p.available) / daily) * 10) / 10 : null,
          neededForHorizon: Math.round(daily * horizon * 100) / 100,
          shortfall: Math.max(0, Math.round((daily * horizon - Number(p.available)) * 100) / 100),
        };
      });

      res.json({
        historyDays, horizonDays: horizon,
        metrics: [
          metric('volume', 'Transaction volume (USD)', volume, 'USD'),
          metric('revenue', 'Fee revenue (USD)', revenue, 'USD'),
          metric('signups', 'New customers', signups, 'count'),
          metric('remittances', 'Remittance transfers', remittances, 'count'),
          metric('support', 'Support tickets', tickets, 'count'),
          metric('risk', 'Risk signals', riskEvents, 'count'),
        ],
        liquidity,
      });
    } catch (e) { next(e); }
  },
};
