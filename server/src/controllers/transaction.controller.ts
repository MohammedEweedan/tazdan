/**
 * TransactionController — unified entry point for all financial operations.
 *
 *   • internalTransfer: wallet-to-wallet transfers (used by in-chat PAYMENT
 *     and the /send page). Atomically creates Transfer + two Transaction
 *     records and updates balances.
 *
 * All operations are wrapped in a Prisma transaction to guarantee
 * consistency. The controller validates balance sufficiency and records
 * balanceBefore / balanceAfter for audit. Internal transfers carry no fee.
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { emitActivity } from '../utils/realtime';
import { parsePositiveAmount } from '../services/wallet/atomicWallet';
import { moveAltBalance, moveWalletBalance } from '../services/wallet/userTransfer';
import { enforceKycLimit } from '../utils/kycLimits';
import { isLedgerCurrency, postLedger } from '../services/ledger/ledger.service';
import { postAssetLedger, normaliseAsset } from '../services/ledger/assetLedger.service';
import { assertMovementAllowed } from '../services/platform/controls.service';
import { enforceRiskBasedStepUp } from '../services/security/stepUp.service';
import { valueInUsd } from '../utils/kycLimits';
import { assertRecipientCanReceive, checkRecipient } from '../services/wallet/recipientEligibility';
import { assertTillForReceiver } from '../services/business/tills.service';
import { historyCount, historyRows } from '../services/lydt/lydt.service';
import { incrAttempts } from '../utils/redis';
import { pushCopy, pushTxEvent } from '../services/push.service';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';

/** Recipient pre-checks per customer per window (enumeration guard). */
const RECIPIENT_CHECK_LIMIT = 60;
const RECIPIENT_CHECK_WINDOW_S = 10 * 60;

/**
 * The transfer an earlier request with this key created, with both of its
 * transaction rows — or null. A key reused for another recipient or amount
 * is refused, never replayed.
 */
async function replayedTransfer(senderId: string, key: string, expect: { receiverId: string; amount: Decimal }) {
  const transfer = await prisma.transfer.findUnique({ where: { senderId_idempotencyKey: { senderId, idempotencyKey: key } } });
  if (!transfer) return null;
  if (transfer.receiverId !== expect.receiverId || !new Decimal(transfer.amount.toString()).eq(expect.amount)) {
    throw new AppError('This Idempotency-Key was already used for a different transfer', 409, 'DUPLICATE_REQUEST');
  }
  const [senderTx, receiverTx] = await Promise.all([
    prisma.transaction.findFirst({ where: { reference: transfer.reference, userId: senderId, type: 'TRANSFER_OUT' } }),
    prisma.transaction.findFirst({ where: { reference: transfer.reference, userId: transfer.receiverId, type: 'TRANSFER_IN' } }),
  ]);
  return { transfer, senderTx, receiverTx, replayed: true };
}

/** "Sent" / "Received" pushes after a committed transfer, per each side's prefs. */
async function notifyTransfer(senderId: string, receiverId: string, amount: Decimal, asset: string, reference: string) {
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: [senderId, receiverId] } },
      select: { id: true, username: true, firstName: true, notificationPrefs: true },
    });
    const sender = users.find((u) => u.id === senderId);
    const receiver = users.find((u) => u.id === receiverId);
    if (!sender || !receiver) return;
    const handle = (u: typeof sender) => u.username || u.firstName || 'a tazdan user';
    const wantsPush = (u: typeof sender) => (u.notificationPrefs as any)?.push?.transfers !== false;
    const amt = amount.toFixed(8).replace(/\.?0+$/, '');
    if (wantsPush(sender)) await pushTxEvent(senderId, pushCopy.sent(amt, asset, handle(receiver)), reference);
    if (wantsPush(receiver)) await pushTxEvent(receiverId, pushCopy.received(amt, asset, handle(sender)), reference);
  } catch (err) {
    logger.warn('[transfer] post-commit push failed', { reference, err });
  }
}

export class TransactionController {
  /**
   * Internal wallet-to-wallet transfer.
   *
   * Creates:
   *   - One Transfer record (senderId, receiverId, currency, amount, fee, reference, note)
   *   - Two Transaction records (TRANSFER_OUT for sender, TRANSFER_IN for receiver)
   *   - Updates both wallets' balances atomically
   *
   * Used by:
   *   - In-chat PAYMENT messages (MessageController will link the Transfer to the Message)
   *   - /send page (future)
   *
   * Body: { receiverId, currency, amount, note?, idempotencyKey? }
   *
   * `idempotencyKey` (or an `Idempotency-Key` header) makes a retry after a
   * lost reply return the original transfer (200, `replayed: true`) instead
   * of moving the money twice.
   */
  static async internalTransfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { receiverId, currency: rawCurrency, amount, note, stepUpCode, biometricVerified, tillId: rawTillId } = req.body ?? {};
      // Optional business till (from a till QR or kiosk): attribution only, checked below.
      const tillId = typeof rawTillId === 'string' && /^[0-9a-f-]{36}$/i.test(rawTillId) ? rawTillId : undefined;
      if (rawTillId !== undefined && rawTillId !== null && !tillId) throw new AppError('Invalid till code', 400);
      const senderId = req.user!.id;

      // Internal transfers are free (see feeCollector). A client-supplied
      // fee is ignored — it must never change what the sender is debited.
      const feeNum = 0;
      if (!receiverId || typeof receiverId !== 'string' || !rawCurrency) {
        throw new AppError('Invalid transfer parameters', 400);
      }
      const amountDec = parsePositiveAmount(amount);
      const currency = String(rawCurrency).toUpperCase();
      const rawKey = req.body?.idempotencyKey ?? req.headers['idempotency-key'];
      const idempotencyKey = typeof rawKey === 'string' && rawKey.trim() ? rawKey.trim() : null;
      if (idempotencyKey && idempotencyKey.length > 120) throw new AppError('Idempotency-Key is too long', 400);
      if (idempotencyKey) {
        const replay = await replayedTransfer(senderId, idempotencyKey, { receiverId, amount: amountDec });
        if (replay) return res.json(replay);
      }
      // Same rules as GET /api/transactions/recipient-check. An unknown id is
      // refused like any other unavailable recipient (no enumeration).
      await assertRecipientCanReceive(senderId, receiverId, { currency });

      // Currencies that exist in the Prisma Currency enum
      const ENUM_CURRENCIES = new Set([
        'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
        'USD','EUR','GBP','AED','SAR','EGP','LYD','TRY','TND',
      ]);
      const isEnumCurrency = ENUM_CURRENCIES.has(currency);

      await assertMovementAllowed({ userId: senderId, feature: 'transfers', currency });
      if (tillId) await assertTillForReceiver(tillId, receiverId);
      // Limits first: never send a security code for a transfer that cannot go through.
      await enforceKycLimit(senderId, 'SEND', amountDec, currency);
      // This is the path the mobile Send screen uses; it must apply the same
      // step-up policy as /transfers/send.
      await enforceRiskBasedStepUp({
        userId: senderId,
        action: 'transfer',
        valueUsd: await valueInUsd(amountDec.toString(), currency),
        req,
        code: typeof stepUpCode === 'string' ? stepUpCode : undefined,
        biometricVerified: biometricVerified === true,
      });

      const result = await prisma.$transaction(async (tx) => {
        await enforceKycLimit(senderId, 'SEND', amountDec, currency, tx);
        const reference = `TRF-${uuidv4().slice(0, 8).toUpperCase()}`;

        // Transfer record first — altcoins stored with USDT as ledger currency;
        // asset in metadata. A concurrent retry with the same key blocks here
        // on the unique index and rolls back before touching any balance.
        const transfer = await tx.transfer.create({
          data: {
            senderId,
            receiverId,
            currency: isEnumCurrency ? (currency as any) : 'USDT',
            amount: amountDec,
            fee: feeNum,
            reference,
            note: note || undefined,
            idempotencyKey: idempotencyKey ?? undefined,
            tillId,
          },
        });

        // Enum currencies live in the Wallet table, everything else in
        // UserWallet.altBalances. Both moves lock/check before reading.
        const { senderBalBefore, senderBalAfter, receiverBalBefore, receiverBalAfter } = isEnumCurrency
          ? await moveWalletBalance(tx, senderId, receiverId, currency, amountDec)
          : await moveAltBalance(tx, senderId, receiverId, currency, amountDec);

        if (isLedgerCurrency(currency)) {
          await postLedger(tx as any, {
            refType: 'transfer',
            refId: reference,
            memo: `Legacy internal transfer ${currency}`,
            legs: [
              { type: 'USER', userId: senderId, currency: currency as any, amount: amountDec.neg() },
              { type: 'USER', userId: receiverId, currency: currency as any, amount: amountDec },
            ],
          }, { allowNegativeUser: true });
        } else {
          const asset = normaliseAsset(currency);
          await postAssetLedger(tx as any, {
            refType: 'transfer',
            refId: reference,
            memo: `Legacy internal transfer ${asset}`,
            legs: [
              { type: 'USER', userId: senderId, asset, amount: amountDec.neg() },
              { type: 'USER', userId: receiverId, asset, amount: amountDec },
            ],
          }, { allowNegativeUser: process.env.LEDGER_ALLOW_NEGATIVE_USER !== '0' });
        }

        const senderTx = await tx.transaction.create({
          data: {
            userId: senderId,
            type: 'TRANSFER_OUT',
            currency: isEnumCurrency ? (currency as any) : 'USDT',
            amount: amountDec,
            fee: feeNum,
            balanceBefore: senderBalBefore,
            balanceAfter:  senderBalAfter,
            reference,
            description: note ? `Transfer to @${note}` : `Transfer to ${receiverId}`,
            metadata: { transferId: transfer.id, receiverId, note, asset: currency },
          },
        });

        const receiverTx = await tx.transaction.create({
          data: {
            userId: receiverId,
            type: 'TRANSFER_IN',
            currency: isEnumCurrency ? (currency as any) : 'USDT',
            amount: amountDec,
            fee: 0,
            balanceBefore: receiverBalBefore,
            balanceAfter:  receiverBalAfter,
            reference,
            description: note ? `Transfer from @${note}` : `Transfer from ${senderId}`,
            metadata: { transferId: transfer.id, senderId, note, asset: currency },
          },
        });

        return { transfer, senderTx, receiverTx };
      }).catch(async (err) => {
        // A concurrent retry with this key committed first: answer with it.
        if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const replay = await replayedTransfer(senderId, idempotencyKey, { receiverId, amount: amountDec });
          if (replay) return replay;
        }
        throw err;
      });
      if ('replayed' in result) return res.json(result);

      emitActivity(req, [senderId, receiverId], { kind: 'transaction', type: 'TRANSFER' });
      void notifyTransfer(senderId, receiverId, amountDec, currency, result.transfer.reference);

      // If res is provided (HTTP request), send JSON response
      if (res) {
        res.json({
          transfer: result.transfer,
          senderTx: result.senderTx,
          receiverTx: result.receiverTx,
        });
      }

      // Always return the data for internal use (e.g., by MessageController)
      return result;
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Transfer failed', 500));
      }
    }
  }

  /**
   * GET /api/transactions/recipient-check?recipientId=<uuid>
   * Pre-check for the Send screen and chat send sheet:
   *   200 { canReceive: true } | { canReceive: false, reason: 'SELF' | 'UNAVAILABLE' }
   * Never says why a recipient is unavailable and treats unknown ids the same
   * (no 404), so it reveals nothing about other customers. UX only — the
   * transfer endpoints enforce the same rules themselves.
   */
  static async recipientCheck(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { recipientId } = z.object({ recipientId: z.string().uuid() }).parse(req.query);
      const used = await incrAttempts(`recipient-check:${req.user!.id}`, RECIPIENT_CHECK_WINDOW_S);
      if (used > RECIPIENT_CHECK_LIMIT) throw new AppError('Too many checks. Try again in a few minutes.', 429, 'RATE_LIMITED');
      const result = await checkRecipient(req.user!.id, recipientId);
      res.set('Cache-Control', 'no-store');
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all transactions for the authenticated user.
   *
   * Query params:
   *   - type?: filter by TransactionType
   *   - currency?: filter by Currency
   *   - page?: pagination (default 1)
   *   - limit?: per-page (default 20)
   */
  static async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type, currency, page = '1', limit = '20' } = req.query;
      const userId = req.user!.id;
      const pageNum = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * limitNum;

      const where: any = { userId };
      if (type) where.type = type as string;
      if (currency) where.currency = currency as string;
      const filters = { currency: currency ? String(currency).toUpperCase() : undefined, type: type ? String(type) : undefined };

      // LYDT activity (its own ledger) is merged in, newest first, so issues,
      // redeems and transfers sit in the same history as everything else.
      const lydtTotal = await historyCount(userId, filters);
      if (!lydtTotal) {
        const [transactions, total] = await Promise.all([
          prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limitNum }),
          prisma.transaction.count({ where }),
        ]);
        res.json({ items: transactions, total });
        return;
      }
      const onlyLydt = filters.currency === 'LYDT';
      const [transactions, total, lydt] = await Promise.all([
        onlyLydt ? Promise.resolve([]) : prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: skip + limitNum }),
        onlyLydt ? Promise.resolve(0) : prisma.transaction.count({ where }),
        historyRows(userId, { ...filters, take: skip + limitNum }),
      ]);
      const merged = [...transactions, ...lydt]
        .sort((a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(skip, skip + limitNum);
      res.json({ items: merged, total: total + lydtTotal });
    } catch (error) {
      next(new AppError('Failed to fetch transactions', 500));
    }
  }
}
