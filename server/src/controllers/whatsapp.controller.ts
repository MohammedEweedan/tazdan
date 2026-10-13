import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { recordSecurityEvent } from '../services/platform/securityEvents';
import {
  sendWhatsAppText,
  validateTwilioSignature,
  validateMetaSignature,
  isTwilioConfigured,
  isMetaWhatsAppConfigured,
  startVerification,
} from '../services/whatsapp/index';

/* ── Bot intents ───────────────────────────────────────────────────── */

type IntentHandler = (user: any, rawBody: string, ctx: { phone: string }) => Promise<string>;

/**
 * `allowUnverified` intents run for a sender whose number exactly matches an
 * account that has not verified that number yet (only "send code", which just
 * re-sends a code to the same number). Every other intent reads account data
 * and therefore needs a verified number.
 */
const INTENTS: Array<{ pattern: RegExp; handler: IntentHandler; allowUnverified?: boolean }> = [
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
    allowUnverified: true,
    handler: async (user, _body, ctx) => {
      if (!user) return '🔐 Please log in to the *tazdan* app first, then request your code from the verification screen.';
      if (user.phoneVerified) return `✅ *${user.firstName}*, your phone is already verified!`;
      // The sender's number exactly matches the account's stored E.164 number,
      // so the code goes back to the number that asked for it.
      await startVerification({ phone: ctx.phone, channel: 'whatsapp', userId: user.id });
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

/**
 * The account a WhatsApp sender is, if any. Numbers are stored in E.164 and
 * are unique, so only an exact match counts: matching on the last digits let a
 * number in one country resolve to an account in another, and an account that
 * merely typed someone's number (never verified it) received that person's
 * support messages. `verified` is true only when the account has proven it
 * owns the number; account data and support threads require it.
 */
export async function findUserByWhatsAppFrom(from: string): Promise<{ user: any | null; verified: boolean; phone: string }> {
  // Twilio sends "whatsapp:+14155238886"; Meta sends bare digits.
  const phone = normalizePhone(String(from ?? '').replace(/^whatsapp:/i, ''));
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) return { user: null, verified: false, phone };
  const user = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true, firstName: true, lastName: true,
      phone: true, phoneCountryCode: true, status: true,
      kycStatus: true, role: true, phoneVerified: true,
    },
  });
  if (!user || user.status === 'CLOSED' || user.status === 'BANNED') return { user: null, verified: false, phone };
  return { user, verified: user.phoneVerified === true, phone };
}

/**
 * One inbound WhatsApp message (already authenticated by the caller): store
 * it, answer a bot intent, or file it in the customer's support thread.
 */
async function handleInboundWhatsApp(req: AuthRequest, input: { from: string; text: string; sid?: string; source: 'whatsapp' | 'whatsapp-meta' }) {
  const { user: matched, verified, phone } = await findUserByWhatsAppFrom(input.from);
  const user = verified ? matched : null;

  await (prisma as any).whatsAppMessage.create({
    data: {
      phoneNumber: phone.replace(/^\+/, ''),
      message:     input.text.slice(0, 4096),
      direction:   'IN',
      userId:      user?.id ?? null,
      botResponse: { sid: input.sid ?? null },
    },
  });

  let botReply: string | null = null;
  for (const intent of INTENTS) {
    if (intent.pattern.test(input.text)) {
      botReply = await intent.handler(intent.allowUnverified ? matched : user, input.text, { phone });
      break;
    }
  }

  if (botReply) {
    await sendWhatsAppText({ to: phone, body: botReply, userId: user?.id });
    return;
  }
  if (user) {
    // Unknown intent — escalate to the support queue.
    const esc = await ensureSupportEscalation(user.id, `WhatsApp inbound: "${input.text.slice(0, 80)}"`);
    const supportBot = await prisma.user.findFirst({ where: { username: 'support' }, select: { id: true } });
    if (supportBot) {
      const msg = await prisma.message.create({
        data: {
          senderId:   user.id,
          receiverId: supportBot.id,
          content:    input.text.slice(0, 4000),
          type:       'TEXT',
          metadata:   { source: input.source, escalationId: esc?.id ?? null, sid: input.sid ?? null } as any,
        },
      });
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${supportBot.id}`).emit('message:new', {
          id: msg.id, senderId: user.id, receiverId: supportBot.id,
          content: msg.content, type: 'TEXT', isRead: false,
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
    return;
  }
  const reply = matched
    ? `🔐 This number is not verified on your *tazdan* account yet.\n\nVerify it in the app (Settings → Phone), or reply *send code*, before using WhatsApp support.`
    : `👋 Welcome to *tazdan*!\n\n` +
      `It looks like this number isn't linked to an account yet.\n\n` +
      `📲 Download the app or visit *tazdan.com* to register.\n\n` +
      `Reply *help* to see what I can do.`;
  await sendWhatsAppText({ to: phone, body: reply });
}

/** Inbound Meta webhooks need the app secret; production refuses them without it. */
export function metaInboundAuth(req: AuthRequest): 'ok' | 'unconfigured' | 'bad_signature' {
  if (process.env.META_WA_APP_SECRET) {
    const sig = req.headers['x-hub-signature-256'] as string | undefined;
    // index.ts captures the exact bytes Meta signed. Without them nothing verifies.
    const raw = (req as any).rawBody as string | undefined;
    return raw !== undefined && validateMetaSignature({ signatureHeader: sig, rawBody: raw }) ? 'ok' : 'bad_signature';
  }
  return process.env.NODE_ENV === 'production' ? 'unconfigured' : 'ok';
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
      // Validate the Twilio signature. Without Twilio credentials the
      // signature cannot be checked, so production refuses the webhook rather
      // than trusting a spoofable `From` number.
      if (!isTwilioConfigured() && process.env.NODE_ENV === 'production') {
        void recordSecurityEvent({ type: 'WEBHOOK_REJECTED', severity: 'MEDIUM', ipAddress: req.ip, path: req.originalUrl, details: { reason: 'twilio_not_configured' } });
        res.status(503).send('Unavailable');
        return;
      }
      if (isTwilioConfigured()) {
        const sig = req.headers['x-twilio-signature'] as string | undefined;
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        const valid = validateTwilioSignature({ signature: sig, url, params: req.body });
        if (!valid) {
          void recordSecurityEvent({ type: 'WEBHOOK_REJECTED', severity: 'HIGH', ipAddress: req.ip, path: req.originalUrl, details: { reason: 'bad_twilio_signature' } });
          res.status(403).send('Forbidden');
          return;
        }
      }

      const { From: fromRaw, Body: body, MessageSid } = req.body ?? {};
      if (typeof fromRaw !== 'string' || typeof body !== 'string' || !fromRaw || !body) { res.sendStatus(204); return; }

      await handleInboundWhatsApp(req, { from: fromRaw, text: body, sid: typeof MessageSid === 'string' ? MessageSid : undefined, source: 'whatsapp' });

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
    const token     = typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : '';
    const challenge = typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : '';
    const expected  = process.env.META_WA_VERIFY_TOKEN ?? '';

    const tokenOk = expected.length > 0 && token.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    // Echo only Meta's short alphanumeric challenge, as plain text, so the
    // handshake can never reflect markup.
    if (mode === 'subscribe' && tokenOk && /^[A-Za-z0-9_-]{1,128}$/.test(challenge)) {
      res.status(200).type('text/plain').send(challenge);
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
      // Authenticate BEFORE anything is stored or answered. The old handler
      // only checked the signature when outbound Meta sending was configured,
      // so a Twilio-only deployment accepted forged messages "from" any
      // customer's number straight into that customer's support thread.
      const auth = metaInboundAuth(req);
      if (auth !== 'ok') {
        void recordSecurityEvent({ type: 'WEBHOOK_REJECTED', severity: auth === 'unconfigured' ? 'MEDIUM' : 'HIGH', ipAddress: req.ip, path: req.originalUrl, details: { reason: auth === 'unconfigured' ? 'meta_not_configured' : 'bad_meta_signature' } });
        res.status(auth === 'unconfigured' ? 503 : 403).send(auth === 'unconfigured' ? 'Unavailable' : 'Forbidden');
        return;
      }

      // ALWAYS 200 quickly — Meta retries on non-2xx.
      res.sendStatus(200);

      const entries = (Array.isArray(req.body?.entry) ? req.body.entry : []).slice(0, 50) as any[];
      for (const entry of entries) {
        for (const change of (Array.isArray(entry?.changes) ? entry.changes : []).slice(0, 50)) {
          const messages = (Array.isArray(change?.value?.messages) ? change.value.messages : []).slice(0, 50);
          for (const m of messages) {
            const from = m?.from;
            const text = m?.text?.body;
            const sid  = m?.id;
            if (typeof from !== 'string' || typeof text !== 'string' || !from || !text) continue;
            await handleInboundWhatsApp(req, { from, text, sid: typeof sid === 'string' ? sid : undefined, source: 'whatsapp-meta' });
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
