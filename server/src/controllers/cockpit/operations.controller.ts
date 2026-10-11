/**
 * Cockpit: universal search, transactions, ledger, controls, approvals,
 * audit, security operations and staff roles.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { Prisma, StaffRole } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { setControl, listControls, CONTROL_FEATURES } from '../../services/platform/controls.service';
import { listApprovals, requestApproval, decideApproval, type ApprovalType } from '../../services/platform/approvals.service';
import { invalidateStaffCache, ROLE_PERMISSIONS, PERMISSIONS } from '../../services/platform/rbac';
import { writeAudit } from '../../services/platform/audit';
import { recordSecurityEvent } from '../../services/platform/securityEvents';
import { FUND_CLASS } from '../../services/ledger/ledger.service';
import { pageParams, usdConverter } from './helpers';

interface SearchHit { kind: string; id: string; title: string; subtitle?: string; href: string }

export const CockpitOperationsController = {
  /** One box → the right entity. Exact identifiers first, then fuzzy name/email. */
  async search(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const q = String(req.query.q ?? '').trim();
      if (q.length < 2) return res.json({ results: [] });
      const like = { contains: q, mode: 'insensitive' as const };
      const handle = q.replace(/^@/, '');
      const [users, businesses, txs, deposits, withdrawals, transfers, remittances, claims, cards, wallets, onchain, beneficiaries, escalations, logins, devices, audits, cases] = await Promise.all([
        prisma.user.findMany({ where: { OR: [{ id: q }, { email: like }, { username: { contains: handle, mode: 'insensitive' } }, { phone: { contains: q } }, { firstName: like }, { lastName: like }] }, take: 8, select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true, accountType: true } }),
        prisma.businessProfile.findMany({ where: { OR: [{ id: q }, { companyName: like }, { legalName: like }, { registrationNo: q }] }, take: 5, select: { id: true, userId: true, companyName: true, country: true } }),
        prisma.transaction.findMany({ where: { OR: [{ id: q }, { reference: q }] }, take: 5, select: { id: true, reference: true, type: true, currency: true, amount: true, userId: true } }),
        prisma.deposit.findMany({ where: { OR: [{ id: q }, { reference: q }] }, take: 5, select: { id: true, reference: true, currency: true, amount: true, status: true } }),
        prisma.withdrawal.findMany({ where: { OR: [{ id: q }, { reference: q }, { walletAddress: q }] }, take: 5, select: { id: true, reference: true, currency: true, amount: true, status: true } }),
        prisma.transfer.findMany({ where: { OR: [{ id: q }, { reference: q }] }, take: 5, select: { id: true, reference: true, currency: true, amount: true } }),
        prisma.remittanceTransfer.findMany({ where: { OR: [{ id: q }, { reference: q }, { providerRef: q }] }, take: 5, select: { id: true, reference: true, state: true, sendAmount: true, sourceCurrency: true } }),
        prisma.claimLink.findMany({ where: { OR: [{ id: q }, { claimToken: { startsWith: q } }] }, take: 3, select: { id: true, asset: true, amount: true, status: true } }),
        prisma.card.findMany({ where: { OR: [{ id: q }, { externalCardId: q }] }, take: 3, select: { id: true, last4: true, userId: true, status: true } }),
        prisma.userWallet.findMany({ where: { OR: [{ ethAddress: q }, { btcAddress: q }, { solAddress: q }, { tronAddress: q }] }, take: 3, select: { userId: true, ethAddress: true } }),
        prisma.onChainTransaction.findMany({ where: { OR: [{ txHash: q }, { toAddress: q }, { fromAddress: q }] }, take: 5, select: { id: true, txHash: true, asset: true, amount: true, userId: true, type: true } }),
        prisma.remittanceBeneficiary.findMany({ where: { OR: [{ id: q }, { fullName: like }, { accountNumber: q }, { iban: q }] }, take: 5, select: { id: true, fullName: true, country: true, userId: true } }),
        prisma.supportEscalation.findMany({ where: { id: q }, take: 3, select: { id: true, reason: true, status: true, raisedById: true } }),
        prisma.loginHistory.findMany({ where: { ipAddress: q }, take: 5, distinct: ['userId'], select: { userId: true, ipAddress: true, createdAt: true } }),
        prisma.knownDevice.findMany({ where: { OR: [{ id: q }, { fingerprint: { startsWith: q } }, { ipAddress: q }] }, take: 5, select: { id: true, userId: true, label: true } }),
        prisma.auditLog.findMany({ where: { OR: [{ id: q }, { entityId: q }] }, take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, entity: true, entityId: true } }),
        prisma.complianceCase.findMany({ where: { OR: [{ id: q }, { reference: q }] }, take: 3, select: { id: true, reference: true, title: true, status: true } }),
      ]);
      const results: SearchHit[] = [
        ...users.map((u) => ({ kind: u.role === 'ADMIN' ? 'staff' : 'customer', id: u.id, title: `${u.firstName} ${u.lastName}`, subtitle: `@${u.username ?? '—'} · ${u.accountType}`, href: `/admin/customers/${u.id}` })),
        ...businesses.map((b) => ({ kind: 'business', id: b.id, title: b.companyName, subtitle: b.country, href: `/admin/customers/${b.userId}` })),
        ...remittances.map((r) => ({ kind: 'remittance', id: r.id, title: r.reference, subtitle: `${r.sendAmount} ${r.sourceCurrency} · ${r.state}`, href: `/admin/remittance/${r.id}` })),
        ...txs.map((t) => ({ kind: 'transaction', id: t.id, title: t.reference ?? t.id, subtitle: `${t.type} ${t.amount} ${t.currency}`, href: `/admin/transactions/transaction/${t.id}` })),
        ...deposits.map((d) => ({ kind: 'deposit', id: d.id, title: d.reference, subtitle: `${d.amount} ${d.currency} · ${d.status}`, href: `/admin/transactions/deposit/${d.id}` })),
        ...withdrawals.map((w) => ({ kind: 'withdrawal', id: w.id, title: w.reference, subtitle: `${w.amount} ${w.currency} · ${w.status}`, href: `/admin/transactions/withdrawal/${w.id}` })),
        ...transfers.map((t) => ({ kind: 'transfer', id: t.id, title: t.reference, subtitle: `${t.amount} ${t.currency}`, href: `/admin/transactions/transfer/${t.id}` })),
        ...claims.map((c) => ({ kind: 'claim_link', id: c.id, title: `Claim link ${c.id.slice(0, 10)}`, subtitle: `${c.amount} ${c.asset} · ${c.status}`, href: `/admin/transactions/claim_link/${c.id}` })),
        ...cards.map((c) => ({ kind: 'card', id: c.id, title: `Card •••• ${c.last4}`, subtitle: c.status, href: `/admin/customers/${c.userId}` })),
        ...wallets.map((w) => ({ kind: 'address', id: w.userId, title: 'Custody address owner', subtitle: q, href: `/admin/customers/${w.userId}` })),
        ...onchain.map((o) => ({ kind: 'onchain', id: o.id, title: o.txHash ?? o.id, subtitle: `${o.type} ${o.amount} ${o.asset}`, href: `/admin/customers/${o.userId}` })),
        ...beneficiaries.map((b) => ({ kind: 'beneficiary', id: b.id, title: b.fullName, subtitle: b.country, href: `/admin/customers/${b.userId}` })),
        ...escalations.map((e) => ({ kind: 'ticket', id: e.id, title: `Ticket ${e.id.slice(0, 8)}`, subtitle: `${e.status} · ${e.reason.slice(0, 60)}`, href: `/admin/support?ticket=${e.id}` })),
        ...logins.map((l) => ({ kind: 'ip', id: l.userId, title: `IP ${l.ipAddress}`, subtitle: `last seen ${l.createdAt.toISOString().slice(0, 10)}`, href: `/admin/customers/${l.userId}` })),
        ...devices.map((d) => ({ kind: 'device', id: d.id, title: d.label ?? 'Device', subtitle: d.id, href: `/admin/customers/${d.userId}` })),
        ...cases.map((c) => ({ kind: 'case', id: c.id, title: c.reference, subtitle: `${c.status} · ${c.title}`, href: `/admin/compliance/${c.id}` })),
        ...audits.map((a) => ({ kind: 'audit', id: a.id, title: a.action, subtitle: `${a.entity} ${a.entityId ?? ''}`, href: `/admin/audit?q=${encodeURIComponent(a.entityId ?? a.id)}` })),
      ];
      res.json({ results: results.slice(0, 50) });
    } catch (e) { next(e); }
  },

  /** Customer-facing history rows across the platform (filterable). */
  async transactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req);
      const where: Prisma.TransactionWhereInput = {};
      if (req.query.type) where.type = String(req.query.type) as any;
      if (req.query.currency) where.currency = String(req.query.currency) as any;
      if (req.query.userId) where.userId = String(req.query.userId);
      if (req.query.q) where.OR = [{ reference: String(req.query.q) }, { description: { contains: String(req.query.q), mode: 'insensitive' } }];
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
      const [items, total] = await Promise.all([
        prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { user: { select: { id: true, username: true, firstName: true, lastName: true } } } }),
        prisma.transaction.count({ where }),
      ]);
      res.json({ items, total, page, limit });
    } catch (e) { next(e); }
  },

  /** Full investigation view of one money movement. */
  async transactionDetail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { kind, id } = req.params;
      let record: any = null;
      let refs: string[] = [id];
      let entityType = kind.toUpperCase();
      switch (kind) {
        case 'transaction':
          record = await prisma.transaction.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, email: true } } } });
          if (record?.reference) refs.push(record.reference);
          break;
        case 'deposit':
          record = await prisma.deposit.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, email: true } } } });
          if (record) refs.push(record.reference);
          break;
        case 'withdrawal':
          record = await prisma.withdrawal.findUnique({ where: { id }, include: { user: { select: { id: true, username: true, email: true } }, approvals: true, onChainTxs: true } });
          if (record) refs.push(record.reference);
          break;
        case 'transfer':
          record = await prisma.transfer.findUnique({ where: { id }, include: { sender: { select: { id: true, username: true } }, receiver: { select: { id: true, username: true } } } });
          if (record) refs.push(record.reference);
          break;
        case 'claim_link':
          record = await prisma.claimLink.findUnique({ where: { id }, select: { id: true, senderId: true, claimedById: true, asset: true, amount: true, status: true, createdAt: true, expiresAt: true, claimedAt: true, refundedAt: true, recipientEmail: true, recipientHandle: true } });
          break;
        case 'p2p_trade':
          record = await prisma.p2PTrade.findUnique({ where: { id }, include: { disputes: true } });
          if (record) refs.push(record.reference, record.listingId);
          entityType = 'P2P_TRADE';
          break;
        case 'order':
          record = await prisma.cryptoOrder.findUnique({ where: { id } });
          break;
        default:
          throw new AppError('Unknown kind', 400);
      }
      if (!record) throw new AppError('Not found', 404);
      refs = [...new Set(refs.filter(Boolean))];
      const [ledger, transitions, audit, approvals] = await Promise.all([
        prisma.ledgerEntry.findMany({ where: { refId: { in: refs } }, orderBy: { createdAt: 'asc' }, include: { account: { select: { type: true, userId: true, currency: true } } } }),
        prisma.stateTransition.findMany({ where: { entityId: { in: refs } }, orderBy: { createdAt: 'asc' } }),
        prisma.auditLog.findMany({ where: { entityId: { in: refs } }, orderBy: { createdAt: 'asc' } }),
        prisma.approvalRequest.findMany({ where: { subjectId: { in: refs } } }),
      ]);
      const groups = new Map<string, any[]>();
      for (const e of ledger) {
        if (!groups.has(e.groupId)) groups.set(e.groupId, []);
        groups.get(e.groupId)!.push({ ...e, fundClass: FUND_CLASS[e.account.type] });
      }
      res.json({
        kind, entityType, record,
        ledgerGroups: [...groups.entries()].map(([groupId, entries]) => ({ groupId, refType: entries[0].refType, createdAt: entries[0].createdAt, entries })),
        transitions, audit, approvals,
      });
    } catch (e) { next(e); }
  },

  /** Ledger position by account type, currency and fund class. */
  async ledgerSummary(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const usd = usdConverter();
      const rows = await prisma.ledgerAccount.groupBy({ by: ['type', 'currency'], _sum: { balance: true }, _count: true });
      const conservation = await prisma.ledgerEntry.groupBy({ by: ['currency'], _sum: { amount: true } });
      const out = await Promise.all(rows.map(async (r) => ({
        type: r.type, currency: r.currency, fundClass: FUND_CLASS[r.type], accounts: r._count,
        balance: r._sum.balance?.toString() ?? '0',
        usd: Math.round(Number(r._sum.balance ?? 0) * (await usd.rate(r.currency)) * 100) / 100,
      })));
      res.json({
        accounts: out.sort((a, b) => a.fundClass.localeCompare(b.fundClass) || a.type.localeCompare(b.type) || a.currency.localeCompare(b.currency)),
        conservation: conservation.map((c) => ({ currency: c.currency, sum: c._sum.amount?.toString() ?? '0', balanced: Math.abs(Number(c._sum.amount ?? 0)) < 1e-6 })),
      });
    } catch (e) { next(e); }
  },

  async ledgerEntries(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req, 200);
      const where: Prisma.LedgerEntryWhereInput = {};
      if (req.query.accountId) where.accountId = String(req.query.accountId);
      if (req.query.groupId) where.groupId = String(req.query.groupId);
      if (req.query.refId) where.refId = String(req.query.refId);
      if (req.query.refType) where.refType = String(req.query.refType);
      if (req.query.userId) where.account = { userId: String(req.query.userId) };
      const [items, total] = await Promise.all([
        prisma.ledgerEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit, include: { account: { select: { type: true, userId: true, currency: true } } } }),
        prisma.ledgerEntry.count({ where }),
      ]);
      res.json({ items: items.map((e) => ({ ...e, fundClass: FUND_CLASS[e.account.type] })), total, page, limit });
    } catch (e) { next(e); }
  },

  // ── Controls ───────────────────────────────────────────────────────
  async controls(_req: AuthRequest, res: Response, next: NextFunction) {
    try { res.json(await listControls()); } catch (e) { next(e); }
  },

  async setControl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        scope: z.enum(['FEATURE', 'CORRIDOR', 'PROVIDER', 'USER', 'WALLET']),
        key: z.string().trim().min(1).max(200),
        blocked: z.boolean(),
        reason: z.string().trim().min(5).max(1000),
        expiresAt: z.coerce.date().optional().nullable(),
      }).parse(req.body);
      const sw = await setControl({ ...body, expiresAt: body.expiresAt ?? null, actorId: req.user!.id, req });
      res.json({ control: sw, features: CONTROL_FEATURES });
    } catch (e) { next(e); }
  },

  // ── Approvals (maker-checker) ──────────────────────────────────────
  async approvals(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = await listApprovals({ status: req.query.status ? String(req.query.status) : undefined, type: req.query.type ? String(req.query.type) : undefined });
      const ids = [...new Set(items.flatMap((i) => [i.requestedById, i.decidedById].filter(Boolean) as string[]))];
      const people = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, email: true } });
      res.json({ items, people });
    } catch (e) { next(e); }
  },

  async requestApproval(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        type: z.enum(['LEDGER_ADJUSTMENT', 'REMITTANCE_REFUND', 'FX_OVERRIDE']),
        payload: z.record(z.unknown()),
        reason: z.string().trim().min(10).max(2000),
        subjectType: z.string().max(40).optional(),
        subjectId: z.string().max(80).optional(),
      }).parse(req.body);
      const row = await requestApproval({ ...body, type: body.type as ApprovalType, requestedById: req.user!.id, permissions: req.staff!.permissions, req });
      res.status(201).json({ approval: row });
    } catch (e) { next(e); }
  },

  async decideApproval(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({ approve: z.boolean(), note: z.string().trim().max(2000).optional() }).parse(req.body);
      const row = await decideApproval({ id: req.params.id, approve: body.approve, note: body.note, deciderId: req.user!.id, permissions: req.staff!.permissions, req });
      res.json({ approval: row });
    } catch (e) { next(e); }
  },

  // ── Audit ──────────────────────────────────────────────────────────
  async audit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req, 200);
      const where: Prisma.AuditLogWhereInput = {};
      if (req.query.actorId) where.userId = String(req.query.actorId);
      if (req.query.action) where.action = String(req.query.action);
      if (req.query.entity) where.entity = String(req.query.entity);
      if (req.query.q) {
        const q = String(req.query.q);
        where.OR = [{ entityId: q }, { action: { contains: q, mode: 'insensitive' } }, { entity: { contains: q, mode: 'insensitive' } }, { userId: q }, { ipAddress: q }];
      }
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) };
      const [items, total, actions] = await Promise.all([
        prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.groupBy({ by: ['action'], _count: true, orderBy: { _count: { action: 'desc' } }, take: 60 }),
      ]);
      const actorIds = [...new Set(items.map((i) => i.userId).filter(Boolean) as string[])];
      const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true, email: true, role: true } });
      res.json({ items, total, page, limit, actors, actions: actions.map((a) => ({ action: a.action, count: a._count })) });
    } catch (e) { next(e); }
  },

  // ── Security operations ────────────────────────────────────────────
  async security(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const since = new Date(Date.now() - 7 * 86400_000);
      const { page, limit, skip } = pageParams(req, 200);
      const where: Prisma.SecurityEventWhereInput = { createdAt: { gte: since } };
      if (req.query.type) where.type = String(req.query.type);
      const [byType, events, total, adminLogins, lockedAccounts, newDevices, staffWithout2fa, permissionChanges] = await Promise.all([
        prisma.securityEvent.groupBy({ by: ['type', 'severity'], where: { createdAt: { gte: since } }, _count: true }),
        prisma.securityEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.securityEvent.count({ where }),
        prisma.securityEvent.findMany({ where: { type: 'ADMIN_LOGIN', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.user.count({ where: { lockoutUntil: { gt: new Date() } } }),
        prisma.knownDevice.count({ where: { createdAt: { gte: since } } }),
        prisma.user.findMany({ where: { role: 'ADMIN', twoFactorEnabled: false, status: 'ACTIVE', username: { notIn: ['platform', 'support'] } }, select: { id: true, email: true } }),
        prisma.auditLog.findMany({ where: { action: 'STAFF_ROLES_CHANGED', createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      ]);
      const config = [
        { check: 'Staff 2FA enforced in production', ok: process.env.ADMIN_REQUIRE_2FA !== '0' },
        { check: 'Admin IP allowlist configured', ok: Boolean(process.env.ADMIN_IP_ALLOWLIST?.trim()) },
        { check: 'Master seed protected by KMS', ok: Boolean(process.env.MASTER_SEED_KMS_KEY_ID) },
        { check: 'Redis configured (shared rate limits, instant revocation)', ok: Boolean(process.env.REDIS_URL) },
        { check: 'Error monitoring (Sentry) configured', ok: Boolean(process.env.SENTRY_DSN) },
        { check: 'Offsite backups configured', ok: Boolean(process.env.BACKUP_S3_URI) },
        { check: 'Deposit webhook secret set', ok: Boolean(process.env.DEPOSIT_WEBHOOK_SECRET) },
      ];
      res.json({
        summary: byType.map((b) => ({ type: b.type, severity: b.severity, count: b._count })),
        events, total, page, limit, adminLogins, lockedAccounts, newDevices7d: newDevices,
        staffWithout2fa, permissionChanges, configuration: config,
      });
    } catch (e) { next(e); }
  },

  // ── Staff & roles ──────────────────────────────────────────────────
  async staff(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const staff = await prisma.user.findMany({
        where: { role: 'ADMIN', username: { notIn: ['platform', 'support'] } },
        select: { id: true, email: true, firstName: true, lastName: true, staffRoles: true, status: true, twoFactorEnabled: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ staff, roles: ROLE_PERMISSIONS, permissions: PERMISSIONS });
    } catch (e) { next(e); }
  },

  async setStaffRoles(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        roles: z.array(z.enum(['SUPER_ADMIN', 'EXECUTIVE', 'OPERATIONS', 'FINANCE', 'TREASURY', 'COMPLIANCE', 'AML_ANALYST', 'FRAUD_ANALYST', 'SUPPORT', 'SECURITY', 'TECH_OPS', 'AUDITOR'])).min(1),
        reason: z.string().trim().min(5).max(1000),
      }).parse(req.body);
      const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, staffRoles: true } });
      if (!target || target.role !== 'ADMIN') throw new AppError('Staff member not found', 404);
      // Keep at least one explicit SUPER_ADMIN once roles are in use.
      if (!body.roles.includes('SUPER_ADMIN') && (target.staffRoles.includes('SUPER_ADMIN') || target.staffRoles.length === 0)) {
        const others = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE', id: { not: target.id }, staffRoles: { has: 'SUPER_ADMIN' } } });
        if (others === 0) throw new AppError('At least one other active staff member must hold SUPER_ADMIN first', 409);
      }
      const updated = await prisma.user.update({ where: { id: target.id }, data: { staffRoles: body.roles as StaffRole[] }, select: { id: true, staffRoles: true } });
      invalidateStaffCache(target.id);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'STAFF_ROLES_CHANGED', entity: 'User', entityId: target.id, before: { staffRoles: target.staffRoles }, after: { staffRoles: body.roles }, reason: body.reason, req });
      void recordSecurityEvent({ type: 'PERMISSION_CHANGE', severity: 'HIGH', userId: req.user!.id, ipAddress: req.ip, details: { target: target.id, from: target.staffRoles, to: body.roles } });
      res.json({ staff: updated });
    } catch (e) { next(e); }
  },
};
