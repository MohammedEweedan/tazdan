/**
 * TransactionController — unified entry point for all financial operations.
 *
 *   • internalTransfer: wallet-to-wallet transfers (used by in-chat PAYMENT
 *     and the /send page). Atomically creates Transfer + two Transaction
 *     records and updates balances.
 *
 * All operations are wrapped in a Prisma transaction to guarantee
 * consistency. The controller validates balance sufficiency, applies
 * optional fees, and records balanceBefore / balanceAfter for audit.
 */

import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { emitActivity } from '../utils/realtime';
import { Decimal } from '@prisma/client/runtime/library';
import { collectFee } from '../services/fee/feeCollector.service';
import { isLedgerCurrency, postLedger } from '../services/ledger/ledger.service';

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
   * Body: { receiverId, currency, amount, note?, fee? }
   */
  static async internalTransfer(req: AuthRequest, res: Response, next: NextFunction) {
    const { receiverId, currency, amount, note, fee = 0 } = req.body;
    const senderId = req.user!.id;

    const amountNum = Number(amount);
    const feeNum = Number(fee);
    const totalDeduction = amountNum + feeNum;

    if (!receiverId || !currency || isNaN(amountNum) || amountNum <= 0) {
      throw new AppError('Invalid transfer parameters', 400);
    }
    if (receiverId === senderId) {
      throw new AppError('Cannot transfer to yourself', 400);
    }

    // Currencies that exist in the Prisma Currency enum
    const ENUM_CURRENCIES = new Set([
      'USDT','BTC','ETH','BNB','SOL','XRP','ADA','DOGE','MATIC','DOT','AVAX',
      'USD','EUR','GBP','AED','SAR','EGP','LYD',
    ]);
    const isEnumCurrency = ENUM_CURRENCIES.has(currency);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const reference = `TRF-${uuidv4().slice(0, 8).toUpperCase()}`;

        let senderBalBefore = 0;
        let senderBalAfter  = 0;
        let receiverBalBefore = 0;
        let receiverBalAfter  = 0;

        if (isEnumCurrency) {
          // ── Enum path: standard Wallet table ───────────────────────
          const [senderWallet, receiverWallet] = await Promise.all([
            tx.wallet.upsert({
              where: { userId_currency: { userId: senderId, currency: currency as any } },
              create: { userId: senderId, currency: currency as any, balance: 0, frozen: 0 },
              update: {},
            }),
            tx.wallet.upsert({
              where: { userId_currency: { userId: receiverId, currency: currency as any } },
              create: { userId: receiverId, currency: currency as any, balance: 0, frozen: 0 },
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
          // ── Altcoin path: UserWallet.altBalances JSON ───────────────
          const [senderUW, receiverUW] = await Promise.all([
            tx.userWallet.findUnique({ where: { userId: senderId } }),
            tx.userWallet.findUnique({ where: { userId: receiverId } }),
          ]);

          const senderAlts   = (senderUW?.altBalances   && typeof senderUW.altBalances   === 'object' ? senderUW.altBalances   : {}) as Record<string, string>;
          const receiverAlts = (receiverUW?.altBalances && typeof receiverUW.altBalances === 'object' ? receiverUW.altBalances : {}) as Record<string, string>;

          senderBalBefore   = parseFloat(senderAlts[currency]   ?? '0');
          receiverBalBefore = parseFloat(receiverAlts[currency] ?? '0');

          if (senderBalBefore < totalDeduction) {
            throw new AppError(`Insufficient ${currency} balance. Available: ${senderBalBefore}`, 400);
          }

          senderBalAfter   = senderBalBefore - totalDeduction;
          receiverBalAfter = receiverBalBefore + amountNum;

          const newSenderAlts   = { ...senderAlts,   [currency]: senderBalAfter.toFixed(8) };
          const newReceiverAlts = { ...receiverAlts, [currency]: receiverBalAfter.toFixed(8) };

          if (!senderUW)   throw new AppError(`Sender crypto wallet not provisioned`, 404);
          if (!receiverUW) throw new AppError(`Receiver crypto wallet not provisioned`, 404);

          await Promise.all([
            tx.userWallet.update({ where: { userId: senderId },   data: { altBalances: newSenderAlts } }),
            tx.userWallet.update({ where: { userId: receiverId }, data: { altBalances: newReceiverAlts } }),
          ]);
        }

        // Transfer record — altcoins stored with USDT as ledger currency; asset in metadata
        const transfer = await tx.transfer.create({
          data: {
            senderId,
            receiverId,
            currency: isEnumCurrency ? (currency as any) : 'USDT',
            amount: amountNum,
            fee: feeNum,
            reference,
            note: note || undefined,
          },
        });

        if (isLedgerCurrency(currency)) {
          const amountDec = new Decimal(amountNum);
          const feeDec = new Decimal(feeNum);
          const totalDec = amountDec.add(feeDec);
          await postLedger(tx as any, {
            refType: 'transfer',
            refId: reference,
            memo: `Legacy internal transfer ${currency}`,
            legs: [
              { type: 'USER', userId: senderId, currency: currency as any, amount: totalDec.neg() },
              { type: 'USER', userId: receiverId, currency: currency as any, amount: amountDec },
              ...(feeDec.gt(0)
                ? [{ type: 'PLATFORM' as const, currency: currency as any, amount: feeDec }]
                : []),
            ],
          }, { allowNegativeUser: true });

          if (feeDec.gt(0)) {
            await collectFee({
              tx,
              source: 'manual',
              sourceId: transfer.id,
              payerId: senderId,
              amount: feeDec,
              currency,
              description: `Internal transfer fee · ${currency}`,
              metadata: { reference, receiverId, legacyRoute: true },
            });
          }
        }

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
            description: note ? `Transfer to @${note}` : `Transfer to ${receiverId}`,
            metadata: { transferId: transfer.id, receiverId, note, asset: currency },
          },
        });

        const receiverTx = await tx.transaction.create({
          data: {
            userId: receiverId,
            type: 'TRANSFER_IN',
            currency: isEnumCurrency ? (currency as any) : 'USDT',
            amount: amountNum,
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
