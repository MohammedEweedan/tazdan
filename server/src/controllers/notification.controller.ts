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
}
