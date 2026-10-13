import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const flags = z.object({
  trades: z.boolean(), transfers: z.boolean(), deposits: z.boolean(),
  withdrawals: z.boolean(), p2p: z.boolean(), marketing: z.boolean(),
}).partial().strict();
const prefsSchema = z.object({ email: flags.optional(), push: flags.optional() }).strict();
// Expo push tokens: ExponentPushToken[…] / ExpoPushToken[…].
const PUSH_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$/;

export class NotificationController {
  // Get all notifications for authenticated user
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = 20;
      const type = typeof req.query.type === 'string' && req.query.type ? req.query.type.slice(0, 40) : undefined;

      const where: any = { userId };
      if (type) where.type = type;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      res.json({ notifications, total, unreadCount, page, pages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  // Mark one as read
  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.notification.updateMany({
        where: { id, userId: req.user!.id },
        data: { isRead: true },
      });
      res.json({ message: 'Marked as read' });
    } catch (error) {
      next(error);
    }
  }

  // Mark all as read
  static async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user!.id, isRead: false },
        data: { isRead: true },
      });
      res.json({ message: 'All marked as read' });
    } catch (error) {
      next(error);
    }
  }

  // Get unread count
  static async getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const count = await prisma.notification.count({
        where: { userId: req.user!.id, isRead: false },
      });
      res.json({ count });
    } catch (error) {
      next(error);
    }
  }

  // Get latest unread announcement for banner
  static async getLatestAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const notification = await prisma.notification.findFirst({
        where: { userId: req.user!.id, type: 'announcement', isRead: false },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ notification: notification ?? null });
    } catch (error) {
      next(error);
    }
  }

  // Helper: create a notification (used by other controllers)
  static async create(userId: string, title: string, message: string, type = 'info', metadata?: any) {
    return prisma.notification.create({
      data: { userId, title, message, type, metadata },
    });
  }

  /**
   * POST /api/notifications/register-token
   * Mobile registers its Expo push token here after login. Idempotent.
   */
  static async registerToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.body as { token?: unknown };
      if (typeof token !== 'string' || !PUSH_TOKEN.test(token)) {
        throw new AppError('A valid Expo push token is required', 400);
      }
      // A device token belongs to one account at a time. When a phone changes
      // hands (or a second account signs in on it) the previous account must
      // stop receiving pushes there — they carry amounts and names.
      await prisma.$transaction([
        prisma.user.updateMany({ where: { expoPushToken: token, id: { not: req.user!.id } }, data: { expoPushToken: null } }),
        prisma.user.update({ where: { id: req.user!.id }, data: { expoPushToken: token } }),
      ]);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/register-token
   * Mobile clears the push token on logout.
   */
  static async unregisterToken(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { expoPushToken: null },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/notifications/preferences
   * Returns the user's current notificationPrefs. Missing fields default
   * to true (opt-in). Shape:
   * {
   *   email: { trades, transfers, deposits, withdrawals, p2p, marketing },
   *   push:  { trades, transfers, deposits, withdrawals, p2p, marketing }
   * }
   */
  static async getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { notificationPrefs: true },
      });
      const prefs = (u?.notificationPrefs as any) ?? {};
      const fill = (cat: 'email' | 'push') => ({
        trades:      prefs?.[cat]?.trades      !== false,
        transfers:   prefs?.[cat]?.transfers   !== false,
        deposits:    prefs?.[cat]?.deposits    !== false,
        withdrawals: prefs?.[cat]?.withdrawals !== false,
        p2p:         prefs?.[cat]?.p2p         !== false,
        marketing:   prefs?.[cat]?.marketing   === true, // marketing defaults OFF
      });
      res.json({ preferences: { email: fill('email'), push: fill('push') } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/notifications/preferences
   * Body: { preferences: { email: { ...flags }, push: { ...flags } } }
   */
  static async updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body as { preferences?: unknown };
      const parsed = prefsSchema.safeParse(body?.preferences);
      if (!parsed.success) throw new AppError('preferences must be { email?, push? } with boolean category flags', 400);
      // Merge into the stored object: replacing it wiped other settings kept
      // there (chat read-receipt / last-seen privacy) and accepted any JSON.
      const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { notificationPrefs: true } });
      const base = current?.notificationPrefs && typeof current.notificationPrefs === 'object' && !Array.isArray(current.notificationPrefs)
        ? current.notificationPrefs as Record<string, any> : {};
      const merged = {
        ...base,
        ...(parsed.data.email ? { email: { ...(base.email ?? {}), ...parsed.data.email } } : {}),
        ...(parsed.data.push ? { push: { ...(base.push ?? {}), ...parsed.data.push } } : {}),
      };
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { notificationPrefs: merged },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}
