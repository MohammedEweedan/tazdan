/**
 * AdminExtrasController — admin visibility into every Prisma model that
 * wasn't yet reachable from the admin panel. Each list endpoint follows
 * the same `?page=&limit=` pattern as the existing admin endpoints and
 * returns `{ items, total, page, totalPages }`.
 *
 * Mounted under `/api/admin/*` by routes/admin.ts. All endpoints are
 * guarded by `authenticate + requireAdmin` at the router level.
 */
import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { assertTransitioned } from '../services/wallet/atomicWallet';
import { escrowState, releaseEscrowToBuyer, refundEscrowToSeller, clawBackFromBuyer } from '../services/p2p/escrow';
import { recordTransition } from '../services/platform/lifecycle';
import { writeAudit } from '../services/platform/audit';
import { AuthRequest } from '../types';
import { emitNotification } from '../utils/realtime';
import {
  getEmailStatus,
  sendWaitlistLaunchEmail,
  sendWaitlistConfirmation,
  emailErrorSummary,
} from '../services/email';

function pageLimit(req: AuthRequest): { page: number; limit: number; skip: number } {
  const page  = Math.max(1, parseInt(String(req.query.page ?? '1'),  10) || 1);
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10) || 20);
  return { page, limit, skip: (page - 1) * limit };
}

function packPage<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

const bankSchema = z.object({
  currency:      z.string().min(2).max(8),
  country:       z.string().length(2),
  bankName:      z.string().min(1).max(120),
  accountName:   z.string().min(1).max(120),
  accountNumber: z.string().optional(),
  iban:          z.string().optional(),
  swift:         z.string().optional(),
  sortCode:      z.string().optional(),
  routingNumber: z.string().optional(),
  branch:        z.string().optional(),
  memo:          z.string().optional(),
  isActive:      z.boolean().default(true),
});

async function changeDepositAccountFor(req: AuthRequest, id: string | null, data: Record<string, unknown>, reason?: string) {
  const { changeDepositAccount } = await import('../services/platform/depositAccounts.service');
  const { loadStaffContext } = await import('../services/platform/rbac');
  const staff = await loadStaffContext(req.user!.id);
  if (!staff) throw new AppError('Staff access required', 403);
  return changeDepositAccount({ id, data: data as any, staffId: req.user!.id, permissions: staff.permissions, reason: reason?.trim() || (id ? 'Deposit account edited' : 'New deposit account'), req });
}

export class AdminExtrasController {
  // ── P2P ─────────────────────────────────────────────────────────
  static async listP2PListings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        (prisma as any).p2PListing.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        (prisma as any).p2PListing.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listP2PTrades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        (prisma as any).p2PTrade.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: {
            buyer:  { select: { id: true, email: true, username: true } },
            seller: { select: { id: true, email: true, username: true } },
          },
        }),
        (prisma as any).p2PTrade.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listP2PDisputes(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        (prisma as any).p2PDispute.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).p2PDispute.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  /**
   * Decide a P2P dispute and settle the escrow accordingly.
   *   outcome BUYER  → escrow released to the buyer; trade COMPLETED
   *   outcome SELLER → escrow refunded to the seller (or, if it had already
   *                    been released, clawed back from the buyer); trade CANCELLED
   * The decision is a conditional transition on both dispute and trade, so a
   * double submit cannot move money twice.
   */
  static async resolveP2PDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const body = z.object({
        resolution: z.string().trim().min(5).max(2000),
        outcome: z.enum(['BUYER', 'SELLER']).optional(),
        status: z.string().optional(), // accepted for older clients; ignored
      }).parse(req.body);
      if (!body.outcome) {
        throw new AppError('Choose who the dispute is decided for: outcome BUYER (release escrow) or SELLER (refund seller).', 400);
      }
      const outcome = body.outcome;
      const actorId = req.user!.id;

      const result = await prisma.$transaction(async (tx) => {
        const dispute = await tx.p2PDispute.findUnique({ where: { id }, include: { trade: true } });
        if (!dispute) throw new AppError('Dispute not found', 404);
        if (!['OPEN', 'UNDER_REVIEW'].includes(dispute.status)) {
          throw new AppError(`Dispute is already ${dispute.status.toLowerCase()}`, 409);
        }
        const trade = dispute.trade;
        const movedTrade = await tx.p2PTrade.updateMany({
          where: { id: trade.id, status: 'DISPUTED' },
          data: outcome === 'BUYER'
            ? { status: 'COMPLETED', completedAt: new Date() }
            : { status: 'CANCELLED', cancelledAt: new Date() },
        });
        assertTransitioned(movedTrade, 'Trade is no longer in dispute');
        const movedDispute = await tx.p2PDispute.updateMany({
          where: { id, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
          data: {
            status: outcome === 'BUYER' ? 'RESOLVED_BUYER' : 'RESOLVED_SELLER',
            resolution: body.resolution,
            resolvedBy: actorId,
            resolvedAt: new Date(),
          },
        });
        assertTransitioned(movedDispute, 'Dispute was decided by someone else');

        const state = await escrowState(tx, trade);
        let money: string;
        if (outcome === 'BUYER') {
          if (state === 'HELD' || state === 'HELD_LEGACY') { await releaseEscrowToBuyer(tx, trade); money = 'ESCROW_RELEASED_TO_BUYER'; }
          else money = state === 'RELEASED' ? 'ALREADY_WITH_BUYER' : `NO_MOVEMENT_${state}`;
        } else {
          if (state === 'HELD' || state === 'HELD_LEGACY') { await refundEscrowToSeller(tx, trade); money = 'ESCROW_REFUNDED_TO_SELLER'; }
          else if (state === 'RELEASED') { await clawBackFromBuyer(tx, trade); money = 'CLAWED_BACK_FROM_BUYER'; }
          else money = `NO_MOVEMENT_${state}`;
        }
        // A trade that was cancelled returns its capacity to the listing.
        if (outcome === 'SELLER') {
          await tx.p2PListing.update({ where: { id: trade.listingId }, data: { filled: { decrement: trade.cryptoAmount } } });
        }

        await recordTransition(tx, {
          entityType: 'P2P_TRADE', entityId: trade.id, fromState: 'DISPUTED',
          toState: outcome === 'BUYER' ? 'COMPLETED' : 'CANCELLED', actorType: 'STAFF', actorId,
          reason: `Dispute ${id} decided for ${outcome}: ${body.resolution}`.slice(0, 1000),
        });
        await writeAudit(tx, {
          actorId, action: 'P2P_DISPUTE_RESOLVE', entity: 'P2PDispute', entityId: id,
          before: { disputeStatus: dispute.status, tradeStatus: trade.status, escrow: state },
          after: { outcome, money, tradeStatus: outcome === 'BUYER' ? 'COMPLETED' : 'CANCELLED' },
          reason: body.resolution, req,
        });
        return { tradeId: trade.id, buyerId: trade.buyerId, sellerId: trade.sellerId, money, reference: trade.reference };
      });

      await prisma.notification.createMany({
        data: [result.buyerId, result.sellerId].map((userId) => ({
          userId,
          title: 'P2P dispute decided',
          message: `Support has decided the dispute on trade ${result.reference} in favour of the ${outcome.toLowerCase()}.`,
          type: 'p2p',
        })),
      });
      const dispute = await prisma.p2PDispute.findUnique({ where: { id } });
      res.json({ dispute, outcome, money: result.money });
    } catch (e) { next(e); }
  }

  // ── Cards ───────────────────────────────────────────────────────
  static async listCards(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        prisma.card.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        prisma.card.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listCardTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const declined = req.query.declined as string | undefined;
      const where: any = {};
      if (declined === 'true')  where.declined = true;
      if (declined === 'false') where.declined = false;
      const [items, total] = await Promise.all([
        prisma.cardTransaction.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        prisma.cardTransaction.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── Messages & moderation ──────────────────────────────────────
  static async listMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        (prisma as any).message.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: {
            sender:   { select: { id: true, email: true, username: true } },
            receiver: { select: { id: true, email: true, username: true } },
          },
        }),
        (prisma as any).message.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listMessageReports(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        (prisma as any).messageReport.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).messageReport.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listUserBlocks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        (prisma as any).userBlock.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).userBlock.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── Referrals ──────────────────────────────────────────────────
  static async listReferralRewards(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        (prisma as any).referralReward.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).referralReward.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── API Keys, Sessions, LoginHistory ──────────────────────────
  static async listApiKeys(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        prisma.aPIKey.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
          select: { id: true, userId: true, businessId: true, name: true, prefix: true, last4: true, permissions: true, isActive: true, revokedAt: true, lastUsedAt: true, usageCount: true, expiresAt: true, createdAt: true },
        }),
        (prisma as any).aPIKey.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async revokeApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const existing = await prisma.aPIKey.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new AppError('API key not found', 404);
      const key = await prisma.aPIKey.update({
        where: { id: req.params.id },
        data: { revokedAt: new Date(), isActive: false },
        select: { id: true, name: true, prefix: true, isActive: true, revokedAt: true, userId: true, businessId: true },
      });
      await writeAudit(prisma, { actorId: req.user!.id, action: 'API_KEY_REVOKE', entity: 'APIKey', entityId: key.id, before: { isActive: existing.isActive }, after: { isActive: false }, reason: req.body?.reason ?? null, req });
      res.json({ apiKey: key });
    } catch (e) { next(e); }
  }

  /** Active sign-in sessions are refresh-token chains (the legacy Session table is unused). */
  static async listSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const where = { revokedAt: null, expiresAt: { gt: new Date() } };
      const [items, total] = await Promise.all([
        prisma.refreshToken.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          select: { id: true, userId: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true, user: { select: { id: true, email: true, username: true } } },
        }),
        prisma.refreshToken.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const token = await prisma.refreshToken.findUnique({ where: { id: req.params.id }, select: { id: true, userId: true, revokedAt: true } });
      if (!token) throw new AppError('Session not found', 404);
      if (!token.revokedAt) {
        await prisma.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
      }
      await writeAudit(prisma, { actorId: req.user!.id, action: 'SESSION_REVOKE', entity: 'RefreshToken', entityId: token.id, after: { userId: token.userId }, reason: req.body?.reason ?? null, req });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }

  static async listLoginHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        (prisma as any).loginHistory.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        (prisma as any).loginHistory.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── WhatsApp ───────────────────────────────────────────────────
  static async listWhatsAppMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const direction = req.query.direction as string | undefined;
      const where: any = {};
      if (direction) where.direction = direction;
      const [items, total] = await Promise.all([
        (prisma as any).whatsAppMessage.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).whatsAppMessage.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async whatsappStats(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const oneDayAgo  = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDayAgo = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
      const [total, today, week, byDirection] = await Promise.all([
        (prisma as any).whatsAppMessage.count(),
        (prisma as any).whatsAppMessage.count({ where: { createdAt: { gte: oneDayAgo } } }),
        (prisma as any).whatsAppMessage.count({ where: { createdAt: { gte: sevenDayAgo } } }),
        (prisma as any).whatsAppMessage.groupBy({
          by: ['direction'],
          _count: { id: true },
        }),
      ]);
      res.json({
        total, today, week,
        byDirection: (byDirection as any[]).map((r) => ({ direction: r.direction, count: r._count.id })),
      });
    } catch (e) { next(e); }
  }

  // ── On/Off Ramp ────────────────────────────────────────────────
  static async listOnRamps(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        prisma.onRampTransaction.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        prisma.onRampTransaction.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listOffRamps(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status;
      const [items, total] = await Promise.all([
        prisma.offRampTransaction.findMany({
          where, orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        prisma.offRampTransaction.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── Markets ────────────────────────────────────────────────────
  static async listMarkets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        (prisma as any).marketListing.findMany({
          orderBy: { rank: 'asc' }, skip, take: limit,
        }),
        (prisma as any).marketListing.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async toggleMarket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
      const listing = await (prisma as any).marketListing.update({
        where: { id: req.params.id },
        data: { isActive },
      });
      res.json({ listing });
    } catch (e) { next(e); }
  }

  // ── On-chain ───────────────────────────────────────────────────
  static async listOnChainTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        (prisma as any).onChainTransaction.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).onChainTransaction.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listWithdrawalWhitelist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        (prisma as any).withdrawalAddressWhitelist.findMany({
          orderBy: { activeAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).withdrawalAddressWhitelist.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── Transfers (internal wallet-to-wallet) ──────────────────────
  static async listTransfers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        prisma.transfer.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        prisma.transfer.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // ── Notifications ──────────────────────────────────────────────
  // Admin view: group by broadcastId (preferred) or fall back to title+message+minute bucket.
  // Returns one row per broadcast with recipient/read counts and sender info.
  static async listNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);

      const grouped = await prisma.$queryRaw<Array<{
        broadcastId: string | null;
        title: string;
        subtitle: string | null;
        message: string;
        description: string | null;
        mediaUrl: string | null;
        mediaType: string | null;
        type: string;
        createdBy: string | null;
        createdByEmail: string | null;
        createdByName: string | null;
        recipientCount: bigint;
        readCount: bigint;
        sampleId: string;
        createdAt: Date;
      }>>`
        SELECT
          n."broadcastId",
          n.title,
          n.subtitle,
          n.message,
          n.description,
          n."mediaUrl",
          n."mediaType",
          n.type,
          n."createdBy",
          u.email                                         AS "createdByEmail",
          CONCAT(u."firstName", ' ', u."lastName")        AS "createdByName",
          COUNT(*)::bigint                                AS "recipientCount",
          COUNT(*) FILTER (WHERE n."isRead")::bigint      AS "readCount",
          MIN(n.id)                                       AS "sampleId",
          MAX(n."createdAt")                              AS "createdAt"
        FROM "Notification" n
        LEFT JOIN "User" u ON u.id = n."createdBy"
        GROUP BY
          n."broadcastId",
          n.title, n.subtitle, n.message, n.description,
          n."mediaUrl", n."mediaType", n.type,
          n."createdBy", u.email, u."firstName", u."lastName",
          date_trunc('minute', n."createdAt")
        ORDER BY MAX(n."createdAt") DESC
        LIMIT ${limit} OFFSET ${skip}
      `;

      const totalGroups = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count FROM (
          SELECT 1 FROM "Notification"
          GROUP BY "broadcastId", title, subtitle, message, description, "mediaUrl", "mediaType", type, "createdBy", date_trunc('minute', "createdAt")
        ) sub
      `;
      const total = Number((totalGroups[0] as any)?.count ?? 0);

      const items = grouped.map((g) => ({
        id:             g.sampleId,
        broadcastId:    g.broadcastId,
        title:          g.title,
        subtitle:       g.subtitle,
        message:        g.message,
        description:    g.description,
        mediaUrl:       g.mediaUrl,
        mediaType:      g.mediaType,
        type:           g.type,
        createdAt:      g.createdAt,
        recipientCount: Number(g.recipientCount),
        readCount:      Number(g.readCount),
        sender: g.createdBy ? {
          id:    g.createdBy,
          email: g.createdByEmail,
          name:  g.createdByName?.trim() || g.createdByEmail,
        } : null,
      }));

      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  // GET /admin/notifications/:broadcastId/recipients — paginated list of users + read status
  static async getBroadcastRecipients(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { broadcastId } = req.params;
      const { page, limit, skip } = pageLimit(req);
      const readFilter = req.query.read; // 'true' | 'false' | undefined

      const where: any = { broadcastId };
      if (readFilter === 'true') where.isRead = true;
      if (readFilter === 'false') where.isRead = false;

      const [rows, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            isRead: true,
            createdAt: true,
            user: { select: { id: true, email: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
          },
        }),
        prisma.notification.count({ where }),
      ]);

      const items = rows.map((r) => ({
        notifId:  r.id,
        isRead:   r.isRead,
        readAt:   r.isRead ? r.createdAt : null,
        user:     r.user,
      }));

      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async broadcastNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = z.object({
        title:        z.string().min(1).max(120),
        subtitle:     z.string().max(200).optional(),
        description:  z.string().max(2000).optional(),
        message:      z.string().min(1).max(2000).optional(),
        body:         z.string().min(1).max(2000).optional(),
        type:         z.string().optional(),
        mediaUrl:     z.string().url().max(500).optional(),
        mediaType:    z.enum(['image', 'gif', 'video', 'none']).optional(),
        locales:      z.record(z.object({ title: z.string(), subtitle: z.string().optional(), description: z.string().optional() })).optional(),
        targetRoles:  z.array(z.string()).optional(),
        targetUserIds: z.array(z.string().uuid()).optional(),
      }).parse(req.body);
      const { title, subtitle, description, type = 'announcement', mediaUrl, mediaType, locales, targetRoles, targetUserIds } = parsed;
      const message = parsed.message ?? parsed.body ?? '';
      if (!message && !description) return next(new AppError('body, message or description is required', 400));

      const broadcastId = crypto.randomUUID();
      const adminId = req.user!.id;

      let userWhere: any = { status: 'ACTIVE' };
      if (targetRoles && targetRoles.length > 0) userWhere.role = { in: targetRoles };
      if (targetUserIds && targetUserIds.length > 0) userWhere.id = { in: targetUserIds };

      const rows = await prisma.user.findMany({ where: userWhere, select: { id: true } });
      const targets = rows.map((r) => r.id);

      if (targets.length === 0) return res.json({ delivered: 0 });

      await prisma.notification.createMany({
        data: targets.map((userId) => ({
          userId,
          title,
          subtitle:    subtitle    ?? null,
          message,
          description: description ?? null,
          mediaUrl:    mediaUrl    ?? null,
          mediaType:   mediaType   ?? null,
          locales: locales != null ? (locales as Prisma.InputJsonValue) : Prisma.JsonNull,
          type,
          broadcastId,
          createdBy: adminId,
        })),
      });
      emitNotification(req, targets, { title, subtitle, message, description, mediaUrl, mediaType, type });
      res.json({ delivered: targets.length, broadcastId });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
      next(e);
    }
  }

  static async uploadMedia(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      console.log('[uploadMedia] content-type:', req.headers['content-type']);
      console.log('[uploadMedia] req.file:', req.file);
      console.log('[uploadMedia] req.files:', req.files);
      console.log('[uploadMedia] req.body keys:', Object.keys(req.body ?? {}));
      if (!req.file) return next(new AppError('No file uploaded', 400));
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      const url = `${baseUrl}/media/${req.file.filename}`;
      const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
      res.json({ url, mediaType, filename: req.file.filename });
    } catch (e) {
      next(e);
    }
  }

  // ── PlatformBankAccount admin CRUD (the deposit-side rails) ────
  static async listPlatformBanks(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const items = await (prisma as any).platformBankAccount.findMany({
        orderBy: [{ currency: 'asc' }, { createdAt: 'asc' }],
      });
      res.json({ items });
    } catch (e) { next(e); }
  }

  static async createPlatformBank(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason, ...data } = bankSchema.extend({ reason: z.string().trim().max(500).optional() }).parse(req.body);
      const result = await changeDepositAccountFor(req, null, data, reason);
      if (result.pendingApproval) { res.status(202).json({ ...result, message: 'Sent to a second approver: new deposit accounts need approval before customers see them.' }); return; }
      res.status(201).json({ bank: result.bank });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
      next(e);
    }
  }

  static async updatePlatformBank(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason, ...data } = bankSchema.partial().extend({
        accountNumber: z.string().optional().nullable(), iban: z.string().optional().nullable(), swift: z.string().optional().nullable(),
        sortCode: z.string().optional().nullable(), routingNumber: z.string().optional().nullable(), branch: z.string().optional().nullable(),
        memo: z.string().optional().nullable(), isActive: z.boolean().optional(), reason: z.string().trim().max(500).optional(),
      }).parse(req.body);
      const result = await changeDepositAccountFor(req, req.params.id, data, reason);
      if (result.pendingApproval) { res.status(202).json({ ...result, message: 'Sent to a second approver: changes to payment details need approval.' }); return; }
      res.json({ bank: result.bank });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
      next(e);
    }
  }

  /** Accounts are never deleted (their history matters); this deactivates. */
  static async deletePlatformBank(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { applyDepositAccountChange } = await import('../services/platform/depositAccounts.service');
      const bank = await applyDepositAccountChange(req.params.id, { isActive: false }, req.user!.id, 'Removed by staff', req);
      res.json({ ok: true, deactivated: true, bank });
    } catch (e) { next(e); }
  }

  // ── Data browser (raw paginated reads of every core model) ───────
  static async listRawTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const search = String(req.query.search ?? '');
      const type = req.query.type ? String(req.query.type) : undefined;
      const currency = req.query.currency ? String(req.query.currency) : undefined;
      const where: any = {};
      if (type) where.type = type;
      if (currency) where.currency = currency;
      if (search) where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
      ];
      const [items, total] = await prisma.$transaction([
        prisma.transaction.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true, username: true } } } }),
        prisma.transaction.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listRawWallets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const currency = req.query.currency ? String(req.query.currency) : undefined;
      const userId = req.query.userId ? String(req.query.userId) : undefined;
      const where: any = {};
      if (currency) where.currency = currency;
      if (userId) where.userId = userId;
      const [items, total] = await prisma.$transaction([
        prisma.wallet.findMany({ where, skip, take: limit, orderBy: { updatedAt: 'desc' }, include: { user: { select: { email: true, username: true } } } }),
        prisma.wallet.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listRawBankAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const search = String(req.query.search ?? '');
      const where: any = search ? {
        OR: [
          { bankName: { contains: search, mode: 'insensitive' } },
          { accountName: { contains: search, mode: 'insensitive' } },
        ],
      } : {};
      const [items, total] = await prisma.$transaction([
        prisma.bankAccount.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { email: true, username: true } } } }),
        prisma.bankAccount.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listRawP2PTrades(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const status = req.query.status ? String(req.query.status) : undefined;
      const where: any = status ? { status } : {};
      const [items, total] = await prisma.$transaction([
        prisma.p2PTrade.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { buyer: { select: { email: true, username: true } }, seller: { select: { email: true, username: true } } } }),
        prisma.p2PTrade.count({ where }),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async listPlatformFees(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const source = req.query.source ? String(req.query.source) : undefined;
      const currency = req.query.currency ? String(req.query.currency) : undefined;
      const where: any = {};
      if (source) where.source = source;
      if (currency) where.currency = currency;
      const [items, total, totals] = await Promise.all([
        prisma.platformFee.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.platformFee.count({ where }),
        prisma.platformFee.groupBy({
          by: ['currency'],
          where,
          _sum: { amountUsd: true, amount: true },
        }),
      ]);
      res.json({ ...packPage(items, total, page, limit), totalsByCurrency: totals });
    } catch (e) { next(e); }
  }

  // ── Waitlist ─────────────────────────────────────────────────────
  // GET /admin/waitlist — paginated entries + stats + email transport health
  static async listWaitlist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const search = String(req.query.search ?? '').trim();
      // 'pending' = not yet emailed the launch blast, 'notified' = already emailed
      const filter = req.query.filter ? String(req.query.filter) : undefined;

      const where: any = {};
      if (search) where.email = { contains: search, mode: 'insensitive' };
      if (filter === 'pending') where.notified = false;
      if (filter === 'notified') where.notified = true;

      const [items, total, totalAll, notifiedCount] = await Promise.all([
        prisma.waitlistEntry.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.waitlistEntry.count({ where }),
        prisma.waitlistEntry.count(),
        prisma.waitlistEntry.count({ where: { notified: true } }),
      ]);

      res.json({
        ...packPage(items, total, page, limit),
        stats: {
          total: totalAll,
          notified: notifiedCount,
          pending: totalAll - notifiedCount,
        },
        // Surface transport health so the admin can see WHY confirmations may
        // not be landing (e.g. no RESEND_API_KEY / SMTP configured).
        email: getEmailStatus(),
      });
    } catch (e) { next(e); }
  }

  // POST /admin/waitlist/launch — send the launch blast to all (or only the
  // not-yet-notified) entries. Sends sequentially with per-recipient error
  // capture so one bad address never aborts the run, and marks each success
  // as notified so re-runs don't double-send.
  static async broadcastWaitlist(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const parsed = z.object({
        subject:   z.string().max(160).optional(),
        heading:   z.string().max(160).optional(),
        body:      z.string().max(8000).optional(),
        ctaLabel:  z.string().max(60).optional(),
        ctaUrl:    z.string().url().max(500).optional(),
        // 'pending' (default) only emails entries not yet notified; 'all' re-sends to everyone.
        audience:  z.enum(['pending', 'all']).optional(),
        // Optional: limit a run for testing (e.g. send to the first 5).
        limit:     z.number().int().positive().max(100000).optional(),
      }).parse(req.body);

      const where = parsed.audience === 'all' ? {} : { notified: false };
      const entries = await prisma.waitlistEntry.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: parsed.limit,
        select: { id: true, email: true },
      });

      if (entries.length === 0) {
        return res.json({ sent: 0, failed: 0, total: 0, errors: [] });
      }

      let sent = 0;
      let failed = 0;
      const errors: Array<{ email: string; error: string }> = [];

      for (const entry of entries) {
        try {
          await sendWaitlistLaunchEmail({
            to:       entry.email,
            subject:  parsed.subject,
            heading:  parsed.heading,
            body:     parsed.body,
            ctaLabel: parsed.ctaLabel,
            ctaUrl:   parsed.ctaUrl,
          });
          await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { notified: true } });
          sent++;
        } catch (err) {
          failed++;
          if (errors.length < 25) errors.push({ email: entry.email, error: emailErrorSummary(err) });
        }
      }

      res.json({ sent, failed, total: entries.length, errors });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
      next(e);
    }
  }

  // POST /admin/waitlist/:id/resend — re-send the signup confirmation to one entry
  static async resendWaitlistConfirmation(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const entry = await prisma.waitlistEntry.findUnique({ where: { id: req.params.id } });
      if (!entry) return next(new AppError('Waitlist entry not found', 404));
      await sendWaitlistConfirmation({ to: entry.email });
      res.json({ ok: true, email: entry.email });
    } catch (e) {
      next(new AppError(`Send failed: ${emailErrorSummary(e)}`, 502));
    }
  }

  // DELETE /admin/waitlist/:id — remove an entry (spam / bad address)
  static async deleteWaitlistEntry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.waitlistEntry.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
}
