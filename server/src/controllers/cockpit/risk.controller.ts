/**
 * Cockpit: compliance, fraud, support and business (KYB) centres.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../../services/platform/audit';
import { addCaseNote, CASE_STATUSES, CASE_TRANSITIONS, transitionCase } from '../../services/compliance/cases.service';
import { importWatchlist } from '../../services/compliance/screening.service';
import { LIST_NAMES, refreshSanctionsLists, sanctionsListStatus, type ListName } from '../../services/compliance/sanctionsLists.service';

let refreshing: Promise<unknown> | null = null;
import { DEFAULT_RULES, invalidateRuleCache } from '../../services/risk/engine';
import { pageParams, systemUserIds } from './helpers';
import { assertNotSelf } from '../../services/platform/segregation';
import { complianceDecideBatch } from '../../services/business/payouts.service';

export const CockpitRiskController = {
  // ── Compliance ─────────────────────────────────────────────────────
  async compliance(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req);
      const where: Prisma.ComplianceCaseWhereInput = {};
      if (req.query.status) where.status = String(req.query.status);
      else where.status = { not: 'CLOSED' };
      if (req.query.type) where.type = String(req.query.type);
      if (req.query.assigned === 'me') where.assignedToId = req.user!.id;
      const [cases, total, byStatus, byType, kycQueue, kybQueue, amlOpen, screeningHits, highRiskUsers, overdue] = await Promise.all([
        // SLA due time is derived from priority (CRITICAL 4h … LOW 7d), so it orders by urgency;
        // sorting the priority string itself would be alphabetical.
        prisma.complianceCase.findMany({ where, orderBy: [{ slaDueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }], skip, take: limit }),
        prisma.complianceCase.count({ where }),
        prisma.complianceCase.groupBy({ by: ['status'], _count: true }),
        prisma.complianceCase.groupBy({ by: ['type'], where: { status: { not: 'CLOSED' } }, _count: true }),
        prisma.user.count({ where: { kycStatus: 'PENDING' } }),
        prisma.businessProfile.count({ where: { kybStatus: 'PENDING' } }),
        prisma.aMLFlag.count({ where: { status: { in: ['OPEN', 'REVIEWING', 'ESCALATED'] } } }),
        prisma.screeningResult.findMany({ where: { status: 'POTENTIAL_MATCH', reviewedAt: null }, orderBy: { screenedAt: 'desc' }, take: 50 }),
        prisma.riskDecision.findMany({ where: { score: { gte: 50 }, createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, orderBy: { score: 'desc' }, take: 20, distinct: ['userId'] }),
        prisma.complianceCase.count({ where: { status: { not: 'CLOSED' }, slaDueAt: { lt: new Date() } } }),
      ]);
      const ageing = await prisma.$queryRaw<Array<{ bucket: string; n: bigint }>>`
        SELECT CASE WHEN NOW() - "createdAt" < INTERVAL '1 day' THEN '<1d' WHEN NOW() - "createdAt" < INTERVAL '3 days' THEN '1-3d'
                    WHEN NOW() - "createdAt" < INTERVAL '7 days' THEN '3-7d' ELSE '>7d' END AS bucket, COUNT(*) AS n
        FROM "ComplianceCase" WHERE "status" <> 'CLOSED' GROUP BY 1
      `;
      res.json({
        cases, total, page, limit, statuses: CASE_STATUSES,
        byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
        byType: Object.fromEntries(byType.map((s) => [s.type, s._count])),
        queues: { kyc: kycQueue, kyb: kybQueue, aml: amlOpen, screeningHits: screeningHits.length, overdueCases: overdue },
        screeningHits, highRiskUsers,
        ageing: Object.fromEntries(ageing.map((a) => [a.bucket, Number(a.n)])),
      });
    } catch (e) { next(e); }
  },

  async caseDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const c = await prisma.complianceCase.findUnique({ where: { id: req.params.id }, include: { notes: { orderBy: { createdAt: 'asc' } } } });
      if (!c) throw new AppError('Case not found', 404);
      const [subject, decision, related, people] = await Promise.all([
        c.subjectUserId ? prisma.user.findUnique({ where: { id: c.subjectUserId }, select: { id: true, firstName: true, lastName: true, email: true, country: true, kycStatus: true, kycTier: true, status: true, createdAt: true } }) : null,
        c.riskDecisionId ? prisma.riskDecision.findUnique({ where: { id: c.riskDecisionId } }) : null,
        c.subjectType === 'REMITTANCE' && c.subjectId ? prisma.remittanceTransfer.findUnique({ where: { id: c.subjectId }, include: { beneficiary: true, corridor: { select: { code: true } } } }) : null,
        prisma.user.findMany({ where: { role: 'ADMIN', username: { notIn: ['platform', 'support'] } }, select: { id: true, firstName: true, lastName: true } }),
      ]);
      res.json({ case: c, allowedNext: CASE_TRANSITIONS[c.status as keyof typeof CASE_TRANSITIONS] ?? [], subject, decision, related, staff: people });
    } catch (e) { next(e); }
  },

  async caseTransition(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        to: z.enum(CASE_STATUSES), note: z.string().trim().min(5).max(4000), resolution: z.string().trim().max(4000).optional(),
        assignedToId: z.string().nullable().optional(),
      }).parse(req.body);
      const c = await prisma.complianceCase.findUnique({ where: { id: req.params.id }, select: { subjectUserId: true, subjectBusinessId: true } });
      const owner = c?.subjectBusinessId ? (await prisma.businessProfile.findUnique({ where: { id: c.subjectBusinessId }, select: { userId: true } }))?.userId : null;
      assertNotSelf(req.user!.id, [c?.subjectUserId, owner], 'case_transition', { ipAddress: req.ip, path: req.originalUrl });
      res.json({ case: await transitionCase({ caseId: req.params.id, to: body.to, actorId: req.user!.id, note: body.note, resolution: body.resolution, assignedToId: body.assignedToId, req }) });
    } catch (e) { next(e); }
  },

  async caseNote(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ body: z.string().trim().min(2).max(8000), kind: z.enum(['NOTE', 'EVIDENCE', 'REQUEST_INFORMATION']).default('NOTE') }).parse(req.body);
      const note = await addCaseNote({ caseId: req.params.id, actorId: req.user!.id, body: body.body, kind: body.kind });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'CASE_NOTE', entity: 'ComplianceCase', entityId: req.params.id, after: { kind: body.kind } });
      res.status(201).json({ note });
    } catch (e) { next(e); }
  },

  async screeningReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ status: z.enum(['FALSE_POSITIVE', 'CONFIRMED_MATCH']), note: z.string().trim().min(5) }).parse(req.body);
      const r = await prisma.screeningResult.findUnique({ where: { id: req.params.id } });
      if (!r) throw new AppError('Screening result not found', 404);
      assertNotSelf(req.user!.id, [r.userId], 'screening_review', { ipAddress: req.ip, path: req.originalUrl });
      const updated = await prisma.screeningResult.update({ where: { id: r.id }, data: { status: body.status, reviewedById: req.user!.id, reviewedAt: new Date() } });
      if (r.subjectType === 'BENEFICIARY') {
        await prisma.remittanceBeneficiary.update({ where: { id: r.subjectId }, data: { screeningStatus: body.status === 'FALSE_POSITIVE' ? 'CLEAR' : 'BLOCKED' } }).catch(() => undefined);
      }
      await writeAudit(prisma, { actorId: req.user!.id, action: 'SCREENING_REVIEW', entity: 'ScreeningResult', entityId: r.id, before: { status: r.status }, after: { status: body.status, subjectType: r.subjectType, subjectId: r.subjectId }, reason: body.note, req });
      res.json({ result: updated });
    } catch (e) { next(e); }
  },

  async rules(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await prisma.riskRule.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
      const fired = await prisma.riskEvent.groupBy({ by: ['type'], where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: true });
      res.json({ rules: rows.map((r) => ({ ...r, fired30d: fired.find((f) => f.type === r.code)?._count ?? 0, appliesTo: DEFAULT_RULES.find((d) => d.code === r.code)?.appliesTo ?? [] })) });
    } catch (e) { next(e); }
  },

  async updateRule(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        enabled: z.boolean().optional(), action: z.enum(['APPROVE', 'REVIEW', 'REJECT', 'FREEZE', 'REQUEST_INFORMATION', 'CHALLENGE', 'DELAY', 'BLOCK']).optional(),
        score: z.number().int().min(0).max(100).optional(), params: z.record(z.unknown()).optional(), reason: z.string().trim().min(10),
      }).parse(req.body);
      const rule = await prisma.riskRule.findUnique({ where: { code: req.params.code } });
      if (!rule) throw new AppError('Rule not found', 404);
      const { reason, ...data } = body;
      const updated = await prisma.riskRule.update({ where: { code: rule.code }, data: { ...data, params: (data.params ?? rule.params) as Prisma.InputJsonValue, version: rule.version + 1, updatedById: req.user!.id } });
      invalidateRuleCache();
      await writeAudit(prisma, { actorId: req.user!.id, action: 'RISK_RULE_CHANGED', entity: 'RiskRule', entityId: rule.code, before: { enabled: rule.enabled, action: rule.action, score: rule.score, params: rule.params, version: rule.version }, after: { ...data, version: updated.version }, reason, req });
      res.json({ rule: updated });
    } catch (e) { next(e); }
  },

  async watchlist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req, 200);
      const where: Prisma.WatchlistEntryWhereInput = { active: true };
      if (req.query.q) where.OR = [{ name: { contains: String(req.query.q), mode: 'insensitive' } }, { walletAddress: String(req.query.q) }];
      const [items, total, lists] = await Promise.all([
        prisma.watchlistEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.watchlistEntry.count({ where }),
        prisma.watchlistEntry.groupBy({ by: ['listName', 'source'], where: { active: true }, _count: true, _max: { createdAt: true } }),
      ]);
      res.json({
        items, total, page, limit,
        lists: lists.map((l) => ({ listName: l.listName, source: l.source, entries: l._count, lastImported: l._max.createdAt })),
        official: await sanctionsListStatus(), refreshing: Boolean(refreshing),
      });
    } catch (e) { next(e); }
  },

  /** Download the official lists now (runs in the background; the page polls status). */
  async watchlistRefresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ lists: z.array(z.enum(LIST_NAMES as [ListName, ...ListName[]])).optional(), reason: z.string().trim().min(3).max(500) }).parse(req.body);
      if (refreshing) { res.status(202).json({ started: false, message: 'A refresh is already running' }); return; }
      await writeAudit(prisma, { actorId: req.user!.id, action: 'SANCTIONS_REFRESH_REQUESTED', entity: 'WatchlistEntry', after: { lists: body.lists ?? LIST_NAMES }, reason: body.reason, req });
      refreshing = refreshSanctionsLists({ lists: body.lists, actorId: req.user!.id }).finally(() => { refreshing = null; });
      res.status(202).json({ started: true });
    } catch (e) { next(e); }
  },

  async watchlistImport(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        source: z.string().trim().min(3).max(200),
        rows: z.array(z.object({
          listName: z.string().min(2).max(40), entityType: z.enum(['PERSON', 'ORGANISATION', 'WALLET', 'BANK', 'COUNTRY']),
          name: z.string().max(300).optional(), aliases: z.array(z.string().max(300)).max(50).optional(), country: z.string().max(2).optional(),
          dateOfBirth: z.string().max(10).optional(), walletAddress: z.string().max(120).optional(), identifier: z.string().max(120).optional(),
        })).min(1).max(20000),
      }).parse(req.body);
      const result = await importWatchlist(body.rows, body.source, req.user!.id);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'WATCHLIST_IMPORT', entity: 'WatchlistEntry', after: { source: body.source, created: result.created }, req });
      res.status(201).json(result);
    } catch (e) { next(e); }
  },

  // ── Fraud ──────────────────────────────────────────────────────────
  async fraud(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = Math.min(90, parseInt(String(req.query.days ?? '30'), 10) || 30);
      const since = new Date(Date.now() - days * 86400_000);
      const fraudCodes = DEFAULT_RULES.filter((r) => r.category === 'FRAUD').map((r) => r.code);
      const [byType, recent, decisions, sharedDevices, sharedBeneficiaries, failedLogins, pendingWithdrawalsRisky] = await Promise.all([
        prisma.riskEvent.groupBy({ by: ['type'], where: { createdAt: { gte: since } }, _count: true }),
        prisma.riskEvent.findMany({ where: { createdAt: { gte: since }, type: { in: [...fraudCodes, 'SECURITY_CHANGE'] } }, orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.riskDecision.groupBy({ by: ['outcome'], where: { createdAt: { gte: since } }, _count: true }),
        prisma.$queryRaw<Array<{ fingerprint: string; users: string[]; labels: string[] }>>`
          SELECT "fingerprint", array_agg(DISTINCT "userId") AS users, array_agg(DISTINCT COALESCE("label", '')) AS labels
          FROM "KnownDevice" GROUP BY "fingerprint" HAVING COUNT(DISTINCT "userId") > 1 LIMIT 100
        `,
        prisma.$queryRaw<Array<{ account: string; users: string[] }>>`
          SELECT COALESCE("iban", "accountNumber", "mobileWallet") AS account, array_agg(DISTINCT "userId") AS users
          FROM "RemittanceBeneficiary" WHERE COALESCE("iban", "accountNumber", "mobileWallet") IS NOT NULL
          GROUP BY 1 HAVING COUNT(DISTINCT "userId") > 1 LIMIT 100
        `,
        prisma.securityEvent.groupBy({ by: ['userId'], where: { type: { in: ['FAILED_LOGIN', 'MFA_FAILURE'] }, createdAt: { gte: since }, userId: { not: null } }, _count: true, orderBy: { _count: { userId: 'desc' } }, take: 20 }),
        prisma.withdrawal.findMany({ where: { status: 'PENDING' }, select: { id: true, userId: true, amount: true, currency: true, reference: true, createdAt: true } }),
      ]);
      // Customers with pending withdrawals AND a recent high risk score.
      const riskyIds = new Set((await prisma.riskDecision.findMany({ where: { score: { gte: 40 }, createdAt: { gte: since } }, select: { userId: true } })).map((r) => r.userId));
      const exclude = new Set(await systemUserIds());
      // Graph: customers linked by a shared device or a shared payout account.
      const nodes = new Map<string, { id: string; type: 'customer' | 'device' | 'account'; label: string }>();
      const edges: Array<{ from: string; to: string; kind: string }> = [];
      for (const d of sharedDevices) {
        const dn = `dev:${d.fingerprint.slice(0, 10)}`;
        nodes.set(dn, { id: dn, type: 'device', label: d.labels.filter(Boolean)[0] ?? 'device' });
        for (const u of d.users) if (!exclude.has(u)) { nodes.set(u, { id: u, type: 'customer', label: u.slice(0, 8) }); edges.push({ from: u, to: dn, kind: 'device' }); }
      }
      for (const b of sharedBeneficiaries) {
        const an = `acct:${b.account.slice(-6)}`;
        nodes.set(an, { id: an, type: 'account', label: `…${b.account.slice(-4)}` });
        for (const u of b.users) { nodes.set(u, { id: u, type: 'customer', label: u.slice(0, 8) }); edges.push({ from: u, to: an, kind: 'payout_account' }); }
      }
      const customerIds = [...nodes.values()].filter((n) => n.type === 'customer').map((n) => n.id);
      const people = await prisma.user.findMany({ where: { id: { in: customerIds } }, select: { id: true, firstName: true, lastName: true } });
      for (const p of people) { const n = nodes.get(p.id); if (n) n.label = `${p.firstName} ${p.lastName.slice(0, 1)}.`; }
      res.json({
        signals: byType.map((b) => ({ type: b.type, count: b._count })).sort((a, b) => b.count - a.count),
        decisions: Object.fromEntries(decisions.map((d) => [d.outcome, d._count])),
        recent, failedLoginsByUser: failedLogins.map((f) => ({ userId: f.userId, count: f._count })),
        riskyPendingWithdrawals: pendingWithdrawalsRisky.filter((w) => riskyIds.has(w.userId)),
        graph: { nodes: [...nodes.values()], edges },
      });
    } catch (e) { next(e); }
  },

  // ── Support ────────────────────────────────────────────────────────
  async support(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status ? String(req.query.status) : undefined;
      const tickets = await prisma.supportEscalation.findMany({
        where: status ? { status: status as any } : { status: { in: ['OPEN', 'ASSIGNED'] } },
        orderBy: { createdAt: 'asc' }, take: 100,
        include: { raisedBy: { select: { id: true, firstName: true, lastName: true, username: true } }, assignedAgent: { select: { id: true, firstName: true, lastName: true } } },
      });
      res.json({ tickets });
    } catch (e) { next(e); }
  },

  /** Everything an agent needs about one customer, in one call. */
  async supportContext(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.params.userId;
      const support = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
      const [user, messages, failed, refunds, kyc, remittances, withdrawals, deposits, tickets] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, username: true, status: true, kycStatus: true, kycTier: true, createdAt: true, country: true } }),
        support ? prisma.message.findMany({ where: { OR: [{ senderId: userId, receiverId: support.id }, { senderId: support.id, receiverId: userId }] }, orderBy: { createdAt: 'desc' }, take: 50 }) : [],
        prisma.remittanceTransfer.findMany({ where: { userId, state: { in: ['FAILED', 'REFUND_PENDING', 'REJECTED', 'DISPUTED', 'MANUAL_REVIEW'] } }, take: 20, orderBy: { createdAt: 'desc' } }),
        prisma.remittanceRefund.findMany({ where: { transfer: { userId } }, take: 20, orderBy: { createdAt: 'desc' } }),
        prisma.kYCDocument.findMany({ where: { userId }, select: { documentType: true, status: true, rejectionReason: true, createdAt: true } }),
        prisma.remittanceTransfer.findMany({ where: { userId }, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, state: true, sendAmount: true, sourceCurrency: true, receiveAmount: true, destCurrency: true, createdAt: true } }),
        prisma.withdrawal.findMany({ where: { userId }, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, status: true, amount: true, currency: true, createdAt: true, adminNotes: true } }),
        prisma.deposit.findMany({ where: { userId }, take: 10, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, status: true, amount: true, currency: true, createdAt: true, adminNotes: true } }),
        prisma.supportEscalation.findMany({ where: { raisedById: userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      ]);
      if (!user) throw new AppError('Customer not found', 404);
      res.json({ user, messages: [...messages].reverse(), problems: { failedRemittances: failed, refunds, kyc }, recent: { remittances, withdrawals, deposits }, tickets });
    } catch (e) { next(e); }
  },

  // ── Businesses (KYB) ───────────────────────────────────────────────
  async businesses(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req);
      const where: Prisma.BusinessProfileWhereInput = {};
      if (req.query.kyb) where.kybStatus = String(req.query.kyb) as any;
      if (req.query.q) where.OR = [{ companyName: { contains: String(req.query.q), mode: 'insensitive' } }, { registrationNo: String(req.query.q) }];
      const [items, total] = await Promise.all([
        prisma.businessProfile.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, email: true, status: true } }, _count: { select: { team: true, payouts: true, apiKeys: true, webhooks: true } } } }),
        prisma.businessProfile.count({ where }),
      ]);
      res.json({ items, total, page, limit });
    } catch (e) { next(e); }
  },

  async businessDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const b = await prisma.businessProfile.findUnique({
        where: { id: req.params.id },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, status: true, kycStatus: true } },
          team: true, payoutBatches: { orderBy: { createdAt: 'desc' }, take: 20, include: { payouts: { select: { id: true, reference: true, recipientHandle: true, amount: true, currency: true, status: true, riskOutcome: true } } } }, payouts: { orderBy: { createdAt: 'desc' }, take: 50 },
          webhooks: { select: { id: true, url: true, events: true, status: true, createdAt: true } },
          apiKeys: { select: { id: true, name: true, prefix: true, permissions: true, isActive: true, lastUsedAt: true, usageCount: true, createdAt: true } },
        },
      });
      if (!b) throw new AppError('Business not found', 404);
      // Business actions are audited against the batch, payout, key, webhook or member they touch.
      const relatedIds = [b.id, b.userId, ...b.payoutBatches.map((x) => x.id), ...b.payouts.map((x) => x.id), ...b.apiKeys.map((x) => x.id), ...b.webhooks.map((x) => x.id), ...b.team.map((x) => x.id)];
      const [wallets, audit, cases] = await Promise.all([
        prisma.wallet.findMany({ where: { userId: b.userId } }),
        prisma.auditLog.findMany({ where: { entityId: { in: relatedIds } }, orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.complianceCase.findMany({ where: { OR: [{ subjectBusinessId: b.id }, { subjectUserId: b.userId }] }, take: 20 }),
      ]);
      res.json({ business: b, wallets, audit, cases });
    } catch (e) { next(e); }
  },

  /** Release or reject a business payout batch held for compliance review. */
  async batchReview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ approve: z.boolean(), note: z.string().trim().min(5).max(2000) }).parse(req.body);
      const batch = await prisma.businessPayoutBatch.findUnique({ where: { id: req.params.id }, select: { business: { select: { userId: true } } } });
      assertNotSelf(req.user!.id, [batch?.business.userId], 'batch_compliance_review', { ipAddress: req.ip, path: req.originalUrl });
      res.json({ batch: await complianceDecideBatch(req.params.id, body.approve, req.user!.id, body.note, req) });
    } catch (e) { next(e); }
  },

  async kybDecision(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), note: z.string().trim().min(5).max(2000) }).parse(req.body);
      const b = await prisma.businessProfile.findUnique({ where: { id: req.params.id } });
      if (!b) throw new AppError('Business not found', 404);
      assertNotSelf(req.user!.id, [b.userId], 'kyb_decision', { ipAddress: req.ip, path: req.originalUrl });
      const updated = await prisma.businessProfile.update({ where: { id: b.id }, data: { kybStatus: body.decision, kybNotes: body.note, kybReviewedAt: new Date(), kybReviewedBy: req.user!.id } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'KYB_DECISION', entity: 'BusinessProfile', entityId: b.id, before: { kybStatus: b.kybStatus }, after: { kybStatus: body.decision }, reason: body.note, req });
      await prisma.notification.create({ data: { userId: b.userId, title: body.decision === 'APPROVED' ? 'Business verified' : 'Business verification declined', message: body.decision === 'APPROVED' ? `${b.companyName} is verified. Business payouts are now available.` : `We could not verify ${b.companyName}: ${body.note}`, type: 'kyc' } });
      res.json({ business: updated });
    } catch (e) { next(e); }
  },
};
