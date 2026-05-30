/**
 * Claim-link transfers — send to anyone, even users without a Fortuni
 * account. The sender's wallet is debited immediately and held in a
 * reserved bucket; the recipient receives a one-tap claim URL.
 *
 *   POST   /api/claim-links                — create a new claim link
 *   GET    /api/claim-links/by-token/:token — public preview (no auth)
 *   POST   /api/claim-links/by-token/:token/claim — authed recipient claims
 *   POST   /api/claim-links/:id/cancel     — sender cancels + refunds
 *   GET    /api/claim-links/mine           — list the caller's outgoing links
 *   POST   /api/claim-links/sweep          — internal: refund any expired
 *
 * Differentiator philosophy: this should feel magical to the recipient
 * (a stranger gets a beautifully framed "you have crypto waiting") and
 * boring to the sender (it's just another "Sent" row in their history).
 * Both ends should feel safer than venmo: hard-cancel before claim,
 * 7-day expiry default, optional PIN, no PII leaking in URL.
 */

import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import {
  sendClaimLinkPending,
  sendClaimLinkClaimedSenderCopy,
} from '../services/email';
import { pushCopy, pushTxEvent } from '../services/push.service';
import { Currency, ClaimLinkStatus } from '@prisma/client';

const SUPPORTED_ASSETS = [
  'USDT', 'USD', 'LYD', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP',
  'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
] as const;

const MAX_EXPIRY_DAYS = 30;
const DEFAULT_EXPIRY_DAYS = 7;

const createSchema = z.object({
  asset:           z.enum(SUPPORTED_ASSETS).default('USDT'),
  amount:          z.number().positive(),
  recipientEmail:  z.string().email().optional(),
  recipientPhone:  z.string().min(6).max(20).optional(),
  recipientHandle: z.string().min(3).max(30).optional(),
  note:            z.string().max(200).optional(),
  expiresInDays:   z.number().int().min(1).max(MAX_EXPIRY_DAYS).optional(),
  pin:             z.string().min(4).max(8).regex(/^\d+$/).optional(),
}).refine(
  (d) => d.recipientEmail || d.recipientPhone || d.recipientHandle,
  { message: 'recipientEmail, recipientPhone, or recipientHandle is required' },
);

const claimSchema = z.object({
  pin: z.string().min(4).max(8).optional(),
});

function genToken(): string {
  // 24 bytes → 48 hex chars; safe for URL, no padding, no ambiguous chars.
  // Base32 would be friendlier but URL-encoded hex is enough for first
  // version. Routinely guess-resistant.
  return crypto.randomBytes(24).toString('hex');
}

function hashPin(pin: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

function shortPublicId(token: string): string {
  return token.slice(0, 10);
}

function resolvePublicBase(): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.trim();
  if (process.env.CLIENT_URL) {
    // CLIENT_URL may be a comma-separated CORS list — take the first origin.
    const first = process.env.CLIENT_URL.split(',')[0].trim();
    return first;
  }
  return 'https://Fortuni.com';
}

const PUBLIC_BASE = resolvePublicBase();

export class ClaimLinkController {
  /* ─────────────────────────────────────────────────────────────
     POST /api/claim-links — create + reserve + notify recipient
  ───────────────────────────────────────────────────────────── */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = createSchema.parse(req.body);
      const senderId = req.user!.id;

      const currency = body.asset as Currency;
      const asset    = body.asset;

      // Sender wallet check + reservation under a single transaction
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, email: true, firstName: true, username: true },
      });
      if (!sender) throw new AppError('Sender not found', 404);

      const senderWallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: senderId, currency } },
      });
      if (!senderWallet) throw new AppError(`${asset} wallet not found`, 404);

      const balance = parseFloat(senderWallet.balance.toString());
      const frozen  = parseFloat(senderWallet.frozen.toString());
      const available = balance - frozen;
      if (body.amount > available) {
        throw new AppError(`Insufficient ${asset}. Available: ${available.toFixed(8)}`, 400);
      }

      const expiresInDays = body.expiresInDays ?? DEFAULT_EXPIRY_DAYS;
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const token = genToken();
      const pinHash = body.pin ? hashPin(body.pin, token.slice(0, 16)) : null;

      // If recipient handle is provided AND matches an existing user, we
      // could short-circuit to a normal transfer. We don't — the explicit
      // claim flow gives the sender a cancel window and makes the
      // recipient's tap feel intentional. Same behaviour either way.

      const link = await prisma.$transaction(async (tx) => {
        // Reserve the funds: increment frozen, balance stays put so the
        // refund path is a trivial decrement. The user's spendable
        // balance shrinks by `amount`.
        await tx.wallet.update({
          where: { id: senderWallet.id },
          data: { frozen: { increment: new Decimal(body.amount) } },
        });
        return tx.claimLink.create({
          data: {
            senderId,
            recipientEmail:  body.recipientEmail ?? null,
            recipientPhone:  body.recipientPhone ?? null,
            recipientHandle: body.recipientHandle?.replace(/^@/, '').toLowerCase() ?? null,
            asset:           currency,
            amount:          new Decimal(body.amount),
            note:            body.note ?? null,
            claimToken:      token,
            pinHash,
            expiresAt,
          },
        });
      });

      // Build the user-facing claim URL.
      const claimUrl = `${PUBLIC_BASE}/claim/${link.claimToken}`;

      // Notify the recipient by email if we have one. Phone / SMS would
      // route through a separate vendor (Twilio) — wire it in the same
      // place when ready.
      if (body.recipientEmail) {
        (async () => {
          try {
            await sendClaimLinkPending({
              to:           body.recipientEmail!,
              senderFirst:  sender.firstName ?? '',
              senderHandle: sender.username ?? '',
              asset,
              amount:       body.amount.toString(),
              note:         body.note,
              claimUrl,
              expiresAt,
              hasPin:       !!body.pin,
            });
            await prisma.claimLink.update({
              where: { id: link.id },
              data:  { notifiedAt: new Date() },
            });
          } catch (err) {
            logger.warn('[claimLink.create] recipient email failed', { linkId: link.id, err });
          }
        })();
      }

      res.status(201).json({
        link: {
          id:           link.id,
          claimToken:   link.claimToken,
          shortId:      shortPublicId(link.claimToken),
          asset,
          amount:       body.amount.toString(),
          status:       link.status,
          expiresAt:    link.expiresAt,
          claimUrl,
          recipientEmail:  link.recipientEmail,
          recipientPhone:  link.recipientPhone,
          recipientHandle: link.recipientHandle,
          note:         link.note,
          hasPin:       !!body.pin,
        },
      });
    } catch (e) { next(e); }
  }

  /* ─────────────────────────────────────────────────────────────
     GET /api/claim-links/by-token/:token — public preview
     Used by the claim screen BEFORE the recipient signs in, so the
     response must not leak PII beyond what the sender chose to send.
  ───────────────────────────────────────────────────────────── */
  static async previewByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const link = await prisma.claimLink.findUnique({
        where: { claimToken: token },
        include: { sender: { select: { firstName: true, username: true, avatarUrl: true } } },
      });
      if (!link) throw new AppError('Claim link not found', 404);

      const now = Date.now();
      const isExpired = link.expiresAt.getTime() < now;
      const status: ClaimLinkStatus = isExpired && link.status === 'PENDING' ? 'EXPIRED' : link.status;

      res.json({
        preview: {
          asset:        link.asset,
          amount:       link.amount.toString(),
          note:         link.note,
          status,
          expiresAt:    link.expiresAt,
          hasPin:       !!link.pinHash,
          sender: {
            firstName: link.sender.firstName ?? '',
            handle:    link.sender.username ?? null,
            avatarUrl: link.sender.avatarUrl ?? null,
          },
        },
      });
    } catch (e) { next(e); }
  }

  /* ─────────────────────────────────────────────────────────────
     POST /api/claim-links/by-token/:token/claim — claim it
     Recipient must be authed (a fresh signup path lands here too).
  ───────────────────────────────────────────────────────────── */
  static async claim(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const body = claimSchema.parse(req.body ?? {});
      const claimerId = req.user!.id;

      const link = await prisma.claimLink.findUnique({
        where: { claimToken: token },
        select: {
          id: true, senderId: true, asset: true, amount: true,
          status: true, expiresAt: true, pinHash: true, claimToken: true,
          recipientEmail: true, recipientPhone: true, recipientHandle: true,
        },
      });
      if (!link) throw new AppError('Claim link not found', 404);
      if (link.senderId === claimerId) throw new AppError('You cannot claim your own link', 400);
      if (link.status !== 'PENDING') throw new AppError(`Claim link is ${link.status.toLowerCase()}`, 400);
      if (link.expiresAt.getTime() < Date.now()) {
        // Auto-flip to EXPIRED + refund sender atomically.
        await ClaimLinkController._refundExpired(link.id);
        throw new AppError('Claim link has expired', 400);
      }

      // RECIPIENT BINDING.  If the sender specified an intended
      // recipient (email / phone / handle), only that user may claim.
      // Previously *any* signed-in user could redeem any link they
      // got hold of — phishing the URL was enough to drain the gift.
      // When no recipient is specified the link is treated as
      // "first-to-claim wins" (the original behaviour, used for
      // public QR-handout flows).
      const hasBinding = !!(link.recipientEmail || link.recipientPhone || link.recipientHandle);
      if (hasBinding) {
        const claimer = await prisma.user.findUnique({
          where: { id: claimerId },
          select: { email: true, phone: true, username: true },
        });
        const emailMatch  = link.recipientEmail && claimer?.email && claimer.email.toLowerCase() === link.recipientEmail.toLowerCase();
        const phoneMatch  = link.recipientPhone && claimer?.phone && claimer.phone === link.recipientPhone;
        const handleMatch = link.recipientHandle && claimer?.username && claimer.username.toLowerCase() === link.recipientHandle.toLowerCase().replace(/^@/, '');
        if (!emailMatch && !phoneMatch && !handleMatch) {
          // Generic 403 so an attacker can't enumerate which field was
          // set on the link.
          throw new AppError('This claim link is for a different account', 403);
        }
      }

      if (link.pinHash) {
        if (!body.pin) throw new AppError('PIN required', 401);
        const expected = hashPin(body.pin, link.claimToken.slice(0, 16));
        if (expected !== link.pinHash) throw new AppError('Incorrect PIN', 401);
      }

      const result = await prisma.$transaction(async (tx) => {
        // Release sender's frozen amount + decrement balance.
        const senderWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: link.senderId, currency: link.asset } },
        });
        if (!senderWallet) throw new AppError('Sender wallet missing', 500);
        await tx.wallet.update({
          where: { id: senderWallet.id },
          data: {
            balance: { decrement: link.amount },
            frozen:  { decrement: link.amount },
          },
        });

        // Credit recipient (upsert their wallet if they didn't have one).
        const recipientWalletExisting = await tx.wallet.findUnique({
          where: { userId_currency: { userId: claimerId, currency: link.asset } },
        });
        const recipientBefore = recipientWalletExisting
          ? parseFloat(recipientWalletExisting.balance.toString())
          : 0;
        await tx.wallet.upsert({
          where: { userId_currency: { userId: claimerId, currency: link.asset } },
          update: { balance: { increment: link.amount } },
          create: { userId: claimerId, currency: link.asset, balance: link.amount },
        });

        // Ledger rows on both sides — paired by claim link id.
        const ref = `CLM-${link.id.slice(0, 10).toUpperCase()}`;
        const senderBalanceBefore = parseFloat(senderWallet.balance.toString());
        await tx.transaction.createMany({
          data: [
            {
              userId: link.senderId,
              type:   'TRANSFER_OUT',
              currency: link.asset,
              amount: new Decimal(`-${link.amount.toString()}`),
              balanceBefore: senderBalanceBefore,
              balanceAfter:  senderBalanceBefore - parseFloat(link.amount.toString()),
              reference: ref,
              description: `Claim link claimed by recipient`,
              metadata: { kind: 'claim_link', linkId: link.id } as any,
            },
            {
              userId: claimerId,
              type:   'TRANSFER_IN',
              currency: link.asset,
              amount: new Decimal(link.amount.toString()),
              balanceBefore: recipientBefore,
              balanceAfter:  recipientBefore + parseFloat(link.amount.toString()),
              reference: ref,
              description: `Claimed via Fortuni claim link`,
              metadata: { kind: 'claim_link', linkId: link.id } as any,
            },
          ],
        });

        const updated = await tx.claimLink.update({
          where: { id: link.id },
          data: {
            status:     'CLAIMED',
            claimedAt:  new Date(),
            claimedById: claimerId,
          },
        });
        return updated;
      });

      // Fire-and-forget — notify the sender that their gift was claimed.
      (async () => {
        try {
          const [sender, claimer] = await Promise.all([
            prisma.user.findUnique({
              where: { id: link.senderId },
              select: { email: true, firstName: true, username: true, notificationPrefs: true as any },
            }),
            prisma.user.findUnique({
              where: { id: claimerId },
              select: { firstName: true, username: true, email: true },
            }),
          ]);
          if (!sender || !claimer) return;
          const prefs = (sender as any).notificationPrefs ?? {};
          // Never fall back to email.split('@')[0] — the sender of the
          // claim link is reading this in their inbox; revealing the
          // claimer's email local-part is a PII leak.
          const claimerLabel = claimer.username
            ? `@${claimer.username}`
            : (claimer.firstName || 'a Fortuni user');
          if (prefs?.email?.transfers !== false) {
            await sendClaimLinkClaimedSenderCopy({
              to: sender.email,
              senderFirst:    sender.firstName || 'there',
              claimerLabel,
              asset:          link.asset,
              amount:         link.amount.toString(),
              linkId:         link.id,
            });
          }
          if (prefs?.push?.transfers !== false) {
            await pushTxEvent(
              link.senderId,
              pushCopy.sent(link.amount.toString(), link.asset, claimerLabel.replace(/^@/, '')),
              link.id,
            );
          }
        } catch (err) {
          logger.warn('[claimLink.claim] sender notify failed', { linkId: link.id, err });
        }
      })();

      res.json({
        link: {
          id:         result.id,
          status:     result.status,
          asset:      result.asset,
          amount:     result.amount.toString(),
          claimedAt:  result.claimedAt,
        },
      });
    } catch (e) { next(e); }
  }

  /* ─────────────────────────────────────────────────────────────
     POST /api/claim-links/:id/cancel — sender cancels + refunds
  ───────────────────────────────────────────────────────────── */
  static async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const link = await prisma.claimLink.findUnique({
        where: { id },
        select: { id: true, senderId: true, status: true, asset: true, amount: true },
      });
      if (!link) throw new AppError('Claim link not found', 404);
      if (link.senderId !== req.user!.id) throw new AppError('Not your link', 403);
      if (link.status !== 'PENDING') throw new AppError(`Cannot cancel — already ${link.status.toLowerCase()}`, 400);

      await prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { userId_currency: { userId: link.senderId, currency: link.asset } },
          data: { frozen: { decrement: link.amount } },
        });
        await tx.claimLink.update({
          where: { id: link.id },
          data: {
            status:       'CANCELLED',
            refundedAt:   new Date(),
            cancelReason: req.body?.reason ?? null,
          },
        });
      });

      res.json({ ok: true });
    } catch (e) { next(e); }
  }

  /* ─────────────────────────────────────────────────────────────
     GET /api/claim-links/mine — list caller's outgoing links
  ───────────────────────────────────────────────────────────── */
  static async listMine(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page  = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
      const status = (req.query.status as string | undefined)?.toUpperCase() as ClaimLinkStatus | undefined;
      const where: any = { senderId: req.user!.id };
      if (status && ['PENDING', 'CLAIMED', 'EXPIRED', 'CANCELLED'].includes(status)) {
        where.status = status;
      }
      const [items, total] = await Promise.all([
        prisma.claimLink.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.claimLink.count({ where }),
      ]);
      res.json({ items, total, page, pages: Math.ceil(total / limit) });
    } catch (e) { next(e); }
  }

  /* ─────────────────────────────────────────────────────────────
     POST /api/claim-links/sweep — internal cron: refund expired
     Stays admin/internal — typically called by a cron worker once
     a minute. Idempotent.
  ───────────────────────────────────────────────────────────── */
  static async sweepExpired(_req: Request, res: Response, next: NextFunction) {
    try {
      const expiredIds = await prisma.claimLink.findMany({
        where: { status: 'PENDING', expiresAt: { lt: new Date() } },
        select: { id: true },
        take: 200,
      });
      let refunded = 0;
      for (const { id } of expiredIds) {
        try {
          await ClaimLinkController._refundExpired(id);
          refunded++;
        } catch (err) {
          logger.warn('[claimLink.sweep] refund failed', { id, err });
        }
      }
      res.json({ refunded });
    } catch (e) { next(e); }
  }

  /* ───────────────────────── internal ───────────────────────── */
  private static async _refundExpired(linkId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const link = await tx.claimLink.findUnique({
        where: { id: linkId },
        select: { id: true, senderId: true, status: true, asset: true, amount: true, expiresAt: true },
      });
      if (!link) return;
      if (link.status !== 'PENDING') return;
      await tx.wallet.update({
        where: { userId_currency: { userId: link.senderId, currency: link.asset } },
        data: { frozen: { decrement: link.amount } },
      });
      await tx.claimLink.update({
        where: { id: linkId },
        data: { status: 'EXPIRED', refundedAt: new Date() },
      });
    });
  }
}
