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
   * Body: { receiverId, currency, amount, note? }
   */
  static async internalTransfer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { receiverId, currency: rawCurrency, amount, note } = req.body ?? {};
      const senderId = req.user!.id;

      // Internal transfers are free (see feeCollector). A client-supplied
      // fee is ignored — it must never change what the sender is debited.
      const feeNum = 0;
      if (!receiverId || typeof receiverId !== 'string' || !rawCurrency) {
        throw new AppError('Invalid transfer parameters', 400);
      }
      const amountDec = parsePositiveAmount(amount);
      const currency = String(rawCurrency).toUpperCase();
      if (receiverId === senderId) {
        throw new AppError('Cannot transfer to yourself', 400);
      }
      const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { status: true } });
      if (!receiver) throw new AppError('Recipient not found', 404);
      if (receiver.status !== 'ACTIVE') throw new AppError('Recipient account is not active', 400);

      // Currencies that exist in the Prisma Currency enum
      const ENUM_CURRENCIES = new Set([
        'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
        'USD','EUR','GBP','AED','SAR','EGP','LYD',
      ]);
      const isEnumCurrency = ENUM_CURRENCIES.has(currency);

      await enforceKycLimit(senderId, 'SEND', amountDec, currency);

      const result = await prisma.$transaction(async (tx) => {
        const reference = `TRF-${uuidv4().slice(0, 8).toUpperCase()}`;

        // Enum currencies live in the Wallet table, everything else in
        // UserWallet.altBalances. Both moves lock/check before reading.
        const { senderBalBefore, senderBalAfter, receiverBalBefore, receiverBalAfter } = isEnumCurrency
          ? await moveWalletBalance(tx, senderId, receiverId, currency, amountDec)
          : await moveAltBalance(tx, senderId, receiverId, currency, amountDec);

        // Transfer record — altcoins stored with USDT as ledger currency; asset in metadata
        const transfer = await tx.transfer.create({
          data: {
            senderId,
            receiverId,
            currency: isEnumCurrency ? (currency as any) : 'USDT',
            amount: amountDec,
            fee: feeNum,
            reference,
            note: note || undefined,
          },
        });

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
      });

      emitActivity(req, [senderId, receiverId], { kind: 'transaction', type: 'TRANSFER' });

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

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.transaction.count({ where }),
      ]);

      res.json({
        items: transactions,
        total,
      });
    } catch (error) {
      next(new AppError('Failed to fetch transactions', 500));
    }
  }
}
