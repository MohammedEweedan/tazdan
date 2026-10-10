/**
 * /api/v1 — the public business API, authenticated with API keys.
 * Every write needs an Idempotency-Key header; a retry with the same key
 * returns the original result instead of paying twice.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import type { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { getRate } from '../services/exchange/fxRateProvider.service';
import type { BusinessContext, TeamRole } from '../services/business/access';
import { createBatch } from '../services/business/payouts.service';
import { createEndpoint, publicEndpoint } from '../services/business/webhooks.service';
import { writeAudit } from '../services/platform/audit';
import { publicPayout } from './business.controller';

async function ctxOf(req: AuthRequest): Promise<BusinessContext> {
  const key = req.apiKey!;
  const business = await prisma.businessProfile.findUniqueOrThrow({ where: { id: key.businessId! } });
  return { business, role: (key.role ?? 'ANALYST') as TeamRole, memberId: `apikey:${key.id}`, userId: key.userId };
}

const recipient = z.object({ handle: z.string().trim().max(60).optional(), email: z.string().trim().email().max(200).optional() })
  .refine((r) => r.handle || r.email, 'recipient.handle or recipient.email is required');

export const PublicApiController = {
  async balances(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const wallets = await prisma.wallet.findMany({ where: { userId: ctx.business.userId }, orderBy: { currency: 'asc' } });
      res.json({ data: wallets.map((w) => ({ currency: w.currency, balance: w.balance.toString(), reserved: w.frozen.toString(), available: w.balance.minus(w.frozen).toString() })) });
    } catch (e) { next(e); }
  },

  async rates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = z.object({ base: z.string().trim().toUpperCase().regex(/^[A-Z]{3,5}$/), quote: z.string().trim().toUpperCase().regex(/^[A-Z]{3,5}$/) }).parse(req.query);
      const r = await getRate(q.base, q.quote);
      res.json({ data: { base: q.base, quote: q.quote, buy: r.buyPrice, sell: r.sellPrice, source: r.source, asOf: r.fetchedAt } });
    } catch (e) { next(e); }
  },

  async createPayout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const idem = req.headers['idempotency-key'];
      if (typeof idem !== 'string' || idem.trim().length < 8) throw new AppError('An Idempotency-Key header (8+ characters) is required', 400);
      const body = z.union([
        z.object({ recipient, amount: z.union([z.number(), z.string()]), currency: z.string().min(2).max(12), note: z.string().max(200).optional() }),
        z.object({ recipients: z.array(recipient.and(z.object({ amount: z.union([z.number(), z.string()]), note: z.string().max(200).optional() }))).min(1).max(500), currency: z.string().min(2).max(12), note: z.string().max(500).optional() }),
      ]).parse(req.body);
      const rows = 'recipients' in body ? body.recipients : [{ ...body.recipient, amount: body.amount, note: body.note }];
      const { batch, replayed } = await createBatch(await ctxOf(req), {
        recipients: rows, currency: body.currency, note: 'recipients' in body ? body.note : undefined,
        idempotencyKey: idem.trim(), source: 'API', apiKeyId: req.apiKey!.id,
      });
      res.status(replayed ? 200 : 201).json({ data: { batchId: batch.id, reference: batch.reference, status: batch.status, payouts: batch.payouts.map(publicPayout) }, replayed });
    } catch (e) { next(e); }
  },

  async listPayouts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25), status: z.string().optional(), batchId: z.string().optional(), startingAfter: z.string().optional() }).parse(req.query);
      const rows = await prisma.businessPayout.findMany({
        where: { businessId: ctx.business.id, ...(q.status ? { status: q.status } : {}), ...(q.batchId ? { batchId: q.batchId } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: q.limit + 1,
        ...(q.startingAfter ? { cursor: { id: q.startingAfter }, skip: 1 } : {}),
      });
      res.json({ data: rows.slice(0, q.limit).map(publicPayout), hasMore: rows.length > q.limit });
    } catch (e) { next(e); }
  },

  async getPayout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const p = await prisma.businessPayout.findFirst({ where: { businessId: ctx.business.id, OR: [{ id: req.params.id }, { reference: req.params.id }] } });
      if (!p) throw new AppError('Payout not found', 404);
      res.json({ data: publicPayout(p) });
    } catch (e) { next(e); }
  },

  async getBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const b = await prisma.businessPayoutBatch.findFirst({ where: { businessId: ctx.business.id, OR: [{ id: req.params.id }, { reference: req.params.id }] }, include: { payouts: true } });
      if (!b) throw new AppError('Batch not found', 404);
      res.json({ data: { id: b.id, reference: b.reference, status: b.status, currency: b.currency, totalAmount: b.totalAmount.toString(), totalFee: b.totalFee.toString(), count: b.count, createdAt: b.createdAt, payouts: b.payouts.map(publicPayout) } });
    } catch (e) { next(e); }
  },

  async listWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const rows = await prisma.businessWebhookEndpoint.findMany({ where: { businessId: ctx.business.id, status: 'ACTIVE' } });
      res.json({ data: rows.map((r) => publicEndpoint(r)) });
    } catch (e) { next(e); }
  },

  async createWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const body = z.object({ url: z.string().trim().max(500), events: z.array(z.string()).min(1).max(20) }).parse(req.body);
      const e = await createEndpoint(ctx.business.id, body);
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_WEBHOOK_CREATED', entity: 'BusinessWebhookEndpoint', entityId: e.id, after: { url: e.url, events: e.events, viaApiKey: req.apiKey!.id } });
      res.status(201).json({ data: publicEndpoint(e, true) });
    } catch (e) { next(e); }
  },

  async deleteWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const moved = await prisma.businessWebhookEndpoint.updateMany({ where: { id: req.params.id, businessId: ctx.business.id, status: 'ACTIVE' }, data: { status: 'DISABLED' } });
      if (moved.count !== 1) throw new AppError('Webhook not found', 404);
      res.json({ data: { id: req.params.id, status: 'DISABLED' } });
    } catch (e) { next(e); }
  },
};
