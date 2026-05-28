import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

export class NotificationController {
  // Get all notifications for authenticated user
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;
      const type = req.query.type as string | undefined;

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
      const { token } = req.body as { token?: string };
      if (!token || typeof token !== 'string') {
        throw new AppError('token is required', 400);
      }
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { expoPushToken: token },
      });
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
      const body = req.body as { preferences?: any };
      if (!body?.preferences || typeof body.preferences !== 'object') {
        throw new AppError('preferences object is required', 400);
      }
      await prisma.user.update({
        where: { id: req.user!.id },
        data: { notificationPrefs: body.preferences },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
}
