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
import { Prisma } from '@prisma/client';
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
import { valueInUsd } from '../utils/kycLimits';
import { assertMovementAllowed } from '../services/platform/controls.service';
import { enforceRiskBasedStepUp } from '../services/security/stepUp.service';
import { assertRecipientCanReceive } from '../services/wallet/recipientEligibility';
import { emitActivity } from '../utils/realtime';
import { notifyNewMessage, unreadMessageCount } from '../services/messaging/notify';

const EDIT_WINDOW_MS = 5 * 60_000;
/** Thread page size when the client asks for none (pre-paging app builds). */
const DEFAULT_THREAD_PAGE = 200;
const MAX_THREAD_PAGE = 200;
const MAX_CONVERSATIONS = 300;

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

/** Wire shape of a message — shared with the admin support-reply path so socket
 *  payloads are identical whichever controller emits them. */
export function toWire(m: any) {
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
    // The sender's idempotency key: lets a refetch replace an optimistic
    // bubble whose reply was lost. Random, so harmless to the receiver.
    clientId:   m.clientId ?? null,
  };
}

function emit(req: AuthRequest, userIds: string[], event: string, payload: any) {
  const io = req.app.get('io') as IOServer | undefined;
  if (!io) return;
  for (const uid of new Set(userIds)) io.to(`user:${uid}`).emit(event, payload);
}

/**
 * The message an earlier send with this clientId stored, or null. A key
 * reused for a different recipient or type is refused, never replayed.
 */
async function replayedMessage(senderId: string, clientId: string, data: { receiverId: string; type: string }) {
  const existing = await prisma.message.findUnique({ where: { senderId_clientId: { senderId, clientId } } });
  if (!existing) return null;
  if (existing.receiverId !== data.receiverId || existing.type !== data.type) {
    throw new AppError('This message id was already used for a different message', 409, 'DUPLICATE_REQUEST');
  }
  return { ...toWire(existing), clientId };
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

const MAX_METADATA_BYTES = 2_048;

/**
 * Client metadata, reduced to what each message type renders. Payment status
 * and transaction references are server facts: a REQUEST (or any non-payment
 * message) can no longer arrive saying `status: COMPLETED, txRef: TRF-…`, and
 * nothing large or nested is stored.
 */
function sanitizeMetadata(type: string, raw: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  let out: Record<string, unknown>;
  switch (type) {
    case 'PAYMENT':
      // amount/currency drive the transfer; stepUpCode/biometricVerified are
      // read and then deleted before the message is stored.
      // requestId: the REQUEST message this payment settles (checked in sendPayment).
      out = { amount: raw.amount, currency: str(raw.currency, 16), note: str(raw.note, 200), requestId: str(raw.requestId, 64), stepUpCode: str(raw.stepUpCode, 12), biometricVerified: raw.biometricVerified === true ? true : undefined };
      break;
    case 'REQUEST':
      out = { amount: num(raw.amount), currency: str(raw.currency, 16), note: str(raw.note, 200), status: 'PENDING' };
      break;
    case 'STICKER':
      out = { id: str(raw.id, 64), emoji: str(raw.emoji, 16), label: str(raw.label, 64) };
      break;
    default:
      out = {};
      for (const [k, v] of Object.entries(raw).slice(0, 20)) {
        if (k === 'status' || k === 'txRef' || k === 'transferId') continue;
        if (typeof v === 'string') out[k.slice(0, 40)] = v.slice(0, 500);
        else if (typeof v === 'number' || typeof v === 'boolean') out[k.slice(0, 40)] = v;
      }
  }
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  if (Buffer.byteLength(JSON.stringify(out)) > MAX_METADATA_BYTES) throw new AppError('Message metadata is too large', 400);
  return out;
}

const sendSchema = z.object({
  receiverId: z.string().uuid(),
  content:    z.string().min(1).max(4_000),
  type:       z.enum(['TEXT', 'PAYMENT', 'REQUEST', 'STICKER', 'P2P_NOTE']).default('TEXT'),
  /** PAYMENT: { amount, currency, txRef? }. Free-form for other types. */
  metadata:   z.record(z.string(), z.any()).optional(),
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

  /**
   * POST /api/messages — send a TEXT, PAYMENT, REQUEST, STICKER or P2P_NOTE.
   *
   * Idempotent on `clientId`: a retry after a lost reply (or from the app's
   * offline outbox) returns the original message with 200 instead of storing
   * a duplicate. A PAYMENT stores its message in the same database
   * transaction that moves the money, so the unique (senderId, clientId)
   * index makes a concurrent retry roll its whole payment back.
   */
  static async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = sendSchema.parse(req.body);
      data.metadata = sanitizeMetadata(data.type, data.metadata as Record<string, unknown> | undefined) as typeof data.metadata;
      const senderId = req.user!.id;
      const clientId = data.clientId?.trim() || null;
      if (data.receiverId === senderId) throw new AppError('Cannot message yourself', 400);

      if (clientId) {
        const replay = await replayedMessage(senderId, clientId, data);
        if (replay) return res.status(200).json({ message: replay, replayed: true });
      }

      await assertNotBlocked(senderId, data.receiverId);

      const receiver = await prisma.user.findUnique({
        where: { id: data.receiverId },
        select: { id: true },
      });
      if (!receiver) throw new AppError('Recipient not found', 404);

      // Never persist authentication material inside a chat message.
      const storable = (meta: Record<string, unknown> | undefined) => {
        if (!meta) return meta;
        const { stepUpCode: _code, biometricVerified: _bio, ...rest } = meta;
        return rest;
      };
      const baseRow = {
        senderId,
        receiverId: data.receiverId,
        content:    data.content,
        type:       data.type,
        tradeId:    data.tradeId,
        clientId,
      };

      let msg;
      try {
        if (data.type === 'PAYMENT') {
          msg = await MessageController.sendPayment(req, data, baseRow, storable);
        } else {
          msg = await prisma.message.create({ data: { ...baseRow, metadata: storable(data.metadata) as any } });
        }
      } catch (e) {
        // A concurrent retry with the same clientId won the race: its payment
        // committed, ours rolled back. Answer with the original.
        if (clientId && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const replay = await replayedMessage(senderId, clientId, data);
          if (replay) return res.status(200).json({ message: replay, replayed: true });
        }
        throw e;
      }

      // Echo the client's idempotency key so the sender can match this row to
      // its optimistic placeholder exactly.
      const wire = { ...toWire(msg), clientId };
      emit(req, [senderId, data.receiverId], 'message:new', wire);
      if (msg.transferId) emitActivity(req, [senderId, data.receiverId], { kind: 'transaction', type: 'TRANSFER' });
      const settled = data.type === 'PAYMENT' ? (msg.metadata as Record<string, unknown> | null)?.requestId : null;
      if (typeof settled === 'string') {
        const request = await prisma.message.findUnique({ where: { id: settled } });
        if (request) emit(req, [request.senderId, request.receiverId], 'message:update', toWire(request));
      }

      res.status(201).json({ message: wire });
      void notifyNewMessage(msg);
    } catch (e) { next(e); }
  }

  /**
   * PAYMENT messages move real money wallet-to-wallet. Balance storage is
   * split across two tables: `UserWallet` has dedicated columns for the
   * self-custodied crypto (ETH, BTC, SOL, USDT ERC-20/TRC-20) plus an
   * `altBalances` map; `Wallet` holds fiat and plain USDT. Each currency is
   * routed to the table it actually lives in.
   */
  private static async sendPayment(
    req: AuthRequest,
    data: z.infer<typeof sendSchema>,
    baseRow: { senderId: string; receiverId: string; content: string; type: string; tradeId?: string; clientId: string | null },
    storable: (meta: Record<string, unknown> | undefined) => Record<string, unknown> | undefined,
  ) {
    const senderId = baseRow.senderId;
    const m = (data.metadata ?? {}) as Record<string, any>;
    if (typeof m.amount !== 'number' || !m.currency) {
      throw new AppError('PAYMENT messages require metadata.amount and metadata.currency', 400);
    }

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

    const baseCurrency = currency.replace(/_(ERC20|TRC20)$/, '');
    const requestId = typeof m.requestId === 'string' ? m.requestId : null;
    if (requestId) await MessageController.assertPayableRequest(prisma, requestId, senderId, data.receiverId, amountDec, currency);
    // Same recipient rules as the Send screen: no suspended, closed or held
    // account, and never a house account.
    await assertRecipientCanReceive(senderId, data.receiverId, { currency: baseCurrency });
    await assertMovementAllowed({ userId: senderId, feature: 'transfers', product: 'chat_payments', currency: baseCurrency });
    await enforceKycLimit(senderId, 'SEND', amountDec, baseCurrency); // before any security code
    await enforceRiskBasedStepUp({
      userId: senderId,
      action: 'transfer',
      valueUsd: await valueInUsd(amountDec.toString(), baseCurrency),
      req,
      code: typeof m.stepUpCode === 'string' ? m.stepUpCode : undefined,
      biometricVerified: m.biometricVerified === true,
    });

    return prisma.$transaction(async (tx) => {
      await enforceKycLimit(senderId, 'SEND', amountDec, baseCurrency, tx);
      const reference = `TRF-${require('uuid').v4().slice(0, 8).toUpperCase()}`;

      // Each branch locks (or atomically checks) before it reads, so two
      // payments from the same wallet can never both spend one balance.
      const moved = isWalletTable
        ? await moveWalletBalance(tx, senderId, data.receiverId, currency, amountDec)
        : uwColumn
          ? await moveUserWalletColumn(tx, senderId, data.receiverId, uwColumn, currency, amountDec)
          : await moveAltBalance(tx, senderId, data.receiverId, currency, amountDec);
      const { senderBalBefore, senderBalAfter, receiverBalBefore, receiverBalAfter } = moved;

      // Anything in the Prisma Currency enum is stored directly; chain
      // variants (USDT_TRC20) and exotic alts collapse to USDT for the
      // column. The true asset is always preserved in `metadata.asset`.
      const PRISMA_CURRENCIES = new Set([
        'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
        'USD','EUR','GBP','AED','SAR','EGP','LYD',
      ]);
      const ledgerCurrency = PRISMA_CURRENCIES.has(currency) ? currency : 'USDT';
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
          idempotencyKey: baseRow.clientId ? `msg:${baseRow.clientId}` : undefined,
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

      if (requestId) {
        // Locked so two payments can't both settle one request.
        await tx.$queryRaw`SELECT "id" FROM "Message" WHERE "id" = ${requestId} FOR UPDATE`;
        const req0 = await MessageController.assertPayableRequest(tx, requestId, senderId, data.receiverId, amountDec, currency);
        await tx.message.update({
          where: { id: requestId },
          data: { metadata: { ...(req0.metadata as Record<string, unknown>), status: 'PAID', txRef: reference, paidAt: new Date().toISOString() } as any },
        });
      }

      // Status and reference are server facts, written with the payment.
      const metadata = { ...storable(m), txRef: reference, status: 'COMPLETED' };
      return tx.message.create({
        data: {
          ...baseRow,
          metadata: metadata as any,
          transferId: transfer.id,
          senderTxId: senderTx.id,
          receiverTxId: receiverTx.id,
        },
      });
    });
  }

  /**
   * GET /api/messages/conversations — one row per chat partner: the latest
   * message and how many inbound messages I have not opened. Every partner
   * is listed, however old the last message (the old 500-row scan dropped
   * quiet conversations for busy users).
   */
  static async getConversations(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const lastIds = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT DISTINCT ON (partner) id FROM (
          SELECT id, "createdAt",
                 CASE WHEN "senderId" = ${userId} THEN "receiverId" ELSE "senderId" END AS partner
          FROM "Message"
          WHERE "senderId" = ${userId} OR "receiverId" = ${userId}
        ) m
        ORDER BY partner, "createdAt" DESC, id DESC`;

      const [lastRows, unreadRows] = await Promise.all([
        lastIds.length
          ? prisma.message.findMany({ where: { id: { in: lastIds.map((r) => r.id) } } })
          : Promise.resolve([]),
        prisma.message.groupBy({
          by: ['senderId'],
          where: { receiverId: userId, seenAt: null, deletedAt: null },
          _count: { _all: true },
        }),
      ]);
      const unreadBy = new Map(unreadRows.map((r) => [r.senderId, r._count._all]));

      lastRows.sort((a, b) => +b.createdAt - +a.createdAt);
      const rows = lastRows.slice(0, MAX_CONVERSATIONS);
      const partnerIds = rows.map((m) => (m.senderId === userId ? m.receiverId : m.senderId));
      const partners = await prisma.user.findMany({
        where: { id: { in: partnerIds } },
        select: {
          id: true, firstName: true, lastName: true, username: true,
          avatarUrl: true, role: true, kycStatus: true,
        },
      });
      const partnerMap = new Map(partners.map((p) => [p.id, p]));

      const conversations = rows.map((m, i) => ({
        partner: partnerMap.get(partnerIds[i]) ?? { id: partnerIds[i] },
        lastMessage: toWire(m),
        unread: unreadBy.get(partnerIds[i]) ?? 0,
      }));

      res.json({ conversations });
    } catch (e) { next(e); }
  }

  /** GET /api/messages/unread-count — total unopened inbound messages (badge). */
  static async unreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ unread: await unreadMessageCount(req.user!.id) });
    } catch (e) { next(e); }
  }

  /**
   * GET /api/messages/:userId — the thread between me and :userId, oldest
   * first, one page at a time.
   *
   *   (no cursor)       the latest `limit` messages; marks inbound as opened
   *   ?before=<id>      the `limit` messages older than <id> ("load earlier")
   *   ?after=<id>       messages newer than <id> (catch-up after reconnect);
   *                     marks inbound as opened
   *
   * `hasMore` says whether another page exists in that direction. Without a
   * `limit` the page is DEFAULT_THREAD_PAGE, so app builds that predate
   * paging still receive a full recent history.
   */
  static async getMessages(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const { userId } = req.params;
      const limitRaw = Number.parseInt(String(req.query.limit ?? ''), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), MAX_THREAD_PAGE) : DEFAULT_THREAD_PAGE;
      const before = typeof req.query.before === 'string' ? req.query.before : undefined;
      const after = typeof req.query.after === 'string' && !before ? req.query.after : undefined;

      const thread: Prisma.MessageWhereInput = {
        OR: [
          { senderId: me,     receiverId: userId },
          { senderId: userId, receiverId: me },
        ],
      };
      const cursorId = before ?? after;
      const cursor = cursorId
        ? await prisma.message.findFirst({ where: { AND: [thread, { id: cursorId }] }, select: { id: true, createdAt: true } })
        : null;
      if (cursorId && !cursor) throw new AppError('Message not found', 404);

      let page;
      let hasMore: boolean;
      if (cursor && after) {
        const rows = await prisma.message.findMany({
          where: { AND: [thread, { OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ] }] },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: limit + 1,
        });
        hasMore = rows.length > limit;
        page = rows.slice(0, limit);
      } else {
        const rows = await prisma.message.findMany({
          where: cursor
            ? { AND: [thread, { OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ] }] }
            : thread,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
        });
        hasMore = rows.length > limit;
        page = rows.slice(0, limit).reverse();
      }

      // Opening the thread (or catching up in it) opens everything inbound.
      if (!before) await MessageController.markThreadOpened(req, me, userId);

      res.json({ messages: page.map(toWire), hasMore });
    } catch (e) { next(e); }
  }

  /**
   * The reader opened the thread: always clear their own unread state (badge,
   * inbox count — on every device), and send a read receipt to the partner
   * only when the reader shares receipts.
   */
  private static async markThreadOpened(req: AuthRequest, me: string, partnerId: string): Promise<number> {
    const now = new Date();
    const myPrefs = await prisma.user.findUnique({ where: { id: me }, select: { notificationPrefs: true } });
    const shareReceipts = messagePrivacyOf(myPrefs).readReceiptsOn;

    const opened = await prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: me, seenAt: null },
      data:  { seenAt: now },
    });
    if (shareReceipts) {
      const unread = await prisma.message.findMany({
        where: { senderId: partnerId, receiverId: me, isRead: false },
        select: { id: true },
        take: 1_000,
      });
      if (unread.length) {
        await prisma.message.updateMany({
          where: { id: { in: unread.map((m) => m.id) } },
          data:  { isRead: true, readAt: now },
        });
        emit(req, [partnerId], 'message:read', { by: me, ids: unread.map((m) => m.id) });
      }
    }
    if (opened.count) emit(req, [me], 'conversation:seen', { partnerId });
    return opened.count;
  }

  /** PATCH /api/messages/:id — edit own TEXT message within EDIT_WINDOW_MS. */
  /**
   * A REQUEST the payer can settle: sent to the payer by the person being
   * paid, still pending, and for exactly this amount and currency.
   */
  private static async assertPayableRequest(
    db: Prisma.TransactionClient | typeof prisma, requestId: string, payerId: string, payeeId: string, amount: Decimal, currency: string,
  ) {
    const r = await db.message.findUnique({ where: { id: requestId } });
    const meta = (r?.metadata ?? {}) as Record<string, unknown>;
    if (!r || r.type !== 'REQUEST' || r.deletedAt || r.receiverId !== payerId || r.senderId !== payeeId) {
      throw new AppError('This request can\'t be paid from here', 400);
    }
    if (meta.status !== 'PENDING') {
      throw new AppError(meta.status === 'PAID' ? 'This request has already been paid' : 'This request is no longer open', 409, 'TRANSACTION_CONFLICT');
    }
    if (String(meta.currency ?? '').toUpperCase() !== currency || !new Decimal(String(meta.amount ?? 0)).eq(amount)) {
      throw new AppError('The payment must match the requested amount and currency', 400);
    }
    return r;
  }

  /**
   * POST /api/messages/:id/request { action }
   * DECLINE — the person asked turns a pending request down.
   * CANCEL  — the person who asked withdraws it.
   */
  static async respondRequest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { action } = z.object({ action: z.enum(['DECLINE', 'CANCEL']) }).parse(req.body);
      const me = req.user!.id;
      const updated = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Message" WHERE "id" = ${req.params.id} FOR UPDATE`;
        const r = await tx.message.findUnique({ where: { id: req.params.id } });
        const meta = (r?.metadata ?? {}) as Record<string, unknown>;
        if (!r || r.type !== 'REQUEST' || r.deletedAt) throw new AppError('Request not found', 404);
        const allowed = action === 'DECLINE' ? r.receiverId === me : r.senderId === me;
        if (!allowed) throw new AppError(action === 'DECLINE' ? 'Only the person asked can decline' : 'Only the person who asked can cancel', 403);
        if (meta.status !== 'PENDING') throw new AppError('This request is no longer open', 409, 'TRANSACTION_CONFLICT');
        return tx.message.update({
          where: { id: r.id },
          data: { metadata: { ...meta, status: action === 'DECLINE' ? 'DECLINED' : 'CANCELLED', closedAt: new Date().toISOString() } as any },
        });
      });
      const wire = toWire(updated);
      emit(req, [updated.senderId, updated.receiverId], 'message:update', wire);
      res.json({ message: wire });
    } catch (e) { next(e); }
  }

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

  /**
   * POST /api/messages/read/:userId — explicit mark-as-read. Clears my unread
   * state even with read receipts off (the partner just gets no receipt).
   */
  static async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const me = req.user!.id;
      const { userId } = req.params;
      const updated = await MessageController.markThreadOpened(req, me, userId);
      const myPrefs = await prisma.user.findUnique({ where: { id: me }, select: { notificationPrefs: true } });
      res.json({ updated, ...(messagePrivacyOf(myPrefs).readReceiptsOn ? {} : { suppressed: true }) });
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
        // Only a message you received can be reported (and only by you), so
        // reports cannot pull arbitrary conversations in front of moderators.
        if (!m || m.receiverId !== me) throw new AppError('Message not found', 404);
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
      // An escalation names a real counterparty: someone you have a trade or a
      // conversation with. Otherwise anyone could make "support" message any
      // customer about a dispute that does not exist.
      const [trade, convo] = await Promise.all([
        data.tradeId ? prisma.p2PTrade.findFirst({ where: { id: data.tradeId, OR: [{ buyerId: me, sellerId: data.counterpartyId }, { buyerId: data.counterpartyId, sellerId: me }] }, select: { id: true } }) : Promise.resolve(null),
        prisma.message.findFirst({ where: { OR: [{ senderId: me, receiverId: data.counterpartyId }, { senderId: data.counterpartyId, receiverId: me }] }, select: { id: true } }),
      ]);
      if (data.tradeId && !trade) throw new AppError('Trade not found', 404);
      if (!trade && !convo) throw new AppError('You can only escalate a trade or conversation you are part of', 403);

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

      // Each notice only to its addressee (+ support). Broadcasting both to both
      // parties filed the other side's notice into each user's support thread
      // until the next refetch removed it again.
      emit(req, [me, support.id],                     'message:new', toWire(sysMsg));
      emit(req, [data.counterpartyId, support.id],    'message:new', toWire(sysMsg2));
      emit(req, [me, support.id],                     'message:new', toWire(opener));
      emit(req, [me, data.counterpartyId, support.id], 'escalation:new', { escalation });
      void notifyNewMessage(sysMsg2);

      res.status(201).json({ escalation, supportThreadWith: support.id });
    } catch (e) { next(e); }
  }
}
