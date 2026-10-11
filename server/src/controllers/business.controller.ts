/**
 * /api/business — the business dashboard API used by the mobile app and web.
 * Response shapes follow mobile/src/types/business.ts.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { BusinessPayout } from '@prisma/client';
import { prisma } from '../utils/prisma';
import type { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { writeAudit } from '../services/platform/audit';
import { openCase } from '../services/compliance/cases.service';
import { assertCan, resolveBusiness, TEAM_ROLES } from '../services/business/access';
import { approveBatch, businessStats, cancelPayout, createBatch, previewBulkPay, rejectBatch } from '../services/business/payouts.service';
import { createKey, listKeys, revokeKey } from '../services/business/apiKeys.service';
import { createEndpoint, publicEndpoint } from '../services/business/webhooks.service';

const ctxOf = (req: AuthRequest) => resolveBusiness(req.user!.id);

/** Internal risk fields never leave the platform. */
export function publicPayout(p: BusinessPayout) {
  return {
    id: p.id, reference: p.reference, recipientHandle: p.recipientHandle, recipientEmail: p.recipientEmail,
    amount: p.amount.toString(), currency: p.currency, feeAmount: p.feeAmount.toString(), netAmount: p.netAmount.toString(),
    status: p.status, note: p.note, failureReason: p.failureReason, batchId: p.batchId, createdAt: p.createdAt, completedAt: p.completedAt,
  };
}

function publicBatch(b: any) {
  return {
    id: b.id, reference: b.reference, currency: b.currency, totalAmount: b.totalAmount.toString(), totalFee: b.totalFee.toString(), count: b.count,
    status: b.status, note: b.note, source: b.source, approvalReason: b.approvalReason, createdById: b.createdById, approvedById: b.approvedById,
    approvedAt: b.approvedAt, createdAt: b.createdAt, ...(b.payouts ? { payouts: b.payouts.map(publicPayout) } : {}),
  };
}

const recipientSchema = z.object({
  handle: z.string().trim().max(60).optional(), email: z.string().trim().email().max(200).optional(),
  amount: z.union([z.number(), z.string()]), currency: z.string().max(12).optional(), note: z.string().max(200).optional(),
});
const bulkSchema = z.object({ recipients: z.array(recipientSchema).min(1).max(500), currency: z.string().min(2).max(12), note: z.string().max(500).optional(), stepUpCode: z.string().max(12).optional() });

export const BusinessController = {
  // ── Profile & verification ─────────────────────────────────────────
  async profile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const b = ctx.business;
      res.json({
        profile: {
          id: b.id, legalName: b.legalName ?? b.companyName, tradingName: b.tradingName, country: b.country, kybStatus: b.kybStatus,
          website: b.website, logoUrl: b.logoUrl, createdAt: b.createdAt, role: ctx.role,
          approvalThresholdUsd: b.approvalThresholdUsd?.toString() ?? null, kybNotes: b.kybStatus === 'REJECTED' ? b.kybNotes : null,
        },
      });
    } catch (e) { next(e); }
  },

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      assertCan(ctx, 'profile.edit');
      const body = z.object({
        tradingName: z.string().trim().min(1).max(120).optional(), website: z.string().trim().url().max(200).nullable().optional(),
        logoUrl: z.string().trim().url().max(500).nullable().optional(), approvalThresholdUsd: z.number().min(0).max(10_000_000).nullable().optional(),
      }).parse(req.body);
      if (body.approvalThresholdUsd !== undefined && ctx.role !== 'OWNER') throw new AppError('Only the owner can change the approval threshold', 403);
      const before = ctx.business;
      const updated = await prisma.businessProfile.update({ where: { id: before.id }, data: body });
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_PROFILE_UPDATED', entity: 'BusinessProfile', entityId: before.id, before: { tradingName: before.tradingName, website: before.website, logoUrl: before.logoUrl, approvalThresholdUsd: before.approvalThresholdUsd }, after: body });
      res.json({ profile: { id: updated.id, legalName: updated.legalName ?? updated.companyName, tradingName: updated.tradingName, country: updated.country, kybStatus: updated.kybStatus, website: updated.website, logoUrl: updated.logoUrl, createdAt: updated.createdAt } });
    } catch (e) { next(e); }
  },

  /** Owner submits the business for KYB review (documents go through the KYC upload flow). */
  async submitKyb(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      assertCan(ctx, 'kyb.submit');
      const moved = await prisma.businessProfile.updateMany({ where: { id: ctx.business.id, kybStatus: { in: ['NOT_SUBMITTED', 'REJECTED'] } }, data: { kybStatus: 'PENDING' } });
      if (moved.count !== 1) throw new AppError(`Verification is already ${ctx.business.kybStatus.toLowerCase().replace('_', ' ')}`, 409);
      await openCase({ type: 'KYB', priority: 'MEDIUM', title: `KYB review: ${ctx.business.companyName}`, summary: `Submitted by the owner. Country ${ctx.business.country}; registration ${ctx.business.registrationNo ?? 'not given'}.`, subjectUserId: ctx.business.userId, subjectBusinessId: ctx.business.id, subjectType: 'BUSINESS', subjectId: ctx.business.id });
      res.json({ kybStatus: 'PENDING' });
    } catch (e) { next(e); }
  },

  async stats(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ stats: await businessStats(await ctxOf(req)) }); } catch (e) { next(e); }
  },

  // ── API keys ───────────────────────────────────────────────────────
  async listApiKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ keys: await listKeys(await ctxOf(req)) }); } catch (e) { next(e); }
  },
  async createApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ name: z.string().trim().min(2).max(80), permissions: z.array(z.string()).min(1).max(5), expiresInDays: z.number().int().optional() }).parse(req.body);
      res.status(201).json({ key: await createKey(await ctxOf(req), body) });
    } catch (e) { next(e); }
  },
  async revokeApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try { await revokeKey(await ctxOf(req), req.params.id); res.json({ success: true }); } catch (e) { next(e); }
  },

  // ── Team ───────────────────────────────────────────────────────────
  async listTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const members = await prisma.businessTeamMember.findMany({
        where: { businessId: ctx.business.id, status: { not: 'REMOVED' } }, orderBy: [{ role: 'asc' }, { invitedAt: 'asc' }],
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, username: true } } },
      });
      res.json({ members, role: ctx.role });
    } catch (e) { next(e); }
  },

  async invite(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      assertCan(ctx, 'team.manage');
      const body = z.object({ email: z.string().trim().toLowerCase().email().max(200), role: z.enum(['ADMIN', 'ANALYST', 'DEVELOPER']) }).parse(req.body);
      if (body.role === 'ADMIN' && ctx.role !== 'OWNER') throw new AppError('Only the owner can invite admins', 403);
      const existing = await prisma.businessTeamMember.findFirst({ where: { businessId: ctx.business.id, email: body.email, status: { in: ['ACTIVE', 'PENDING'] } } });
      if (existing) throw new AppError('This person is already on the team or invited', 409);
      const count = await prisma.businessTeamMember.count({ where: { businessId: ctx.business.id, status: { in: ['ACTIVE', 'PENDING'] } } });
      if (count >= 50) throw new AppError('A team can have at most 50 members', 400, 'LIMIT_EXCEEDED');
      const user = await prisma.user.findFirst({ where: { email: { equals: body.email, mode: 'insensitive' } }, select: { id: true } });
      // Membership starts PENDING: the invitee must accept before gaining access.
      const member = await prisma.businessTeamMember.create({ data: { businessId: ctx.business.id, userId: user?.id ?? null, email: body.email, role: body.role, status: 'PENDING', invitedById: ctx.userId } });
      if (user) await prisma.notification.create({ data: { userId: user.id, title: 'Team invitation', message: `${ctx.business.tradingName ?? ctx.business.companyName} invited you to join as ${body.role.toLowerCase()}.`, type: 'info' } });
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_TEAM_INVITE', entity: 'BusinessTeamMember', entityId: member.id, after: { email: body.email, role: body.role } });
      res.status(201).json({ member });
    } catch (e) { next(e); }
  },

  async updateRole(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      assertCan(ctx, 'team.manage');
      const body = z.object({ role: z.enum(['ADMIN', 'ANALYST', 'DEVELOPER']) }).parse(req.body);
      const m = await prisma.businessTeamMember.findFirst({ where: { id: req.params.id, businessId: ctx.business.id } });
      if (!m) throw new AppError('Member not found', 404);
      if (m.role === 'OWNER') throw new AppError('The owner’s role cannot be changed', 403);
      if ((body.role === 'ADMIN' || m.role === 'ADMIN') && ctx.role !== 'OWNER') throw new AppError('Only the owner can grant or remove admin rights', 403);
      const member = await prisma.businessTeamMember.update({ where: { id: m.id }, data: { role: body.role } });
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_TEAM_ROLE', entity: 'BusinessTeamMember', entityId: m.id, before: { role: m.role }, after: { role: body.role } });
      res.json({ member });
    } catch (e) { next(e); }
  },

  async removeMember(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const m = await prisma.businessTeamMember.findFirst({ where: { id: req.params.id, businessId: ctx.business.id } });
      if (!m) throw new AppError('Member not found', 404);
      const self = m.userId === ctx.userId;
      if (!self) assertCan(ctx, 'team.manage');
      if (m.role === 'OWNER') throw new AppError('The owner cannot be removed', 403);
      if (m.role === 'ADMIN' && !self && ctx.role !== 'OWNER') throw new AppError('Only the owner can remove an admin', 403);
      await prisma.businessTeamMember.update({ where: { id: m.id }, data: { status: 'REMOVED' } });
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_TEAM_REMOVE', entity: 'BusinessTeamMember', entityId: m.id, before: { role: m.role, status: m.status } });
      res.json({ success: true });
    } catch (e) { next(e); }
  },

  /** Invitations addressed to the signed-in user. */
  async myInvitations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { email: true } });
      const invites = await prisma.businessTeamMember.findMany({
        where: { status: 'PENDING', OR: [{ userId: req.user!.id }, { email: me.email.toLowerCase() }] },
        include: { business: { select: { companyName: true, tradingName: true, country: true } } },
      });
      res.json({ invitations: invites.map((i) => ({ id: i.id, role: i.role, invitedAt: i.invitedAt, business: i.business })) });
    } catch (e) { next(e); }
  },

  async acceptInvitation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: { email: true } });
      if (await prisma.businessProfile.count({ where: { userId: req.user!.id } })) throw new AppError('A business owner cannot join another business with this account', 409);
      const moved = await prisma.businessTeamMember.updateMany({
        where: { id: req.params.id, status: 'PENDING', OR: [{ userId: req.user!.id }, { email: me.email.toLowerCase() }] },
        data: { status: 'ACTIVE', userId: req.user!.id, joinedAt: new Date() },
      });
      if (moved.count !== 1) throw new AppError('Invitation not found or no longer valid', 404);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'BUSINESS_TEAM_JOINED', entity: 'BusinessTeamMember', entityId: req.params.id });
      res.json({ success: true });
    } catch (e) { next(e); }
  },

  // ── Bulk pay & payouts ─────────────────────────────────────────────
  async preview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = bulkSchema.parse(req.body);
      res.json({ preview: await previewBulkPay(await ctxOf(req), body) });
    } catch (e) { next(e); }
  },

  async submit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = bulkSchema.parse(req.body);
      const idem = req.headers['idempotency-key'];
      const { batch, replayed } = await createBatch(await ctxOf(req), {
        recipients: body.recipients, currency: body.currency, note: body.note, idempotencyKey: typeof idem === 'string' ? idem : undefined,
        source: 'APP', stepUp: { req, code: body.stepUpCode },
      });
      res.status(replayed ? 200 : 201).json({
        batchId: batch.id, status: batch.status, pendingApproval: batch.status === 'PENDING_APPROVAL', complianceReview: batch.status === 'COMPLIANCE_REVIEW',
        approvalReason: batch.approvalReason, payouts: batch.payouts.map(publicPayout), replayed,
      });
    } catch (e) { next(e); }
  },

  async listPayouts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const q = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(25), status: z.string().optional(), batchId: z.string().optional(), currency: z.string().optional() }).parse(req.query);
      const where = { businessId: ctx.business.id, ...(q.status ? { status: q.status } : {}), ...(q.batchId ? { batchId: q.batchId } : {}), ...(q.currency ? { currency: q.currency.toUpperCase() as any } : {}) };
      const [rows, total] = await Promise.all([
        prisma.businessPayout.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
        prisma.businessPayout.count({ where }),
      ]);
      res.json({ payouts: rows.map(publicPayout), total, page: q.page, pages: Math.max(1, Math.ceil(total / q.limit)) });
    } catch (e) { next(e); }
  },

  async getPayout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const p = await prisma.businessPayout.findFirst({ where: { id: req.params.id, businessId: ctx.business.id } });
      if (!p) throw new AppError('Payout not found', 404);
      res.json({ payout: publicPayout(p) });
    } catch (e) { next(e); }
  },

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ payout: publicPayout(await cancelPayout(await ctxOf(req), req.params.id)) }); } catch (e) { next(e); }
  },

  async listBatches(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const rows = await prisma.businessPayoutBatch.findMany({ where: { businessId: ctx.business.id, ...(status ? { status } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 });
      res.json({ batches: rows.map(publicBatch) });
    } catch (e) { next(e); }
  },

  async getBatch(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const b = await prisma.businessPayoutBatch.findFirst({ where: { id: req.params.id, businessId: ctx.business.id }, include: { payouts: { orderBy: { createdAt: 'asc' } } } });
      if (!b) throw new AppError('Batch not found', 404);
      res.json({ batch: publicBatch(b) });
    } catch (e) { next(e); }
  },

  async approve(req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json({ batch: publicBatch(await approveBatch(await ctxOf(req), req.params.id)) }); } catch (e) { next(e); }
  },

  async reject(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ reason: z.string().trim().min(3).max(300) }).parse(req.body);
      res.json({ batch: publicBatch(await rejectBatch(await ctxOf(req), req.params.id, body.reason)) });
    } catch (e) { next(e); }
  },

  // ── Webhooks ───────────────────────────────────────────────────────
  async listWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const rows = await prisma.businessWebhookEndpoint.findMany({ where: { businessId: ctx.business.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
      res.json({ webhooks: rows.map((r) => publicEndpoint(r)) });
    } catch (e) { next(e); }
  },

  async createWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      assertCan(ctx, 'webhooks.manage');
      const body = z.object({ url: z.string().trim().max(500), events: z.array(z.string()).min(1).max(20) }).parse(req.body);
      const e = await createEndpoint(ctx.business.id, body);
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_WEBHOOK_CREATED', entity: 'BusinessWebhookEndpoint', entityId: e.id, after: { url: e.url, events: e.events } });
      res.status(201).json({ webhook: publicEndpoint(e, true) });
    } catch (e) { next(e); }
  },

  async deleteWebhook(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      assertCan(ctx, 'webhooks.manage');
      const moved = await prisma.businessWebhookEndpoint.updateMany({ where: { id: req.params.id, businessId: ctx.business.id, status: 'ACTIVE' }, data: { status: 'DISABLED' } });
      if (moved.count !== 1) throw new AppError('Webhook not found', 404);
      await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_WEBHOOK_DISABLED', entity: 'BusinessWebhookEndpoint', entityId: req.params.id });
      res.json({ success: true });
    } catch (e) { next(e); }
  },

  async deliveries(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ctx = await ctxOf(req);
      const endpoint = await prisma.businessWebhookEndpoint.findFirst({ where: { id: req.params.id, businessId: ctx.business.id } });
      if (!endpoint) throw new AppError('Webhook not found', 404);
      const rows = await prisma.businessWebhookDelivery.findMany({ where: { endpointId: endpoint.id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, event: true, status: true, attempts: true, responseStatus: true, lastError: true, deliveredAt: true, createdAt: true } });
      res.json({ deliveries: rows });
    } catch (e) { next(e); }
  },
};

export { TEAM_ROLES };
