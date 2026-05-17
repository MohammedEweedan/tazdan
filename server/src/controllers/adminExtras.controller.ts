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
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

function pageLimit(req: AuthRequest): { page: number; limit: number; skip: number } {
  const page  = Math.max(1, parseInt(String(req.query.page ?? '1'),  10) || 1);
  const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10) || 20);
  return { page, limit, skip: (page - 1) * limit };
}

function packPage<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
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

  static async resolveP2PDispute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { resolution, status = 'RESOLVED' } = z.object({
        resolution: z.string().min(1),
        status: z.enum(['RESOLVED', 'CLOSED', 'ESCALATED']).optional(),
      }).parse(req.body);
      const dispute = await (prisma as any).p2PDispute.update({
        where: { id },
        data: { status, resolution, resolvedAt: new Date() },
      });
      res.json({ dispute });
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
        (prisma as any).aPIKey.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        (prisma as any).aPIKey.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async revokeApiKey(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const key = await (prisma as any).aPIKey.update({
        where: { id: req.params.id },
        data: { revokedAt: new Date() },
      });
      res.json({ apiKey: key });
    } catch (e) { next(e); }
  }

  static async listSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        prisma.session.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
          include: { user: { select: { id: true, email: true, username: true } } },
        }),
        prisma.session.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.session.delete({ where: { id: req.params.id } });
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
  static async listNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = pageLimit(req);
      const [items, total] = await Promise.all([
        prisma.notification.findMany({
          orderBy: { createdAt: 'desc' }, skip, take: limit,
        }),
        prisma.notification.count(),
      ]);
      res.json(packPage(items, total, page, limit));
    } catch (e) { next(e); }
  }

  static async broadcastNotification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { title, message, type = 'announcement', userIds } = z.object({
        title:   z.string().min(1).max(120),
        message: z.string().min(1).max(2000),
        type:    z.string().optional(),
        userIds: z.array(z.string().uuid()).optional(),
      }).parse(req.body);

      let targets: string[];
      if (userIds && userIds.length > 0) {
        targets = userIds;
      } else {
        const rows = await prisma.user.findMany({
          where: { role: 'USER', status: 'ACTIVE' },
          select: { id: true },
        });
        targets = rows.map((r) => r.id);
      }
      await prisma.notification.createMany({
        data: targets.map((userId) => ({ userId, title, message, type })),
      });
      res.json({ delivered: targets.length });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
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
      const data = z.object({
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
      }).parse(req.body);
      const row = await (prisma as any).platformBankAccount.create({ data });
      res.status(201).json({ bank: row });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
      next(e);
    }
  }

  static async updatePlatformBank(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = z.object({
        currency:      z.string().min(2).max(8).optional(),
        country:       z.string().length(2).optional(),
        bankName:      z.string().min(1).max(120).optional(),
        accountName:   z.string().min(1).max(120).optional(),
        accountNumber: z.string().optional().nullable(),
        iban:          z.string().optional().nullable(),
        swift:         z.string().optional().nullable(),
        sortCode:      z.string().optional().nullable(),
        routingNumber: z.string().optional().nullable(),
        branch:        z.string().optional().nullable(),
        memo:          z.string().optional().nullable(),
        isActive:      z.boolean().optional(),
      }).parse(req.body);
      const row = await (prisma as any).platformBankAccount.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ bank: row });
    } catch (e) {
      if (e instanceof z.ZodError) return next(new AppError('Invalid payload', 400));
      next(e);
    }
  }

  static async deletePlatformBank(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await (prisma as any).platformBankAccount.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
}
