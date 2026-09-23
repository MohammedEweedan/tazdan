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
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';
import { TransactionController } from './transaction.controller';
import { postLedger } from '../services/ledger/ledger.service';
import { postAssetLedger, normaliseAsset } from '../services/ledger/assetLedger.service';
import { parsePositiveAmount } from '../services/wallet/atomicWallet';
import {
  USER_WALLET_COLUMNS, moveAltBalance, moveUserWalletColumn, moveWalletBalance, type UserWalletColumn,
} from '../services/wallet/userTransfer';
import { enforceKycLimit } from '../utils/kycLimits';

const EDIT_WINDOW_MS = 5 * 60_000;

/** Surface-level shape returned to mobile clients. */
type WireMessage = ReturnType<typeof toWire>;
type MessagePrivacy = { readReceiptsOn: boolean; lastSeenOn: boolean };

function notificationPrefsOf(user: { notificationPrefs?: any } | null | undefined): any {
  return user?.notificationPrefs && typeof user.notificationPrefs === 'object' ? user.notificationPrefs : {};
}

function messagePrivacyOf(user: { notificationPrefs?: any } | null | undefined): MessagePrivacy {
  const prefs = notificationPrefsOf(user);
  const msg = prefs.messages && typeof prefs.messages === 'object' ? prefs.messages : {};
  return {
    readReceiptsOn: msg.readReceiptsOn !== false,
    lastSeenOn: msg.lastSeenOn !== false,
  };
}

function mergeMessagePrivacy(prefs: any, patch: Partial<MessagePrivacy>) {
  const base = prefs && typeof prefs === 'object' ? prefs : {};
  const msg = base.messages && typeof base.messages === 'object' ? base.messages : {};
  return {
    ...base,
    messages: {
      ...msg,
      ...(patch.readReceiptsOn != null ? { readReceiptsOn: patch.readReceiptsOn } : {}),
      ...(patch.lastSeenOn != null ? { lastSeenOn: patch.lastSeenOn } : {}),
    },
  };
}

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
  type:       z.enum(['TEXT', 'PAYMENT', 'REQUEST', 'STICKER', 'P2P_NOTE']).default('TEXT'),
  /** PAYMENT: { amount, currency, txRef? }. Free-form for other types. */
  metadata:   z.record(z.any()).optional(),
  tradeId:    z.string().uuid().optional(),
  /** Client-generated idempotency key — echoed back on the socket + HTTP
   *  payloads so the sender can reliably replace its optimistic placeholder
   *  (no fragile content-matching). Not persisted. */
  clientId:   z.string().max(64).optional(),
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

const privacySchema = z.object({
  readReceiptsOn: z.boolean().optional(),
  lastSeenOn: z.boolean().optional(),
}).refine((v) => v.readReceiptsOn != null || v.lastSeenOn != null, {
  message: 'No privacy setting provided',
});

// ── Controller ──────────────────────────────────────────────────────

export class MessageController {
  /** GET /api/messages/privacy — current user's chat privacy prefs. */
  static async getPrivacy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { notificationPrefs: true },
      });
      res.json({ privacy: messagePrivacyOf(me) });
    } catch (e) { next(e); }
  }

  /** PUT /api/messages/privacy — toggle read receipts / last seen. */
  static async updatePrivacy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const patch = privacySchema.parse(req.body);
      const current = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { notificationPrefs: true },
      });
      const updated = await prisma.user.update({
        where: { id: req.user!.id },
        data: { notificationPrefs: mergeMessagePrivacy(current?.notificationPrefs, patch) },
        select: { notificationPrefs: true },
      });
      res.json({ privacy: messagePrivacyOf(updated) });
    } catch (e) { next(e); }
  }

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
        //
        // Balance storage in this codebase is split across TWO tables:
        //   1. `UserWallet`   — has dedicated decimal columns for the
        //      on-chain crypto we self-custody: ethBalance, btcBalance,
        //      solBalance, usdtErc20Bal, usdtTrc20Bal.  Anything else
        //      crypto sits in `altBalances` (JSON map).
        //   2. `Wallet`       — generic per-(userId, currency) row used
        //      for fiat (USD, EUR, …) and as a ledger view of USDT.
        //
        // The mobile `/wallet/balances` endpoint reads from UserWallet
        // for crypto, so users see e.g. "8990 BTC" — but the legacy
        // chat-payment path was reading Wallet.balance for BTC, which
        // was always 0, hence "Insufficient BTC balance, Available: 0"
        // even though the user had thousands.  We now route each
        // currency to the table it actually lives in.
        // Validate before anything moves: a finite, positive amount only.
        const amountDec = parsePositiveAmount(m.amount, 'metadata.amount');
        const currency: string = String(m.currency).toUpperCase();
        const feeNum = 0;

        // Fiat (and bare-USDT) live in the `Wallet` table.
        const WALLET_TABLE_CURRENCIES = new Set([
          'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD', 'USDT',
        ]);
        // Crypto with a dedicated UserWallet column.
        const uwColumn = (USER_WALLET_COLUMNS as Record<string, UserWalletColumn>)[currency];
        const isWalletTable = WALLET_TABLE_CURRENCIES.has(currency);

        await enforceKycLimit(senderId, 'SEND', amountDec, currency.replace(/_(ERC20|TRC20)$/, ''));

        const result = await prisma.$transaction(async (tx) => {
          const reference = `TRF-${require('uuid').v4().slice(0, 8).toUpperCase()}`;

          // Each branch locks (or atomically checks) before it reads, so two
          // payments from the same wallet can never both spend one balance.
          const moved = isWalletTable
            ? await moveWalletBalance(tx, senderId, data.receiverId, currency, amountDec)
            : uwColumn
              ? await moveUserWalletColumn(tx, senderId, data.receiverId, uwColumn, currency, amountDec)
              : await moveAltBalance(tx, senderId, data.receiverId, currency, amountDec);
          const { senderBalBefore, senderBalAfter, receiverBalBefore, receiverBalAfter } = moved;

          // Pick the ledger-currency value safely.  Anything in the
          // Prisma Currency enum can be stored directly; off-enum
          // values (chain variants like USDT_TRC20, exotic alts)
          // collapse to the closest base — USDT for USDT_*, USDT for
          // altcoins (since they have no enum slot but we need
          // *something* to satisfy the column).  The true asset is
          // always preserved in `metadata.asset` for accurate audit.
          const PRISMA_CURRENCIES = new Set([
            'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
            'USD','EUR','GBP','AED','SAR','EGP','LYD',
          ]);
          const ledgerCurrency = PRISMA_CURRENCIES.has(currency)
            ? currency
            : (currency === 'USDT_ERC20' || currency === 'USDT_TRC20' ? 'USDT' : 'USDT');
          const canPostLedger = PRISMA_CURRENCIES.has(currency) || currency === 'USDT_ERC20' || currency === 'USDT_TRC20';

          const transfer = await tx.transfer.create({
            data: {
              senderId,
              receiverId: data.receiverId,
              currency: ledgerCurrency as any,
              amount: amountDec,
              fee: feeNum,
              reference,
              note: m.note || undefined,
            },
          });

          if (canPostLedger) {
            await postLedger(tx as any, {
              refType: 'message_payment',
              refId: reference,
              memo: `Message payment ${currency}`,
              legs: [
                { type: 'USER', userId: senderId, currency: ledgerCurrency as any, amount: amountDec.neg() },
                { type: 'USER', userId: data.receiverId, currency: ledgerCurrency as any, amount: amountDec },
              ],
            }, { allowNegativeUser: true });
          } else {
            const asset = normaliseAsset(currency);
            await postAssetLedger(tx as any, {
              refType: 'message_payment',
              refId: reference,
              memo: `Message payment ${asset}`,
              legs: [
                { type: 'USER', userId: senderId, asset, amount: amountDec.neg() },
                { type: 'USER', userId: data.receiverId, asset, amount: amountDec },
              ],
            }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
          }

          const senderTx = await tx.transaction.create({
            data: {
              userId: senderId,
              type: 'TRANSFER_OUT',
              currency: ledgerCurrency as any,
              amount: amountDec,
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
              currency: ledgerCurrency as any,
              amount: amountDec,
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

      // Echo the client's idempotency key (transient, not stored) so the
      // sender can match this row to its optimistic placeholder exactly.
      const wire = { ...toWire(msg), clientId: data.clientId ?? null };
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

      // Mark inbound unread as read only when the reader allows receipts.
      const myPrefs = await prisma.user.findUnique({
        where: { id: me },
        select: { notificationPrefs: true },
      });
      const canSendReadReceipt = messagePrivacyOf(myPrefs).readReceiptsOn;
      const unread = messages.filter((m) => m.receiverId === me && !m.isRead).map((m) => m.id);
      if (unread.length && canSendReadReceipt) {
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
      const myPrefs = await prisma.user.findUnique({
        where: { id: me },
        select: { notificationPrefs: true },
      });
      if (!messagePrivacyOf(myPrefs).readReceiptsOn) {
        return res.json({ updated: 0, suppressed: true });
      }
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
