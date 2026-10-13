/**
 * Cockpit: remittance, FX, treasury, providers and reconciliation centres.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { Prisma, ProviderStatus, RemittanceState } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../../services/platform/audit';
import { listTransitions } from '../../services/platform/lifecycle';
import { setCorridorStatus } from '../../services/remittance/corridors';
import { decideReview, refund, retryPayout } from '../../services/remittance/remittance.service';
import { requestApproval } from '../../services/platform/approvals.service';
import { moveTreasury, poolPositions, treasuryAlerts } from '../../services/treasury/pools.service';
import { circuitOpen, listPayoutAdapters } from '../../services/providers/registry';
import { resolveItem, runIntegrityReconciliation, runProviderReconciliation } from '../../services/reconciliation/recon.service';
import { acknowledgeBaseline, auditFundIntegrity } from '../../services/ledger/fundIntegrity.service';
import { principalPositions, recordHedge } from '../../services/exchange/principalExposure.service';
import { getLiveProviderRate, getRate } from '../../services/exchange/fxRateProvider.service';
import { pageParams, usdConverter } from './helpers';
import { assertNotSelf } from '../../services/platform/segregation';

const FAILED_STATES: RemittanceState[] = ['FAILED', 'REFUND_PENDING', 'DISPUTED'];

export const CockpitMoneyController = {
  // ── Remittance ─────────────────────────────────────────────────────
  async remittanceOverview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const since = new Date(Date.now() - (parseInt(String(req.query.days ?? '30'), 10) || 30) * 86400_000);
      const usd = usdConverter();
      const [corridors, byState, byCorridor, providerStats, reviews, recent] = await Promise.all([
        prisma.remittanceCorridor.findMany({ orderBy: { code: 'asc' } }),
        prisma.remittanceTransfer.groupBy({ by: ['state'], where: { createdAt: { gte: since } }, _count: true }),
        prisma.remittanceTransfer.groupBy({ by: ['corridorId', 'sourceCurrency'], where: { createdAt: { gte: since } }, _count: true, _sum: { sendAmount: true, feeAmount: true } }),
        prisma.remittancePayout.groupBy({ by: ['providerCode', 'status'], where: { createdAt: { gte: since } }, _count: true }),
        prisma.remittanceTransfer.findMany({ where: { state: 'MANUAL_REVIEW' }, orderBy: { createdAt: 'asc' }, take: 50, include: { corridor: { select: { code: true } }, user: { select: { id: true, firstName: true, lastName: true } } } }),
        prisma.remittanceTransfer.findMany({ orderBy: { createdAt: 'desc' }, take: 25, include: { corridor: { select: { code: true } }, beneficiary: { select: { fullName: true } } } }),
      ]);
      const paidTimes = await prisma.$queryRaw<Array<{ provider: string | null; avg_minutes: number | null }>>`
        SELECT "providerCode" AS provider, AVG(EXTRACT(EPOCH FROM ("paidAt" - "createdAt")) / 60)::float AS avg_minutes
        FROM "RemittanceTransfer" WHERE "paidAt" IS NOT NULL AND "createdAt" >= ${since} GROUP BY "providerCode"
      `;
      const providers = [...new Set(providerStats.map((p) => p.providerCode))].map((code) => {
        const n = (s: string) => providerStats.find((p) => p.providerCode === code && p.status === s)?._count ?? 0;
        const total = providerStats.filter((p) => p.providerCode === code).reduce((a, p) => a + p._count, 0);
        const paid = n('PAID'); const failed = n('FAILED') + n('RETURNED');
        return { providerCode: code, payouts: total, paid, failed, inFlight: n('SUBMITTED') + n('PENDING'), successRate: paid + failed ? paid / (paid + failed) : null, avgDeliveryMinutes: paidTimes.find((p) => p.provider === code)?.avg_minutes ?? null };
      });
      const corridorRows = await Promise.all(corridors.map(async (c) => {
        const rows = byCorridor.filter((r) => r.corridorId === c.id);
        const volume = rows.reduce((n, r) => n + Number(r._sum.sendAmount ?? 0), 0);
        const fees = rows.reduce((n, r) => n + Number(r._sum.feeAmount ?? 0), 0);
        const rate = await usd.rate(c.sourceCurrency);
        return {
          code: c.code, name: c.name, status: c.status, direction: c.direction, sourceCurrency: c.sourceCurrency, destCurrency: c.destCurrency,
          transfers: rows.reduce((n, r) => n + r._count, 0), volumeSource: volume, volumeUsd: Math.round(volume * rate * 100) / 100,
          feesUsd: Math.round(fees * rate * 100) / 100, spreadPercent: Number(c.spreadPercent), feeFixed: Number(c.feeFixed), feePercent: Number(c.feePercent),
          minAmount: Number(c.minAmount), maxAmount: Number(c.maxAmount), payoutMethods: c.payoutMethods,
        };
      }));
      res.json({
        corridors: corridorRows,
        states: Object.fromEntries(byState.map((s) => [s.state, s._count])),
        failures: byState.filter((s) => FAILED_STATES.includes(s.state)).reduce((n, s) => n + s._count, 0),
        providers, reviews, recent,
      });
    } catch (e) { next(e); }
  },

  async remittanceList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req);
      const where: Prisma.RemittanceTransferWhereInput = {};
      if (req.query.state) where.state = String(req.query.state) as RemittanceState;
      if (req.query.corridor) where.corridor = { code: String(req.query.corridor) };
      if (req.query.provider) where.providerCode = String(req.query.provider);
      if (req.query.q) where.OR = [{ reference: String(req.query.q) }, { providerRef: String(req.query.q) }, { id: String(req.query.q) }];
      if (req.query.minRisk) where.riskScore = { gte: Number(req.query.minRisk) };
      const [items, total] = await Promise.all([
        prisma.remittanceTransfer.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { corridor: { select: { code: true, status: true } }, beneficiary: { select: { fullName: true, country: true } }, user: { select: { id: true, firstName: true, lastName: true } } } }),
        prisma.remittanceTransfer.count({ where }),
      ]);
      res.json({ items, total, page, limit });
    } catch (e) { next(e); }
  },

  async remittanceDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const t = await prisma.remittanceTransfer.findUnique({
        where: { id: req.params.id },
        include: { corridor: true, beneficiary: true, quote: true, routes: { orderBy: [{ selected: 'desc' }, { rank: 'asc' }] }, payouts: { orderBy: { attempt: 'asc' } }, refunds: true, user: { select: { id: true, firstName: true, lastName: true, email: true, kycTier: true, country: true } } },
      });
      if (!t) throw new AppError('Remittance not found', 404);
      const [transitions, ledger, risk, calls, cases, treasury, audit, recon] = await Promise.all([
        listTransitions('REMITTANCE', t.id),
        prisma.ledgerEntry.findMany({ where: { refId: t.id }, orderBy: { createdAt: 'asc' }, include: { account: { select: { type: true, userId: true, currency: true } } } }),
        prisma.riskDecision.findMany({ where: { subjectType: 'REMITTANCE', subjectId: t.id } }),
        prisma.providerCall.findMany({ where: { entityType: 'REMITTANCE', entityId: t.id }, orderBy: { createdAt: 'asc' } }),
        prisma.complianceCase.findMany({ where: { subjectType: 'REMITTANCE', subjectId: t.id } }),
        prisma.treasuryMovement.findMany({ where: { transferId: t.id }, orderBy: { createdAt: 'asc' }, include: { pool: { select: { code: true } } } }),
        prisma.auditLog.findMany({ where: { entityId: t.id }, orderBy: { createdAt: 'asc' } }),
        prisma.reconciliationItem.findMany({ where: { internalId: { in: t.payouts.map((p) => p.id) } }, orderBy: { createdAt: 'desc' } }),
      ]);
      const groups = new Map<string, any[]>();
      for (const e of ledger) { if (!groups.has(e.groupId)) groups.set(e.groupId, []); groups.get(e.groupId)!.push(e); }
      res.json({
        transfer: t, transitions, risk, providerCalls: calls, cases, treasury, audit, reconciliation: recon,
        ledgerGroups: [...groups.entries()].map(([groupId, entries]) => ({ groupId, refType: entries[0].refType, createdAt: entries[0].createdAt, entries })),
      });
    } catch (e) { next(e); }
  },

  async remittanceReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ approve: z.boolean(), note: z.string().trim().min(5).max(2000) }).parse(req.body);
      const owner = await prisma.remittanceTransfer.findUnique({ where: { id: req.params.id }, select: { userId: true } });
      assertNotSelf(req.user!.id, [owner?.userId], 'remittance_review', { ipAddress: req.ip, path: req.originalUrl });
      res.json({ transfer: await decideReview(req.params.id, body.approve, req.user!.id, body.note, req) });
    } catch (e) { next(e); }
  },

  async remittanceRetry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { note } = z.object({ note: z.string().trim().min(5) }).parse(req.body);
      const t = await retryPayout(req.params.id, req.user!.id);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'REMITTANCE_RETRY', entity: 'RemittanceTransfer', entityId: t.id, after: { state: t.state, provider: t.providerCode }, reason: note, req });
      res.json({ transfer: t });
    } catch (e) { next(e); }
  },

  /** Refund before payout (from clearing) directly; after payout via maker-checker. */
  async remittanceRefund(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = z.object({ reason: z.string().trim().min(10).max(2000) }).parse(req.body);
      const t = await prisma.remittanceTransfer.findUnique({ where: { id: req.params.id } });
      if (!t) throw new AppError('Remittance not found', 404);
      assertNotSelf(req.user!.id, [t.userId], 'remittance_refund', { ipAddress: req.ip, path: req.originalUrl });
      if (['PAID', 'RECONCILIATION_PENDING', 'RECONCILED', 'COMPLETED'].includes(t.state)) {
        const approval = await requestApproval({ type: 'REMITTANCE_REFUND', payload: { transferId: t.id }, reason, requestedById: req.user!.id, subjectType: 'REMITTANCE', subjectId: t.id, permissions: req.staff!.permissions, req });
        return res.status(202).json({ pendingApproval: true, approvalId: approval.id, message: 'The payout already happened, so this goodwill refund comes from corporate funds and needs a second approver.' });
      }
      if (!['FAILED', 'MANUAL_REVIEW', 'FUNDED', 'ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'DISPUTED'].includes(t.state)) {
        throw new AppError(`A ${t.state} transfer cannot be refunded here`, 409);
      }
      const done = await refund(t.id, { type: 'STAFF', id: req.user!.id }, reason);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'REMITTANCE_REFUND', entity: 'RemittanceTransfer', entityId: t.id, before: { state: t.state }, after: { state: done.state }, reason, req });
      res.json({ transfer: done });
    } catch (e) { next(e); }
  },

  async corridorStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ status: z.enum(['LIVE', 'SANDBOX_ONLY', 'PAUSED', 'DISABLED']), reason: z.string().trim().min(5) }).parse(req.body);
      res.json({ corridor: await setCorridorStatus(req.params.code, body.status, req.user!.id, body.reason, req) });
    } catch (e) { next(e); }
  },

  async corridorPricing(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        feeFixed: z.number().min(0).optional(), feePercent: z.number().min(0).max(0.1).optional(), spreadPercent: z.number().min(0).max(0.1).optional(),
        minAmount: z.number().positive().optional(), maxAmount: z.number().positive().optional(),
        rateFloor: z.number().positive().nullable().optional(), rateCeiling: z.number().positive().nullable().optional(),
        reason: z.string().trim().min(5),
      }).parse(req.body);
      const c = await prisma.remittanceCorridor.findUnique({ where: { code: req.params.code } });
      if (!c) throw new AppError('Corridor not found', 404);
      const { reason, ...data } = body;
      const updated = await prisma.remittanceCorridor.update({ where: { code: c.code }, data });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'CORRIDOR_PRICING', entity: 'RemittanceCorridor', entityId: c.id, before: { feeFixed: c.feeFixed, feePercent: c.feePercent, spreadPercent: c.spreadPercent, minAmount: c.minAmount, maxAmount: c.maxAmount, rateFloor: c.rateFloor, rateCeiling: c.rateCeiling }, after: data, reason, req });
      res.json({ corridor: updated });
    } catch (e) { next(e); }
  },

  // ── FX ─────────────────────────────────────────────────────────────
  async fx(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const pairs = [['USD', 'LYD'], ['EUR', 'LYD'], ['GBP', 'LYD'], ['EGP', 'LYD'], ['TRY', 'LYD'], ['AED', 'LYD'], ['TND', 'LYD'], ['SAR', 'LYD'], ['USDT', 'USD']];
      const rows = await Promise.all(pairs.map(async ([b, q]) => {
        const [effective, live, stored] = await Promise.all([
          getRate(b, q).catch(() => null),
          getLiveProviderRate(b, q).catch(() => null),
          prisma.exchangeRate.findUnique({ where: { baseCurrency_quoteCurrency: { baseCurrency: b as any, quoteCurrency: q as any } } }).catch(() => null),
        ]);
        return {
          pair: `${b}/${q}`, effective, live,
          override: stored?.isActive && stored.setBy ? { buyPrice: stored.buyPrice, sellPrice: stored.sellPrice, setBy: stored.setBy, reason: stored.overrideReason, expiresAt: stored.overrideExpiresAt, expired: Boolean(stored.overrideExpiresAt && stored.overrideExpiresAt < new Date()), updatedAt: stored.updatedAt } : null,
        };
      }));
      const since = new Date(Date.now() - 30 * 86400_000);
      const [quotes, conversions, overrides, history] = await Promise.all([
        prisma.remittanceQuote.groupBy({ by: ['sourceCurrency', 'destCurrency'], where: { createdAt: { gte: since } }, _count: true, _sum: { sendAmount: true } }),
        prisma.transaction.groupBy({ by: ['currency'], where: { createdAt: { gte: since }, type: 'SELL', metadata: { path: ['kind'], equals: 'swap' } }, _count: true, _sum: { amount: true } }),
        prisma.auditLog.findMany({ where: { action: { in: ['UPDATE_RATE', 'FX_OVERRIDE_APPLIED', 'CLEAR_RATE_OVERRIDE'] } }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.fxRateTick.findMany({ where: { pair: 'USD/LYD', createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true, price: true } }),
      ]);
      const fxRevenue = await prisma.$queryRaw<Array<{ currency: string; amount: string }>>`
        SELECT e."currency"::text AS currency, SUM(e."amount")::text AS amount FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId"
        WHERE a."type" = 'PLATFORM' AND e."refType" = 'remittance_payout' AND e."createdAt" >= ${since} GROUP BY 1
      `;
      res.json({ rates: rows, quotes, conversions, overrides, history: history.map((h) => ({ at: h.createdAt, price: Number(h.price) })), remittanceRevenue30d: fxRevenue });
    } catch (e) { next(e); }
  },

  async fxOverrideRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ base: z.string(), quote: z.string(), buyPrice: z.number().positive(), sellPrice: z.number().positive(), expiresInMinutes: z.number().int().min(5).max(1440), reason: z.string().trim().min(10) }).parse(req.body);
      const { reason, ...payload } = body;
      const approval = await requestApproval({ type: 'FX_OVERRIDE', payload, reason, requestedById: req.user!.id, subjectType: 'FX_PAIR', subjectId: `${payload.base}/${payload.quote}`, permissions: req.staff!.permissions, req });
      res.status(202).json({ pendingApproval: true, approvalId: approval.id });
    } catch (e) { next(e); }
  },

  // ── Treasury ───────────────────────────────────────────────────────
  async treasury(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usd = usdConverter();
      const [positions, alerts, settlements, movements, exposure] = await Promise.all([
        poolPositions(), treasuryAlerts(),
        prisma.remittanceSettlement.findMany({ where: { status: { in: ['OPEN', 'INSTRUCTED'] } }, orderBy: { dueAt: 'asc' } }),
        prisma.treasuryMovement.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { pool: { select: { code: true, currency: true } } } }),
        prisma.ledgerAccount.findMany({ where: { type: { in: ['TREASURY', 'PARTNER_SETTLEMENT', 'REMITTANCE_CLEARING'] } } }),
      ]);
      // Forward liquidity need: payouts routed/submitted but not yet paid.
      const inflight = await prisma.remittanceTransfer.groupBy({ by: ['destCurrency'], where: { state: { in: ['ROUTED', 'SETTLEMENT_PENDING', 'SETTLED', 'PAYOUT_PENDING', 'MANUAL_REVIEW', 'FUNDED'] } }, _sum: { receiveAmount: true } });
      const byCurrency = new Map<string, { balance: number; reserved: number; available: number; usd: number }>();
      for (const p of positions) {
        const cur = byCurrency.get(p.currency) ?? { balance: 0, reserved: 0, available: 0, usd: 0 };
        cur.balance += Number(p.balance); cur.reserved += Number(p.reserved); cur.available += Number(p.available);
        cur.usd += Number(p.balance) * (await usd.rate(p.currency));
        byCurrency.set(p.currency, cur);
      }
      res.json({
        positions, alerts, settlements, movements,
        byCurrency: [...byCurrency.entries()].map(([currency, v]) => ({ currency, ...v, usd: Math.round(v.usd * 100) / 100, pendingPayouts: Number(inflight.find((i) => i.destCurrency === currency)?._sum.receiveAmount ?? 0) })),
        ledgerPositions: exposure.map((a) => ({ type: a.type, currency: a.currency, balance: a.balance })),
      });
    } catch (e) { next(e); }
  },

  async treasuryMove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ poolId: z.string(), direction: z.enum(['PREFUND', 'WITHDRAW', 'ADJUST_IN', 'ADJUST_OUT']), amount: z.string().min(1), reference: z.string().trim().min(3).max(80), note: z.string().trim().min(5).max(500) }).parse(req.body);
      res.status(201).json({ movement: await moveTreasury({ ...body, actorId: req.user!.id, req }) });
    } catch (e) { next(e); }
  },

  async treasuryPoolThresholds(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ target: z.number().min(0), minimum: z.number().min(0), maxExposure: z.number().min(0), reason: z.string().trim().min(5) }).parse(req.body);
      if (body.target < body.minimum) throw new AppError('Target must be at least the minimum', 400);
      const pool = await prisma.treasuryPool.findUnique({ where: { id: req.params.id } });
      if (!pool) throw new AppError('Pool not found', 404);
      const updated = await prisma.treasuryPool.update({ where: { id: pool.id }, data: { target: body.target, minimum: body.minimum, maxExposure: body.maxExposure } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'TREASURY_THRESHOLDS', entity: 'TreasuryPool', entityId: pool.id, before: { target: pool.target, minimum: pool.minimum, maxExposure: pool.maxExposure }, after: { target: body.target, minimum: body.minimum, maxExposure: body.maxExposure }, reason: body.reason, req });
      res.json({ pool: updated });
    } catch (e) { next(e); }
  },

  // ── Providers ──────────────────────────────────────────────────────
  async providers(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const since = new Date(Date.now() - 24 * 3600_000);
      const [rows, calls, payouts] = await Promise.all([
        prisma.provider.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] }),
        prisma.providerCall.groupBy({ by: ['providerCode', 'success'], where: { createdAt: { gte: since } }, _count: true, _avg: { latencyMs: true } }),
        prisma.remittancePayout.groupBy({ by: ['providerCode', 'status'], where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true, _sum: { amount: true } }),
      ]);
      const adapters = new Map(listPayoutAdapters().map((a) => [a.descriptor.code, a.descriptor]));
      res.json({
        providers: rows.map((p) => {
          const ok = calls.find((c) => c.providerCode === p.code && c.success);
          const bad = calls.find((c) => c.providerCode === p.code && !c.success);
          const total = (ok?._count ?? 0) + (bad?._count ?? 0);
          const n = (s: string) => payouts.find((x) => x.providerCode === p.code && x.status === s)?._count ?? 0;
          const paid = n('PAID'); const failed = n('FAILED') + n('RETURNED');
          return {
            ...p, circuitOpen: circuitOpen(p.code), terms: adapters.get(p.code)?.terms ?? null,
            calls24h: total, errorRate24h: total ? (bad?._count ?? 0) / total : null,
            avgLatencyMs: Math.round(((ok?._avg.latencyMs ?? 0) * (ok?._count ?? 0) + (bad?._avg.latencyMs ?? 0) * (bad?._count ?? 0)) / (total || 1)),
            payouts30d: payouts.filter((x) => x.providerCode === p.code).reduce((a, x) => a + x._count, 0),
            successRate30d: paid + failed ? paid / (paid + failed) : null,
          };
        }),
      });
    } catch (e) { next(e); }
  },

  async providerStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ status: z.enum(['ENABLED', 'DISABLED', 'MAINTENANCE']), reason: z.string().trim().min(5) }).parse(req.body);
      const p = await prisma.provider.findUnique({ where: { code: req.params.code } });
      if (!p) throw new AppError('Provider not found', 404);
      if (body.status === 'ENABLED' && p.mode !== 'PRODUCTION' && process.env.NODE_ENV === 'production') {
        throw new AppError(`${p.name} is a ${p.mode} adapter and cannot be enabled in production`, 409, 'PROVIDER_NOT_ACTIVATED');
      }
      const updated = await prisma.provider.update({ where: { code: p.code }, data: { status: body.status as ProviderStatus } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'PROVIDER_STATUS', entity: 'Provider', entityId: p.code, before: { status: p.status }, after: { status: body.status }, reason: body.reason, req });
      res.json({ provider: updated });
    } catch (e) { next(e); }
  },

  async providerCalls(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req, 200);
      const where: Prisma.ProviderCallWhereInput = { providerCode: req.params.code };
      const [items, total] = await Promise.all([prisma.providerCall.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }), prisma.providerCall.count({ where })]);
      res.json({ items, total, page, limit });
    } catch (e) { next(e); }
  },

  // ── Reconciliation ─────────────────────────────────────────────────
  async recon(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req, 200);
      const where: Prisma.ReconciliationItemWhereInput = {};
      if (req.query.status) where.status = String(req.query.status);
      else where.status = { not: 'MATCHED' };
      if (req.query.resolution) where.resolution = String(req.query.resolution);
      const [runs, items, total, summary] = await Promise.all([
        prisma.reconciliationRun.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.reconciliationItem.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { run: { select: { source: true, providerCode: true, createdAt: true } } } }),
        prisma.reconciliationItem.count({ where }),
        prisma.reconciliationItem.groupBy({ by: ['status', 'resolution'], _count: true }),
      ]);
      res.json({ runs, items, total, page, limit, summary: summary.map((s) => ({ status: s.status, resolution: s.resolution, count: s._count })) });
    } catch (e) { next(e); }
  },

  async reconRun(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ source: z.enum(['PROVIDER_STATEMENT', 'LEDGER_INTEGRITY']), providerCode: z.string().optional(), hours: z.number().int().min(1).max(24 * 31).default(48), reason: z.string().trim().max(500).optional() }).parse(req.body);
      const run = body.source === 'LEDGER_INTEGRITY'
        ? await runIntegrityReconciliation(req.user!.id)
        : await runProviderReconciliation(body.providerCode ?? '', new Date(Date.now() - body.hours * 3600_000), new Date(), req.user!.id);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'RECON_RUN', entity: 'ReconciliationRun', entityId: run.id, after: { source: body.source, providerCode: body.providerCode ?? null, totals: run.totals }, reason: body.reason, req });
      res.status(201).json({ run });
    } catch (e) { next(e); }
  },

  // ── Principal crypto exposure ─────────────────────────────────────
  async principal(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [summary, hedges] = await Promise.all([
        principalPositions(),
        prisma.principalHedge.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
      ]);
      res.json({ ...summary, hedges });
    } catch (e) { next(e); }
  },

  async principalHedge(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        asset: z.string().trim().min(2).max(12), side: z.enum(['BUY', 'SELL']),
        quantity: z.union([z.number().positive(), z.string().min(1)]), priceUsd: z.union([z.number().positive(), z.string().min(1)]),
        venue: z.string().trim().min(2).max(80), reference: z.string().trim().max(120).optional(), note: z.string().trim().min(5).max(500),
      }).parse(req.body);
      res.status(201).json({ hedge: await recordHedge({ ...body, staffId: req.user!.id, req }) });
    } catch (e) { next(e); }
  },

  async principalLimits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        asset: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/).optional(),
        limitUsd: z.number().min(0).max(10_000_000), reason: z.string().trim().min(5).max(500),
      }).parse(req.body);
      const key = body.asset === 'TOTAL' ? 'principal_max_total_usd' : body.asset ? `principal_max_net_usd.${body.asset}` : 'principal_max_net_usd.default';
      const before = await prisma.platformSettings.findUnique({ where: { key } });
      await prisma.platformSettings.upsert({
        where: { key }, update: { value: String(body.limitUsd), updatedBy: req.user!.id },
        create: { key, value: String(body.limitUsd), description: 'Principal crypto exposure limit (USD)', updatedBy: req.user!.id },
      });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'PRINCIPAL_LIMIT_SET', entity: 'PlatformSettings', entityId: key, before: before ? { value: before.value } : undefined, after: { value: String(body.limitUsd) }, reason: body.reason, req });
      res.json({ key, limitUsd: body.limitUsd });
    } catch (e) { next(e); }
  },

  async fundIntegrity(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await auditFundIntegrity({ haltOnBreach: false }));
    } catch (e) { next(e); }
  },

  async fundBaseline(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ currency: z.string().trim().min(2).max(10), note: z.string().trim().min(10).max(500) }).parse(req.body);
      res.json(await acknowledgeBaseline({ currency: body.currency, staffId: req.user!.id, note: body.note, req }));
    } catch (e) { next(e); }
  },

  async reconResolve(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ resolution: z.enum(['RESOLVED', 'WRITTEN_OFF', 'ESCALATED']), note: z.string().trim().min(5) }).parse(req.body);
      res.json({ item: await resolveItem(req.params.id, body.resolution, body.note, req.user!.id, req) });
    } catch (e) { next(e); }
  },
};
