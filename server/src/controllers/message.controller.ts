/**
 * MessageController — full CRUD for in-app messaging plus auxiliary
 * surfaces (block / unblock, report, support escalation).
 *
 * Real-time: every mutating endpoint emits a Socket.IO event into both
 * participants' user rooms (`user:{id}`) so connected clients update
 * instantly. The ws layer is wired up in `services/socket.ts`.
 *
 * Edit window: a sender may edit the body of a TEXT message for
 * EDIT_WINDOW_MS after creation. After that the bubble is locked.
 *
 * Delete: soft only — sets `deletedAt`, blanks `content`. Threads still
 * render the bubble with "Message deleted" so the audit trail is
 * preserved server-side.
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Server as IOServer } from 'socket.io';

import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { TransactionController } from './transaction.controller';

const EDIT_WINDOW_MS = 5 * 60_000;

/** Surface-level shape returned to mobile clients. */
type WireMessage = ReturnType<typeof toWire>;

function toWire(m: any) {
  return {
    id:         m.id,
    senderId:   m.senderId,
    receiverId: m.receiverId,
    content:    m.deletedAt ? '' : m.content,
    type:       m.type,
    metadata:   m.metadata ?? null,
    isRead:     m.isRead,
    readAt:     m.readAt,
    editedAt:   m.editedAt,
    deletedAt:  m.deletedAt,
    tradeId:    m.tradeId ?? null,
    createdAt:  m.createdAt,
  };
}

function emit(req: AuthRequest, userIds: string[], event: string, payload: any) {
  const io = req.app.get('io') as IOServer | undefined;
  if (!io) return;
  for (const uid of new Set(userIds)) io.to(`user:${uid}`).emit(event, payload);
}

/** Throws if either party has blocked the other. */
async function assertNotBlocked(a: string, b: string) {
  const block = await (prisma as any).userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  if (block) {
    throw new AppError('You can no longer message this user', 403);
  }
}

// ── Schemas ─────────────────────────────────────────────────────────

const sendSchema = z.object({
  receiverId: z.string().uuid(),
  content:    z.string().min(1).max(4_000),
  type:       z.enum(['TEXT', 'PAYMENT', 'P2P_NOTE']).default('TEXT'),
  /** PAYMENT: { amount, currency, txRef? }. Free-form for other types. */
  metadata:   z.record(z.any()).optional(),
  tradeId:    z.string().uuid().optional(),
});

const editSchema = z.object({
  content: z.string().min(1).max(4_000),
});

const blockSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

const reportSchema = z.object({
  reportedUserId: z.string().uuid(),
  messageId:      z.string().uuid().optional(),
  reason:         z.string().min(2).max(120),
  details:        z.string().max(2_000).optional(),
});

const escalateSchema = z.object({
  counterpartyId: z.string().uuid(),
  tradeId:        z.string().uuid().optional(),
  reason:         z.string().min(2).max(120),
  details:        z.string().max(2_000).optional(),
});

// ── Controller ──────────────────────────────────────────────────────

export class MessageController {
  /** POST /api/messages — send a TEXT, PAYMENT_NOTE, or P2P_NOTE. */
  static async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = sendSchema.parse(req.body);
      const senderId = req.user!.id;
      if (data.receiverId === senderId) throw new AppError('Cannot message yourself', 400);

      await assertNotBlocked(senderId, data.receiverId);

      const receiver = await prisma.user.findUnique({
        where: { id: data.receiverId },
        select: { id: true },
      });
      if (!receiver) throw new AppError('Recipient not found', 404);

      let transferData: any = null;
      let senderTxId: string | null = null;
      let receiverTxId: string | null = null;

      // PAYMENT messages trigger a real wallet-to-wallet transfer.
      if (data.type === 'PAYMENT') {
        const m = data.metadata ?? {};
        if (typeof m.amount !== 'number' || !m.currency) {
          throw new AppError('PAYMENT messages require metadata.amount and metadata.currency', 400);
        }

        // Execute the transfer atomically.
        // Enum currencies (BTC, ETH, SOL …) use the Wallet table.
        // Altcoins (PEPE, SHIB, SKY …) use UserWallet.altBalances JSON.
        const amountNum = m.amount;
        const currency: string = m.currency;
        const feeNum = 0;
        const totalDeduction = amountNum + feeNum;

        // Currencies that exist in the Prisma Currency enum
        const ENUM_CURRENCIES = new Set([
          'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
          'USD','EUR','GBP','AED','SAR','EGP','LYD',
        ]);
        const isEnumCurrency = ENUM_CURRENCIES.has(currency);

        const result = await prisma.$transaction(async (tx) => {
          const reference = `TRF-${require('uuid').v4().slice(0, 8).toUpperCase()}`;

          let senderBalBefore = 0;
          let senderBalAfter  = 0;
          let receiverBalBefore = 0;
          let receiverBalAfter  = 0;

          if (isEnumCurrency) {
            // ── Enum path: use Wallet table ────────────────────────────
            const [senderWallet, receiverWallet] = await Promise.all([
              tx.wallet.upsert({
                where: { userId_currency: { userId: senderId, currency: currency as any } },
                create: { userId: senderId, currency: currency as any, balance: 0, frozen: 0 },
                update: {},
              }),
              tx.wallet.upsert({
                where: { userId_currency: { userId: data.receiverId, currency: currency as any } },
                create: { userId: data.receiverId, currency: currency as any, balance: 0, frozen: 0 },
                update: {},
              }),
            ]);

            senderBalBefore   = Number(senderWallet.balance);
            receiverBalBefore = Number(receiverWallet.balance);
            const available   = senderBalBefore - Number(senderWallet.frozen ?? 0);

            if (available < totalDeduction) {
              throw new AppError(`Insufficient ${currency} balance. Available: ${available}`, 400);
            }

            senderBalAfter   = senderBalBefore - totalDeduction;
            receiverBalAfter = receiverBalBefore + amountNum;

            await Promise.all([
              tx.wallet.update({ where: { id: senderWallet.id },   data: { balance: senderBalAfter } }),
              tx.wallet.update({ where: { id: receiverWallet.id }, data: { balance: receiverBalAfter } }),
            ]);
          } else {
            // ── Altcoin path: use UserWallet.altBalances JSON ──────────
            const [senderUW, receiverUW] = await Promise.all([
              tx.userWallet.findUnique({ where: { userId: senderId } }),
              tx.userWallet.findUnique({ where: { userId: data.receiverId } }),
            ]);

            const senderAlts   = (senderUW?.altBalances   && typeof senderUW.altBalances   === 'object' ? senderUW.altBalances   : {}) as Record<string, string>;
            const receiverAlts = (receiverUW?.altBalances && typeof receiverUW.altBalances === 'object' ? receiverUW.altBalances : {}) as Record<string, string>;

            senderBalBefore   = parseFloat(senderAlts[currency]   ?? '0');
            receiverBalBefore = parseFloat(receiverAlts[currency] ?? '0');
            const available   = senderBalBefore;

            if (available < totalDeduction) {
              throw new AppError(`Insufficient ${currency} balance. Available: ${available}`, 400);
            }

            senderBalAfter   = senderBalBefore - totalDeduction;
            receiverBalAfter = receiverBalBefore + amountNum;

            const newSenderAlts   = { ...senderAlts,   [currency]: senderBalAfter.toFixed(8) };
            const newReceiverAlts = { ...receiverAlts, [currency]: receiverBalAfter.toFixed(8) };

            if (!senderUW)   throw new AppError('Sender crypto wallet not found', 404);
            if (!receiverUW) throw new AppError('Receiver crypto wallet not found', 404);

            await Promise.all([
              tx.userWallet.update({ where: { userId: senderId },          data: { altBalances: newSenderAlts } }),
              tx.userWallet.update({ where: { userId: data.receiverId }, data: { altBalances: newReceiverAlts } }),
            ]);
          }

          // Transfer record — always uses USDT as the ledger currency for altcoins
          const transfer = await tx.transfer.create({
            data: {
              senderId,
              receiverId: data.receiverId,
              currency: isEnumCurrency ? (currency as any) : 'USDT',
              amount: amountNum,
              fee: feeNum,
              reference,
              note: m.note || undefined,
            },
          });

          // Transactions — currency field uses USDT for altcoins; asset stored in metadata
          const senderTx = await tx.transaction.create({
            data: {
              userId: senderId,
              type: 'TRANSFER_OUT',
              currency: isEnumCurrency ? (currency as any) : 'USDT',
              amount: amountNum,
              fee: feeNum,
              balanceBefore: senderBalBefore,
              balanceAfter:  senderBalAfter,
              reference,
              description: m.note ? `Transfer: ${m.note}` : `Transfer to ${data.receiverId}`,
              metadata: { transferId: transfer.id, receiverId: data.receiverId, note: m.note, asset: currency },
            },
          });

          const receiverTx = await tx.transaction.create({
            data: {
              userId: data.receiverId,
              type: 'TRANSFER_IN',
              currency: isEnumCurrency ? (currency as any) : 'USDT',
              amount: amountNum,
              fee: 0,
              balanceBefore: receiverBalBefore,
              balanceAfter:  receiverBalAfter,
              reference,
              description: m.note ? `Transfer: ${m.note}` : `Transfer from ${senderId}`,
              metadata: { transferId: transfer.id, senderId, note: m.note, asset: currency },
            },
          });

          return { transfer, senderTx, receiverTx };
        });

        transferData = result.transfer;
        senderTxId = result.senderTx.id;
        receiverTxId = result.receiverTx.id;

        // Update message metadata with the real transaction reference
        m.txRef = transferData.reference;
        m.status = 'COMPLETED';
        data.metadata = m;
      }

      const msg = await prisma.message.create({
        data: {
          senderId,
          receiverId: data.receiverId,
          content:    data.content,
          type:       data.type,
          metadata:   data.metadata as any,
          tradeId:    data.tradeId,
          transferId: transferData?.id,
          senderTxId: senderTxId ?? undefined,
          receiverTxId: receiverTxId ?? undefined,
        },
      });

      const wire = toWire(msg);
      emit(req, [senderId, data.receiverId], 'message:new', wire);

      res.status(201).json({ message: wire });
    } catch (e) { next(e); }
  }

  /** GET /api/messages/conversations — list of distinct chat partners + last message + unread count. */
  static async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Pull every message I'm a party to; we'll fold to one row per partner in memory.
      const rows = await prisma.message.findMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      type Bucket = {
        partnerId: string;
        last: typeof rows[number];
        unread: number;
      };
      const byPartner = new Map<string, Bucket>();
      for (const m of rows) {
        const partnerId = m.senderId === userId ? m.receiverId : m.senderId;
        const bucket = byPartner.get(partnerId);
        if (!bucket) {
          byPartner.set(partnerId, {
            partnerId,
            last: m,
            unread: m.receiverId === userId && !m.isRead ? 1 : 0,
          });
        } else if (m.receiverId === userId && !m.isRead) {
          bucket.unread += 1;
        }
      }

      const partnerIds = [...byPartner.keys()];
      const partners = await prisma.user.findMany({
        where: { id: { in: partnerIds } },
        select: {
          id: true, firstName: true, lastName: true, username: true,
          avatarUrl: true, role: true, kycStatus: true,
        },
      });
      const partnerMap = new Map(partners.map((p) => [p.id, p]));

      const conversations = [...byPartner.values()]
        .map((b) => ({
          partner: partnerMap.get(b.partnerId) ?? { id: b.partnerId },
          lastMessage: toWire(b.last),
          unread: b.unread,
        }))
        .sort((a, b) => +new Date(b.lastMessage.createdAt) - +new Date(a.lastMessage.createdAt));

      res.json({ conversations });
    } catch (e) { next(e); }
  }

  /** GET /api/messages/:userId — full thread between me and :userId. */
  static async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const { userId } = req.params;

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: me,     receiverId: userId },
            { senderId: userId, receiverId: me },
          ],
        },
        orderBy: { createdAt: 'asc' },
      });

      // Mark inbound unread as read in a single batch.
      const unread = messages.filter((m) => m.receiverId === me && !m.isRead).map((m) => m.id);
      if (unread.length) {
        await prisma.message.updateMany({
          where: { id: { in: unread } },
          data:  { isRead: true, readAt: new Date() },
        });
        emit(req, [userId], 'message:read', { by: me, ids: unread });
      }

      res.json({ messages: messages.map(toWire) });
    } catch (e) { next(e); }
  }

  /** PATCH /api/messages/:id — edit own TEXT message within EDIT_WINDOW_MS. */
  static async edit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = editSchema.parse(req.body);
      const { id } = req.params;
      const me = req.user!.id;

      const existing = await prisma.message.findUnique({ where: { id } });
      if (!existing) throw new AppError('Message not found', 404);
      if (existing.senderId !== me) throw new AppError('Not your message', 403);
      if (existing.deletedAt) throw new AppError('Message was deleted', 400);
      if (existing.type !== 'TEXT') throw new AppError('Only text messages can be edited', 400);
      if (Date.now() - +new Date(existing.createdAt) > EDIT_WINDOW_MS) {
        throw new AppError('Edit window has expired', 400);
      }

      const updated = await prisma.message.update({
        where: { id },
        data:  { content: data.content, editedAt: new Date() },
      });
      const wire = toWire(updated);
      emit(req, [updated.senderId, updated.receiverId], 'message:update', wire);
      res.json({ message: wire });
    } catch (e) { next(e); }
  }

  /** DELETE /api/messages/:id — soft delete own message. */
  static async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const me = req.user!.id;

      const existing = await prisma.message.findUnique({ where: { id } });
      if (!existing) throw new AppError('Message not found', 404);
      if (existing.senderId !== me) throw new AppError('Not your message', 403);
      if (existing.deletedAt) return res.json({ message: toWire(existing) });

      const updated = await prisma.message.update({
        where: { id },
        data:  { deletedAt: new Date(), content: '' },
      });
      const wire = toWire(updated);
      emit(req, [updated.senderId, updated.receiverId], 'message:delete', wire);
      res.json({ message: wire });
    } catch (e) { next(e); }
  }

  /** POST /api/messages/read/:userId — explicit mark-as-read. */
  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const { userId } = req.params;
      const result = await prisma.message.updateMany({
        where: { senderId: userId, receiverId: me, isRead: false },
        data:  { isRead: true, readAt: new Date() },
      });
      emit(req, [userId], 'message:read', { by: me, partnerId: me });
      res.json({ updated: result.count });
    } catch (e) { next(e); }
  }

  // ── Block / unblock ─────────────────────────────────────────────

  /** POST /api/messages/block — create a block on another user. */
  static async block(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = blockSchema.parse(req.body);
      const me = req.user!.id;
      if (data.userId === me) throw new AppError('Cannot block yourself', 400);

      const block = await (prisma as any).userBlock.upsert({
        where:  { blockerId_blockedId: { blockerId: me, blockedId: data.userId } },
        update: { reason: data.reason },
        create: { blockerId: me, blockedId: data.userId, reason: data.reason },
      });
      emit(req, [me, data.userId], 'block:new', { blockerId: me, blockedId: data.userId });
      res.status(201).json({ block });
    } catch (e) { next(e); }
  }

  /** DELETE /api/messages/block/:userId — remove a block I created. */
  static async unblock(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const { userId } = req.params;
      await (prisma as any).userBlock.deleteMany({
        where: { blockerId: me, blockedId: userId },
      });
      emit(req, [me, userId], 'block:remove', { blockerId: me, blockedId: userId });
      res.json({ ok: true });
    } catch (e) { next(e); }
  }

  /** GET /api/messages/blocks — list users I have blocked. */
  static async listBlocks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const blocks = await (prisma as any).userBlock.findMany({
        where: { blockerId: me },
        include: {
          blocked: { select: { id: true, firstName: true, lastName: true, username: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ blocks });
    } catch (e) { next(e); }
  }

  // ── Reports ──────────────────────────────────────────────────────

  /** POST /api/messages/report — report a message or a user. */
  static async report(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = reportSchema.parse(req.body);
      const me = req.user!.id;
      if (data.reportedUserId === me) throw new AppError('Cannot report yourself', 400);

      // If a messageId is given, validate it actually belongs to the
      // accused user — prevents reporting unrelated content.
      if (data.messageId) {
        const m = await prisma.message.findUnique({ where: { id: data.messageId } });
        if (!m) throw new AppError('Message not found', 404);
        if (m.senderId !== data.reportedUserId) {
          throw new AppError('Message does not belong to reported user', 400);
        }
      }

      const report = await (prisma as any).messageReport.create({
        data: {
          reporterId:     me,
          reportedUserId: data.reportedUserId,
          messageId:      data.messageId,
          reason:         data.reason,
          details:        data.details,
        },
      });
      res.status(201).json({ report });
    } catch (e) { next(e); }
  }

  // ── Support escalation ──────────────────────────────────────────

  /**
   * POST /api/messages/escalate — pull a P2P / DM thread into a
   * support escalation. We:
   *   1. Create a `SupportEscalation` row.
   *   2. Drop a SYSTEM message into the original thread so both
   *      participants see "Escalated to support".
   *   3. Open a new thread with the support seed user containing the
   *      reason + a deep-link reference.
   */
  static async escalate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = escalateSchema.parse(req.body);
      const me = req.user!.id;
      if (data.counterpartyId === me) throw new AppError('Counterparty cannot be yourself', 400);

      const support = await prisma.user.findFirst({
        where: { username: 'support' },
        select: { id: true },
      });
      if (!support) throw new AppError('Support user not provisioned', 500);

      const escalation = await (prisma as any).supportEscalation.create({
        data: {
          raisedById:     me,
          counterpartyId: data.counterpartyId,
          tradeId:        data.tradeId,
          reason:         data.reason,
          details:        data.details,
        },
      });

      // 1) System notice in the original thread
      const sysMsg = await prisma.message.create({
        data: {
          senderId:   support.id,
          receiverId: me,
          content:    `Escalation #${escalation.id.slice(0, 8)} opened. A support agent will respond shortly.`,
          type:       'SYSTEM',
          metadata:   { escalationId: escalation.id, tradeId: data.tradeId ?? null },
          tradeId:    data.tradeId,
        },
      });
      const sysMsg2 = await prisma.message.create({
        data: {
          senderId:   support.id,
          receiverId: data.counterpartyId,
          content:    `Escalation #${escalation.id.slice(0, 8)} opened by your trade counterparty.`,
          type:       'SYSTEM',
          metadata:   { escalationId: escalation.id, tradeId: data.tradeId ?? null },
          tradeId:    data.tradeId,
        },
      });

      // 2) Opening message in the support DM thread
      const opener = await prisma.message.create({
        data: {
          senderId:   me,
          receiverId: support.id,
          content:    `${data.reason}${data.details ? `\n\n${data.details}` : ''}`,
          type:       'ESCALATION',
          metadata:   { escalationId: escalation.id, tradeId: data.tradeId ?? null, counterpartyId: data.counterpartyId },
          tradeId:    data.tradeId,
        },
      });

      emit(req, [me, data.counterpartyId, support.id], 'message:new', toWire(sysMsg));
      emit(req, [me, data.counterpartyId, support.id], 'message:new', toWire(sysMsg2));
      emit(req, [me, support.id],                     'message:new', toWire(opener));
      emit(req, [me, data.counterpartyId, support.id], 'escalation:new', { escalation });

      res.status(201).json({ escalation, supportThreadWith: support.id });
    } catch (e) { next(e); }
  }
}
