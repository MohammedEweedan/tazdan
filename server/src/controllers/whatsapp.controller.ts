import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import {
  sendWhatsAppText,
  validateTwilioSignature,
  isTwilioConfigured,
} from '../services/whatsapp/twilio.service';

/* ── Intent patterns ───────────────────────────────────────────────── */

const INTENTS: Array<{ pattern: RegExp; handler: (user: any) => Promise<string> }> = [
  {
    pattern: /\bbalance\b/i,
    handler: async (user) => {
      if (!user) return 'Please register at promrkts.com to check your balance.';
      const wallets = await prisma.wallet.findMany({
        where: { userId: user.id },
        select: { currency: true, balance: true },
        take: 10,
      });
      if (!wallets.length) return `Hi ${user.firstName}! You have no wallets yet. Visit the app to get started.`;
      const lines = wallets.map((w: any) => `${w.currency}: ${Number(w.balance).toFixed(4)}`).join('\n');
      return `Hi ${user.firstName}! 👋 Your balances:\n\n${lines}\n\nReply *help* for more options.`;
    },
  },
  {
    pattern: /\bkyc\b|\bverif(y|ication)\b|\bidentit(y|ies)\b/i,
    handler: async (user) => {
      if (!user) return 'Please register at promrkts.com to start your KYC verification.';
      const kycStatus = user.kycStatus ?? 'NOT_SUBMITTED';
      const statusMap: Record<string, string> = {
        NOT_SUBMITTED: 'not submitted yet. Open the app to complete your KYC.',
        PENDING: 'under review. We will notify you within a few hours.',
        APPROVED: 'approved! ✅ You have full access.',
        REJECTED: 'rejected. Please re-submit your documents via the app.',
      };
      return `Hi ${user.firstName}! Your KYC is ${statusMap[kycStatus] ?? kycStatus}.`;
    },
  },
  {
    pattern: /\bwithdraw(al)?\s*(status|state|pending|update)\b|\bwithdraw.*status\b/i,
    handler: async (user) => {
      if (!user) return 'Please log in to promrkts.com to check your withdrawal status.';
      const recent = await (prisma as any).withdrawal.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { amount: true, currency: true, status: true, createdAt: true },
      });
      if (!recent) return `Hi ${user.firstName}! No withdrawals found on your account.`;
      return `Hi ${user.firstName}! Your latest withdrawal: ${recent.amount} ${recent.currency} — Status: *${recent.status}*.`;
    },
  },
  {
    pattern: /\bdeposit\s*(status|state|pending|update)\b|\bdeposit.*status\b/i,
    handler: async (user) => {
      if (!user) return 'Please log in to promrkts.com to check your deposit status.';
      const recent = await (prisma as any).deposit.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { amount: true, currency: true, status: true, createdAt: true },
      });
      if (!recent) return `Hi ${user.firstName}! No deposits found on your account.`;
      return `Hi ${user.firstName}! Your latest deposit: ${recent.amount} ${recent.currency} — Status: *${recent.status}*.`;
    },
  },
  {
    pattern: /\bhelp\b|\bcommands?\b|\bwhat can you\b/i,
    handler: async (user) => {
      const greeting = user ? `Hi ${user.firstName}! ` : '';
      return `${greeting}*promrkts WhatsApp Support* 🏦\n\nYou can ask:\n• *balance* – see your wallet balances\n• *kyc* – check verification status\n• *deposit status* – latest deposit\n• *withdraw status* – latest withdrawal\n\nFor anything else just type your question and a support agent will reply shortly.`;
    },
  },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

async function findUserByWhatsAppFrom(from: string) {
  // Twilio sends "whatsapp:+14155238886" — strip prefix first.
  const phone = normalizePhone(from.replace(/^whatsapp:/i, ''));
  return prisma.user.findFirst({
    where: { phone: { endsWith: phone.replace(/^\+/, '').slice(-10) } },
    select: {
      id: true, firstName: true, lastName: true,
      phone: true, phoneCountryCode: true, kycStatus: true, role: true,
    },
  });
}

/* ── Ensure a support escalation exists for this user ─────────────── */
async function ensureSupportEscalation(userId: string, reason: string) {
  const supportBot = await prisma.user.findFirst({
    where: { username: 'support' },
    select: { id: true },
  });
  if (!supportBot) return null;

  const existing = await (prisma as any).supportEscalation.findFirst({
    where: { raisedById: userId, status: { in: ['OPEN', 'ASSIGNED'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (existing) return existing;

  return (prisma as any).supportEscalation.create({
    data: {
      raisedById:     userId,
      counterpartyId: supportBot.id,
      reason,
      details:        'Opened via WhatsApp inbound message',
      status:         'OPEN',
    },
  });
}

/* ── Controller ────────────────────────────────────────────────────── */

export class WhatsAppController {

  /* POST /api/whatsapp/webhook — Twilio inbound */
  static async receiveMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate Twilio signature in production.
      if (isTwilioConfigured()) {
        const sig = req.headers['x-twilio-signature'] as string | undefined;
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const valid = validateTwilioSignature({ signature: sig, url, params: req.body });
        if (!valid) {
          res.status(403).send('Forbidden');
          return;
        }
      }

      const { From: fromRaw, Body: body, MessageSid } = req.body;
      if (!fromRaw || !body) { res.sendStatus(204); return; }

      const phone = normalizePhone(fromRaw.replace(/^whatsapp:/i, ''));
      const user  = await findUserByWhatsAppFrom(fromRaw);

      // Persist inbound message.
      await (prisma as any).whatsAppMessage.create({
        data: {
          phoneNumber: phone.replace(/^\+/, ''),
          message:     body,
          direction:   'IN',
          userId:      user?.id ?? null,
          botResponse: { sid: MessageSid },
        },
      });

      // Route to intent handler or support escalation.
      let botReply: string | null = null;
      for (const intent of INTENTS) {
        if (intent.pattern.test(body)) {
          botReply = await intent.handler(user);
          break;
        }
      }

      if (botReply) {
        // Auto-reply.
        await sendWhatsAppText({ to: phone, body: botReply, userId: user?.id });
      } else if (user) {
        // Unknown intent — escalate to support queue.
        const esc = await ensureSupportEscalation(user.id, `WhatsApp inbound: "${body.slice(0, 80)}"`);

        // Also persist as an in-app Message so support sees it in their thread.
        const supportBot = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
        if (supportBot) {
          const msg = await prisma.message.create({
            data: {
              senderId:   user.id,
              receiverId: supportBot.id,
              content:    body,
              type:       'TEXT',
              metadata:   {
                source:        'whatsapp',
                escalationId:  esc?.id ?? null,
                sid:           MessageSid,
              } as any,
            },
          });

          // Emit real-time to admin support queue.
          const io = req.app.get('io');
          if (io) {
            io.to(`user:${supportBot.id}`).emit('message:new', {
              id: msg.id, senderId: user.id, receiverId: supportBot.id,
              content: body, type: 'TEXT', isRead: false,
              createdAt: msg.createdAt, metadata: msg.metadata,
            });
            io.to('admin').emit('escalation:new', { escalationId: esc?.id, userId: user.id, source: 'whatsapp' });
          }
        }

        // Auto-ack the user.
        const ack = `Hi ${user.firstName}! A support agent will get back to you shortly. Your reference: #${(esc?.id ?? 'N/A').slice(0, 8)}.`;
        await sendWhatsAppText({ to: phone, body: ack, userId: user.id });
      } else {
        // Unknown user.
        const reply = `Welcome to *promrkts*! 👋 Please register at promrkts.com to access your account. Reply *help* for more info.`;
        await sendWhatsAppText({ to: phone, body: reply });
      }

      // Twilio expects a 200 (or TwiML response) — plain 200 suppresses a TwiML <Response>.
      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  }

  /* POST /api/whatsapp/send — admin-initiated outbound */
  static async sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') throw new AppError('Admin access required', 403);

      const { phoneNumber, message, userId } = z.object({
        phoneNumber: z.string().min(5),
        message:     z.string().min(1).max(4096),
        userId:      z.string().uuid().optional(),
      }).parse(req.body);

      let targetUserId = userId;
      if (!targetUserId) {
        const user = await prisma.user.findFirst({
          where: { phone: { endsWith: phoneNumber.replace(/^\+/, '').slice(-10) } },
        });
        targetUserId = user?.id;
      }

      const result = await sendWhatsAppText({ to: phoneNumber, body: message, userId: targetUserId });
      if (!result.ok) throw new AppError(result.reason ?? 'WhatsApp send failed', 502);

      res.status(201).json({ ok: true, sid: result.sid });
    } catch (error) {
      next(error);
    }
  }

  /* GET /api/whatsapp/messages — admin view */
  static async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') throw new AppError('Admin access required', 403);

      const { phoneNumber, userId } = req.query;
      const page  = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const where: any = {};
      if (phoneNumber) where.phoneNumber = phoneNumber;
      if (userId)      where.userId      = userId;

      const [messages, total] = await Promise.all([
        (prisma as any).whatsAppMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        }),
        (prisma as any).whatsAppMessage.count({ where }),
      ]);

      res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  /* GET /api/whatsapp/stats — admin dashboard card */
  static async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user!.role !== 'ADMIN') throw new AppError('Admin access required', 403);

      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [stats30d, stats24h] = await Promise.all([
        (prisma as any).whatsAppMessage.groupBy({
          by: ['direction'],
          _count: { id: true },
          where: { createdAt: { gte: since30d } },
        }),
        (prisma as any).whatsAppMessage.groupBy({
          by: ['direction'],
          _count: { id: true },
          where: { createdAt: { gte: since24h } },
        }),
      ]);

      const count = (arr: any[], dir: string) =>
        arr.find((s: any) => s.direction === dir)?._count.id ?? 0;

      res.json({
        period30d: {
          total:    stats30d.reduce((s: number, r: any) => s + r._count.id, 0),
          inbound:  count(stats30d, 'IN'),
          outbound: count(stats30d, 'OUT'),
        },
        period24h: {
          total:    stats24h.reduce((s: number, r: any) => s + r._count.id, 0),
          inbound:  count(stats24h, 'IN'),
          outbound: count(stats24h, 'OUT'),
        },
        configured: isTwilioConfigured(),
      });
    } catch (error) {
      next(error);
    }
  }
}
