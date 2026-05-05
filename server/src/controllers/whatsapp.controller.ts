import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const whatsappMessageSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  message: z.string().min(1, 'Message is required'),
  direction: z.enum(['IN', 'OUT']),
  userId: z.string().uuid().optional(),
});

export class WhatsAppController {
  static async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
      }

      const { phoneNumber, message, userId } = req.body;

      // Find user by phone number if not provided
      let targetUserId = userId;
      if (!targetUserId) {
        const user = await prisma.user.findUnique({
          where: { phone: phoneNumber },
        });
        targetUserId = user?.id;
      }

      // Create message record
      const whatsappMessage = await prisma.whatsAppMessage.create({
        data: {
          phoneNumber,
          message,
          direction: 'OUT',
          userId: targetUserId,
          botResponse: { sent: true },
        },
      });

      // TODO: Integrate with actual WhatsApp API (Twilio, etc.)
      // For now, just simulate sending
      console.log(`WhatsApp message sent to ${phoneNumber}: ${message}`);

      res.status(201).json({ message: 'Message sent successfully', whatsappMessage });
    } catch (error) {
      next(error);
    }
  }

  static async receiveMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { From: phoneNumber, Body: message } = req.body;

      // Find user by phone number
      const user = await prisma.user.findUnique({
        where: { phone: phoneNumber },
        include: {
          wallets: true,
        },
      });

      // Create incoming message record
      const whatsappMessage = await prisma.whatsAppMessage.create({
        data: {
          phoneNumber,
          message,
          direction: 'IN',
          userId: user?.id,
        },
      });

      // Generate bot response
      let botResponse = '';
      if (user) {
        // Personalized response for registered users
        const greeting = `Hello ${user.firstName}! 👋`;
        
        if (message.toLowerCase().includes('balance')) {
          const balances = user.wallets.map(w => `${w.currency}: ${w.balance}`).join(', ');
          botResponse = `${greeting}\n\nYour current balances:\n${balances}\n\nNeed help? Reply "help" for more options.`;
        } else if (message.toLowerCase().includes('help')) {
        botResponse = `${greeting}\n\nAvailable commands:\n• "balance" - Check your account balances\n• "help" - Show this help message\n\nNeed more assistance? Contact support at support@promrkts.com`;
        } else {
          botResponse = `${greeting}\n\nI received your message. Try "balance" to check your funds, or "help" for more options.`;
        }
      } else {
        // Response for unregistered users
        botResponse = `Welcome to *promrkts*! 👋 Please registeron our website to start trading.`;
      }

      // Save bot response
      await prisma.whatsAppMessage.create({
        data: {
          phoneNumber,
          message: botResponse,
          direction: 'OUT',
          userId: user?.id,
          botResponse: { type: 'auto_response' },
        },
      });

      // TODO: Send actual WhatsApp response
      console.log(`WhatsApp bot response to ${phoneNumber}: ${botResponse}`);

      res.json({ message: 'Message processed successfully', botResponse });
    } catch (error) {
      next(error);
    }
  }

  static async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
      }

      const { phoneNumber, userId } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const where: any = {};
      if (phoneNumber) where.phoneNumber = phoneNumber;
      if (userId) where.userId = userId;

      const [messages, total] = await Promise.all([
        prisma.whatsAppMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        prisma.whatsAppMessage.count({ where }),
      ]);

      res.json({
        messages,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
      }

      const stats = await prisma.whatsAppMessage.groupBy({
        by: ['direction'],
        _count: {
          id: true,
        },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
      });

      const totalMessages = stats.reduce((sum: number, stat: any) => sum + stat._count.id, 0);
      const incomingMessages = stats.find((s: any) => s.direction === 'IN')?._count.id || 0;
      const outgoingMessages = stats.find((s: any) => s.direction === 'OUT')?._count.id || 0;

      res.json({
        totalMessages,
        incomingMessages,
        outgoingMessages,
        period: 'Last 30 days',
      });
    } catch (error) {
      next(error);
    }
  }
}
