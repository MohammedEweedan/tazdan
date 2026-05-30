import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import {
  sendWhatsAppText,
  validateTwilioSignature,
  validateMetaSignature,
  isTwilioConfigured,
  isMetaWhatsAppConfigured,
  startVerification,
} from '../services/whatsapp/index';

/* ── Bot intents ───────────────────────────────────────────────────── */

type IntentHandler = (user: any, rawBody: string) => Promise<string>;

const INTENTS: Array<{ pattern: RegExp; handler: IntentHandler }> = [
  {
    // balance / my balance / check balance
    pattern: /\bbalance\b|\bmy\s+wallet\b|\bwallet\s+balance\b/i,
    handler: async (user) => {
      if (!user) return '🔐 Please register at *tazdan.com* to check your balance.';
      const wallets = await prisma.wallet.findMany({
        where: { userId: user.id },
        select: { currency: true, balance: true },
        orderBy: { currency: 'asc' },
        take: 15,
      });
      if (!wallets.length) return `👋 Hi *${user.firstName}*! You have no wallets yet. Open the app to get started.`;
      const lines = wallets
        .filter((w: any) => Number(w.balance) > 0)
        .map((w: any) => `  • ${w.currency}: *${Number(w.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}*`)
        .join('\n');
      return `👋 Hi *${user.firstName}*! Your balances:\n\n${lines || '  (all zero)'}\n\nReply *help* for more options.`;
    },
  },
  {
    // kyc / verification / identity
    pattern: /\bkyc\b|\bverif(y|ication)\b|\bidentit(y|ies)\b/i,
    handler: async (user) => {
      if (!user) return '🔐 Please register at *tazdan.com* to start KYC verification.';
      const kycStatus = user.kycStatus ?? 'NOT_SUBMITTED';
      const statusMsg: Record<string, string> = {
        NOT_SUBMITTED: 'not submitted yet. Open the app to complete your KYC.',
        PENDING:       'under review. ⏳ We will notify you within a few hours.',
        APPROVED:      'approved! ✅ You have full access to all features.',
        REJECTED:      'rejected. ❌ Please re-submit your documents via the app.',
      };
      return `📋 *${user.firstName}*, your KYC status is ${statusMsg[kycStatus] ?? kycStatus}`;
    },
  },
  {
    // withdrawal status
    pattern: /\bwithdraw(al)?\b.*\b(status|update|pending|done)\b|\b(status|update)\b.*\bwithdraw/i,
    handler: async (user) => {
      if (!user) return '🔐 Please log in to *tazdan.com* to check your withdrawal status.';
      const recent = await (prisma as any).withdrawal.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { amount: true, currency: true, status: true, createdAt: true },
      });
      if (!recent) return `👋 *${user.firstName}*, no withdrawals found on your account.`;
      const date = new Date(recent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `💸 *${user.firstName}*, your latest withdrawal:\n\n  • Amount: *${Number(recent.amount).toFixed(2)} ${recent.currency}*\n  • Status: *${recent.status}*\n  • Date: ${date}`;
    },
  },
  {
    // deposit status
    pattern: /\bdeposit\b.*\b(status|update|pending|done)\b|\b(status|update)\b.*\bdeposit/i,
    handler: async (user) => {
      if (!user) return '🔐 Please log in to *tazdan.com* to check your deposit status.';
      const recent = await (prisma as any).deposit.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { amount: true, currency: true, status: true, createdAt: true },
      });
      if (!recent) return `👋 *${user.firstName}*, no deposits found on your account.`;
      const date = new Date(recent.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `💰 *${user.firstName}*, your latest deposit:\n\n  • Amount: *${Number(recent.amount).toFixed(2)} ${recent.currency}*\n  • Status: *${recent.status}*\n  • Date: ${date}`;
    },
  },
  {
    // rate / price / USDT rate / exchange rate
    pattern: /\brate\b|\bprice\b|\bexchange\b|\busdt\b|\bbtc\b|\beth\b/i,
    handler: async (_user, body) => {
      // Try to find which asset they're asking about.
      const assetMatch = body.match(/\b(BTC|ETH|SOL|BNB|XRP|ADA|DOGE|MATIC|AVAX|USDT)\b/i);
      const asset = assetMatch ? assetMatch[1].toUpperCase() : 'USDT';

      const rate = await prisma.exchangeRate.findFirst({
        where: {
          OR: [
            { baseCurrency: asset as any },
            { quoteCurrency: asset as any },
          ],
          isActive: true,
        },
      });

      if (!rate) {
        return `📊 Live rates are not available right now. Check the app for current prices.`;
      }
      return `📊 *${rate.baseCurrency}/${rate.quoteCurrency}* rates:\n\n  • Buy:  *${Number(rate.buyPrice).toFixed(4)}*\n  • Sell: *${Number(rate.sellPrice).toFixed(4)}*\n\nRates update every few minutes. Open the app to trade.`;
    },
  },
  {
    // send code / resend code / otp / verification code
    pattern: /\b(send|resend|get)\s+(code|otp|pin|verification)\b|\bverif(y|ication)\s+code\b/i,
    handler: async (user) => {
      if (!user) return '🔐 Please log in to the *tazdan* app first, then request your code from the verification screen.';
      if (user.phoneVerified) return `✅ *${user.firstName}*, your phone is already verified!`;
      // Trigger OTP send (uses self-hosted path — code comes from THIS number).
      const phone = `+${user.phoneCountryCode}${user.phone}`;
      if (phone === '+undefined') return '⚠️ No phone number found on your account. Please update it in the app.';
      await startVerification({ phone, channel: 'whatsapp', userId: user.id });
      return `🔐 A new 6-digit verification code has been sent to this WhatsApp number. Enter it in the *tazdan* app to verify your phone.`;
    },
  },
  {
    // help / commands / what can you do
    pattern: /\bhelp\b|\bcommand(s)?\b|\bwhat can you\b|\bhi\b|\bhello\b|\bstart\b/i,
    handler: async (user) => {
      const greeting = user ? `Hi *${user.firstName}*! ` : 'Welcome to *tazdan*! ';
      return `${greeting}👋\n\nI can help you with:\n\n` +
        `  • *balance* — check your wallet balances\n` +
        `  • *kyc* — check your verification status\n` +
        `  • *deposit status* — latest deposit update\n` +
        `  • *withdraw status* — latest withdrawal update\n` +
        `  • *rate* or *BTC price* — live exchange rates\n` +
        `  • *send code* — resend your phone verification OTP\n\n` +
        `For anything else, just type your question and a support agent will respond shortly.`;
    },
  },
];

/* ── Helpers ───────────────────────────────────────────────────────── */

function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

async function findUserByWhatsAppFrom(from: string) {
  // Twilio sends "whatsapp:+14155238886" — strip prefix.
  const phone = normalizePhone(from.replace(/^whatsapp:/i, ''));
  const suffix = phone.replace(/^\+/, '').slice(-10);
  return prisma.user.findFirst({
    where: { phone: { endsWith: suffix } },
    select: {
      id: true, firstName: true, lastName: true,
      phone: true, phoneCountryCode: true,
      kycStatus: true, role: true, phoneVerified: true,
    },
  });
}

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

      // Route to intent handler.
      let botReply: string | null = null;
      for (const intent of INTENTS) {
        if (intent.pattern.test(body)) {
          botReply = await intent.handler(user, body);
          break;
        }
      }

      if (botReply) {
        await sendWhatsAppText({ to: phone, body: botReply, userId: user?.id });
      } else if (user) {
        // Unknown intent — escalate to support queue.
        const esc = await ensureSupportEscalation(user.id, `WhatsApp inbound: "${body.slice(0, 80)}"`);

        const supportBot = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
        if (supportBot) {
          const msg = await prisma.message.create({
            data: {
              senderId:   user.id,
              receiverId: supportBot.id,
              content:    body,
              type:       'TEXT',
              metadata:   { source: 'whatsapp', escalationId: esc?.id ?? null, sid: MessageSid } as any,
            },
          });

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

        const ref = (esc?.id ?? 'N/A').slice(0, 8).toUpperCase();
        const ack = `✅ *${user.firstName}*, your message has been received! A support agent will get back to you shortly.\n\nReference: *#${ref}*`;
        await sendWhatsAppText({ to: phone, body: ack, userId: user.id });
      } else {
        // Unknown user.
        const reply =
          `👋 Welcome to *tazdan*!\n\n` +
          `It looks like this number isn't linked to an account yet.\n\n` +
          `📲 Download the app or visit *tazdan.com* to register.\n\n` +
          `Reply *help* to see what I can do.`;
        await sendWhatsAppText({ to: phone, body: reply });
      }

      // Twilio expects 200 — plain 200 without body suppresses TwiML auto-reply.
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
        configured: isTwilioConfigured() || isMetaWhatsAppConfigured(),
        providers: {
          meta:   isMetaWhatsAppConfigured(),
          twilio: isTwilioConfigured(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /* ── Meta WhatsApp Cloud API webhook ────────────────────────── */

  /**
   * GET /api/whatsapp/meta/webhook — Meta verification handshake.
   * Meta calls this once when you register the webhook URL in the
   * Business dashboard. We echo `hub.challenge` back when the
   * verify_token matches.
   */
  static async verifyMetaWebhook(req: AuthRequest, res: Response, _next: NextFunction) {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token && token === process.env.META_WA_VERIFY_TOKEN) {
      res.status(200).send(String(challenge));
      return;
    }
    res.sendStatus(403);
  }

  /**
   * POST /api/whatsapp/meta/webhook — inbound message from Meta Cloud API.
   *
   * Meta payload shape (trimmed):
   *   { entry: [{ changes: [{ value: { messages: [{ from, id, text: { body } }] } }] }] }
   */
  static async receiveMetaMessage(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Validate signature when configured. The raw body must have been
      // captured by express.json's `verify` hook into req.rawBody.
      if (isMetaWhatsAppConfigured()) {
        const sig = req.headers['x-hub-signature-256'] as string | undefined;
        const raw = (req as any).rawBody ?? JSON.stringify(req.body);
        const ok  = validateMetaSignature({ signatureHeader: sig, rawBody: raw });
        if (!ok) {
          res.status(403).send('Forbidden');
          return;
        }
      }

      // ALWAYS 200 quickly — Meta retries on non-2xx.
      res.sendStatus(200);

      const entries = (req.body?.entry ?? []) as any[];
      for (const entry of entries) {
        for (const change of entry.changes ?? []) {
          const messages = change.value?.messages ?? [];
          for (const m of messages) {
            const from = m.from as string | undefined;
            const text = m.text?.body as string | undefined;
            const sid  = m.id   as string | undefined;
            if (!from || !text) continue;

            const phone = normalizePhone(from);
            const user  = await findUserByWhatsAppFrom(from);

            await (prisma as any).whatsAppMessage.create({
              data: {
                phoneNumber: phone.replace(/^\+/, ''),
                message:     text,
                direction:   'IN',
                userId:      user?.id ?? null,
                botResponse: { sid },
              },
            });

            let botReply: string | null = null;
            for (const intent of INTENTS) {
              if (intent.pattern.test(text)) {
                botReply = await intent.handler(user, text);
                break;
              }
            }

            if (botReply) {
              await sendWhatsAppText({ to: phone, body: botReply, userId: user?.id });
            } else if (user) {
              const esc = await ensureSupportEscalation(user.id, `WhatsApp inbound: "${text.slice(0, 80)}"`);
              const supportBot = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
              if (supportBot) {
                const msg = await prisma.message.create({
                  data: {
                    senderId:   user.id,
                    receiverId: supportBot.id,
                    content:    text,
                    type:       'TEXT',
                    metadata:   { source: 'whatsapp-meta', escalationId: esc?.id ?? null, sid } as any,
                  },
                });
                const io = req.app.get('io');
                if (io) {
                  io.to(`user:${supportBot.id}`).emit('message:new', {
                    id: msg.id, senderId: user.id, receiverId: supportBot.id,
                    content: text, type: 'TEXT', isRead: false,
                    createdAt: msg.createdAt, metadata: msg.metadata,
                  });
                  io.to('admin').emit('escalation:new', { escalationId: esc?.id, userId: user.id, source: 'whatsapp' });
                }
              }
              const ref = (esc?.id ?? 'N/A').slice(0, 8).toUpperCase();
              await sendWhatsAppText({
                to: phone,
                body: `✅ *${user.firstName}*, your message has been received! A support agent will get back to you shortly.\n\nReference: *#${ref}*`,
                userId: user.id,
              });
            } else {
              await sendWhatsAppText({
                to: phone,
                body: `👋 Welcome to *tazdan*!\n\nIt looks like this number isn't linked to an account yet.\n\n📲 Download the app or visit *tazdan.com* to register.\n\nReply *help* to see what I can do.`,
              });
            }
          }
        }
      }
    } catch (error) {
      // Don't bubble — we already sent 200. Just log.
      console.warn('[meta:wa-webhook] handler error', (error as Error).message);
      next?.(undefined as any);
    }
  }
}
