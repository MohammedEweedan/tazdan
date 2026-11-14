/**
 * Cockpit: customer search, Customer 360 and permission-controlled actions.
 * Contact details are masked unless the operator holds customers.pii.
 */
import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import type { AuthRequest } from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { hasPermission } from '../../services/platform/rbac';
import { setControl, CONTROL_FEATURES } from '../../services/platform/controls.service';
import { writeAudit } from '../../services/platform/audit';
import { revokeAllUserSessions } from '../../middleware/auth';
import { recordSecurityEvent } from '../../services/platform/securityEvents';
import { getKycHeadroom } from '../../utils/kycLimits';
import { openCase } from '../../services/compliance/cases.service';
import { maskEmail, maskPhone, pageParams, systemUserIds } from './helpers';
import { assertNotSelf } from '../../services/platform/segregation';

const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export const CockpitCustomersController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageParams(req);
      const q = String(req.query.q ?? '').trim();
      const exclude = await systemUserIds();
      const where: Prisma.UserWhereInput = { id: { notIn: exclude }, role: 'USER' };
      if (q) {
        // Contact-detail matching only for staff who may see contact details;
        // otherwise the search recovers a masked email/phone one guess at a time.
        const pii = hasPermission(req, 'customers.pii');
        where.OR = [
          ...(pii ? [{ email: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }] : []),
          { username: { contains: q.replace(/^@/, ''), mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { id: q },
        ];
      }
      if (req.query.status) where.status = String(req.query.status) as any;
      if (req.query.kyc) where.kycStatus = String(req.query.kyc) as any;
      if (req.query.accountType) where.accountType = String(req.query.accountType) as any;

      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          select: {
            id: true, email: true, phone: true, firstName: true, lastName: true, username: true, country: true,
            status: true, kycStatus: true, kycTier: true, accountType: true, createdAt: true, lastLoginAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);
      const pii = hasPermission(req, 'customers.pii');
      res.json({
        items: rows.map((r) => ({ ...r, email: pii ? r.email : maskEmail(r.email), phone: pii ? r.phone : maskPhone(r.phone) })),
        total, page, limit,
      });
    } catch (e) { next(e); }
  },

  async detail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true, email: true, phone: true, firstName: true, lastName: true, username: true, country: true,
          dateOfBirth: true, status: true, role: true, accountType: true, kycStatus: true, kycTier: true,
          emailVerified: true, phoneVerified: true, twoFactorEnabled: true, createdAt: true, lastLoginAt: true,
          lastLoginIp: true, failedLoginAttempts: true, lockoutUntil: true, referralCode: true, baseCurrency: true,
          businessProfile: true,
        },
      });
      if (!user) throw new AppError('Customer not found', 404);

      const since90 = new Date(Date.now() - 90 * 86400_000);
      const [
        wallets, cryptoWallet, ledgerAccounts, kycDocs, devices, sessions, logins, securityEvents,
        transactions, deposits, withdrawals, transfersOut, transfersIn, p2pTrades, claimLinks, cards,
        remittances, beneficiaries, escalations, amlFlags, cases, riskDecisions, riskEvents, controls, audit, screening,
      ] = await Promise.all([
        prisma.wallet.findMany({ where: { userId: id }, orderBy: { currency: 'asc' } }),
        prisma.userWallet.findUnique({ where: { userId: id }, select: { ethAddress: true, btcAddress: true, solAddress: true, tronAddress: true, ethBalance: true, btcBalance: true, solBalance: true, usdtErc20Bal: true, usdtTrc20Bal: true, altBalances: true, selfCustodyExported: true } }),
        prisma.ledgerAccount.findMany({ where: { userId: id }, select: { id: true, type: true, currency: true, balance: true } }),
        prisma.kYCDocument.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
        prisma.knownDevice.findMany({ where: { userId: id }, orderBy: { lastSeenAt: 'desc' } }),
        prisma.refreshToken.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } }),
        prisma.loginHistory.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
        prisma.securityEvent.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
        prisma.transaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
        prisma.deposit.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.withdrawal.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.transfer.findMany({ where: { senderId: id }, orderBy: { createdAt: 'desc' }, take: 20, include: { receiver: { select: { id: true, username: true } } } }),
        prisma.transfer.findMany({ where: { receiverId: id }, orderBy: { createdAt: 'desc' }, take: 20, include: { sender: { select: { id: true, username: true } } } }),
        prisma.p2PTrade.findMany({ where: { OR: [{ buyerId: id }, { sellerId: id }] }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.claimLink.findMany({ where: { senderId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, asset: true, amount: true, status: true, createdAt: true, expiresAt: true, claimedById: true } }),
        prisma.card.findMany({ where: { userId: id }, select: { id: true, tier: true, status: true, last4: true, issuerName: true, frozen: true, currency: true, createdAt: true } }),
        prisma.remittanceTransfer.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20, include: { corridor: { select: { code: true } } } }),
        prisma.remittanceBeneficiary.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' } }),
        prisma.supportEscalation.findMany({ where: { OR: [{ raisedById: id }, { counterpartyId: id }] }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.aMLFlag.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.complianceCase.findMany({ where: { subjectUserId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.riskDecision.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
        prisma.riskEvent.findMany({ where: { userId: id, createdAt: { gte: since90 } }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.controlSwitch.findMany({ where: { scope: { in: ['USER', 'WALLET'] }, key: { startsWith: id } } }),
        prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: 'desc' }, take: 30 }),
        prisma.screeningResult.findMany({ where: { userId: id }, orderBy: { screenedAt: 'desc' }, take: 10 }),
      ]);
      const headroom = await getKycHeadroom(id).catch(() => null);
      const pii = hasPermission(req, 'customers.pii');
      const riskScore = riskDecisions[0]?.score ?? null;

      res.json({
        identity: {
          ...user,
          email: pii ? user.email : maskEmail(user.email),
          phone: pii ? user.phone : maskPhone(user.phone),
          dateOfBirth: pii ? user.dateOfBirth : null,
          lastLoginIp: pii ? user.lastLoginIp : null,
        },
        piiVisible: pii,
        risk: {
          latestScore: riskScore,
          latestOutcome: riskDecisions[0]?.outcome ?? null,
          decisions: riskDecisions,
          events: riskEvents,
          amlFlags,
          cases,
          screening,
        },
        controls,
        limits: headroom,
        security: { devices, sessions, logins, events: securityEvents },
        balances: { wallets, cryptoWallet, ledgerAccounts },
        kycDocuments: kycDocs.map((d) => ({ ...d, documentUrl: pii ? d.documentUrl : null })),
        activity: { transactions, deposits, withdrawals, transfersOut, transfersIn, p2pTrades, claimLinks, cards, remittances, beneficiaries },
        support: { escalations },
        audit,
      });
    } catch (e) { next(e); }
  },

  async freeze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = reasonSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, role: true, status: true } });
      if (!user) throw new AppError('Customer not found', 404);
      if (user.role === 'ADMIN') throw new AppError('Staff accounts are managed in Staff & roles', 400);
      await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
      await revokeAllUserSessions(user.id);
      await setControl({ scope: 'USER', key: user.id, blocked: true, reason: `Account frozen: ${reason}`, actorId: req.user!.id, req });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'FREEZE_USER', entity: 'User', entityId: user.id, before: { status: user.status }, after: { status: 'SUSPENDED' }, reason, req });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async unfreeze(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = reasonSchema.parse(req.body);
      assertNotSelf(req.user!.id, [req.params.id], 'unfreeze_customer', { ipAddress: req.ip, path: req.originalUrl });
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
      if (!user) throw new AppError('Customer not found', 404);
      await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
      await setControl({ scope: 'USER', key: user.id, blocked: false, reason, actorId: req.user!.id, req });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'UNFREEZE_USER', entity: 'User', entityId: user.id, before: { status: user.status }, after: { status: 'ACTIVE' }, reason, req });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  /** Block or allow one feature (withdrawals, remittance, …) for this customer. */
  async restrict(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        feature: z.enum(CONTROL_FEATURES),
        blocked: z.boolean(),
        reason: z.string().trim().min(5).max(1000),
        expiresAt: z.coerce.date().optional(),
      }).parse(req.body);
      assertNotSelf(req.user!.id, [req.params.id], 'customer_restriction', { ipAddress: req.ip, path: req.originalUrl });
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!user) throw new AppError('Customer not found', 404);
      const sw = await setControl({
        scope: 'USER', key: `${user.id}:${body.feature}`, blocked: body.blocked, reason: body.reason,
        actorId: req.user!.id, expiresAt: body.expiresAt ?? null, req,
      });
      res.json({ control: sw });
    } catch (e) { next(e); }
  },

  async revokeSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = reasonSchema.parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!user) throw new AppError('Customer not found', 404);
      await revokeAllUserSessions(user.id);
      await writeAudit(prisma, { actorId: req.user!.id, action: 'FORCE_LOGOUT', entity: 'User', entityId: user.id, reason, req });
      void recordSecurityEvent({ type: 'SESSION_REVOKED', severity: 'MEDIUM', userId: user.id, ipAddress: req.ip, details: { by: req.user!.id, scope: 'all' } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  async revokeDevice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = reasonSchema.parse(req.body);
      const device = await prisma.knownDevice.findFirst({ where: { id: req.params.deviceId, userId: req.params.id } });
      if (!device) throw new AppError('Device not found', 404);
      await prisma.knownDevice.delete({ where: { id: device.id } });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'REVOKE_TRUSTED_DEVICE', entity: 'KnownDevice', entityId: device.id, before: { label: device.label, fingerprint: device.fingerprint.slice(0, 8) }, reason, req });
      res.json({ ok: true });
    } catch (e) { next(e); }
  },

  /** Open a compliance case (KYC review, request information, escalation). */
  async openCase(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = z.object({
        type: z.enum(['KYC', 'KYB', 'AML', 'SANCTIONS', 'PEP', 'FRAUD', 'SOURCE_OF_FUNDS', 'SOURCE_OF_WEALTH', 'TRAVEL_RULE', 'OTHER']),
        title: z.string().trim().min(5).max(200),
        summary: z.string().trim().max(4000).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
      }).parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!user) throw new AppError('Customer not found', 404);
      const c = await openCase({
        type: body.type, title: body.title, summary: body.summary, priority: body.priority,
        subjectUserId: user.id, openedById: req.user!.id,
      });
      res.status(201).json({ case: c });
    } catch (e) { next(e); }
  },
};
