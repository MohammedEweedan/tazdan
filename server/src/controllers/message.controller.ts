import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

export class MessageController {
  /** Send a message to another user */
  static async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { receiverId, receiverUsername, content, type, metadata } = req.body;
      if (!content?.trim()) throw new AppError('Message content is required', 400);

      let targetId = receiverId;
      if (!targetId && receiverUsername) {
        const target = await prisma.user.findFirst({ where: { username: receiverUsername } });
        if (!target) throw new AppError('User not found', 404);
        targetId = target.id;
      }
      if (!targetId) throw new AppError('Recipient is required', 400);
      if (targetId === req.user!.id) throw new AppError('Cannot message yourself', 400);

      const message = await prisma.message.create({
        data: {
          senderId: req.user!.id,
          receiverId: targetId,
          content: content.trim().slice(0, 2000),
          type: type || 'TEXT',
          metadata: metadata || undefined,
        },
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
        },
      });

      res.status(201).json({ message });
    } catch (error) {
      next(error);
    }
  }

  /** Get conversations list (latest message per user) */
  static async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Get all distinct conversation partners
      const sent = await prisma.message.findMany({
        where: { senderId: userId },
        select: { receiverId: true },
        distinct: ['receiverId'],
      });
      const received = await prisma.message.findMany({
        where: { receiverId: userId },
        select: { senderId: true },
        distinct: ['senderId'],
      });

      const partnerIds = [...new Set([
        ...sent.map(m => m.receiverId),
        ...received.map(m => m.senderId),
      ])];

      const conversations = await Promise.all(
        partnerIds.map(async (partnerId) => {
          const lastMessage = await prisma.message.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: partnerId },
                { senderId: partnerId, receiverId: userId },
              ],
            },
            orderBy: { createdAt: 'desc' },
          });
          const unreadCount = await prisma.message.count({
            where: { senderId: partnerId, receiverId: userId, isRead: false },
          });
          const partner = await prisma.user.findUnique({
            where: { id: partnerId },
            select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true },
          });
          return { partner, lastMessage, unreadCount };
        })
      );

      // Sort by latest message
      conversations.sort((a, b) =>
        new Date(b.lastMessage?.createdAt || 0).getTime() - new Date(a.lastMessage?.createdAt || 0).getTime()
      );

      res.json({ conversations });
    } catch (error) {
      next(error);
    }
  }

  /** Get messages with a specific user */
  static async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { userId: partnerId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = 50;

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where: {
            OR: [
              { senderId: req.user!.id, receiverId: partnerId },
              { senderId: partnerId, receiverId: req.user!.id },
            ],
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
          },
        }),
        prisma.message.count({
          where: {
            OR: [
              { senderId: req.user!.id, receiverId: partnerId },
              { senderId: partnerId, receiverId: req.user!.id },
            ],
          },
        }),
      ]);

      // Mark received messages as read
      await prisma.message.updateMany({
        where: { senderId: partnerId, receiverId: req.user!.id, isRead: false },
        data: { isRead: true },
      });

      res.json({ messages: messages.reverse(), total, page });
    } catch (error) {
      next(error);
    }
  }
}
