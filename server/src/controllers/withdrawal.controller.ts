import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';

const withdrawalSchema = z.object({
  currency: z.enum(['LYD', 'USD', 'USDT']),
  amount: z.number().positive(),
  paymentMethod: z.enum(['SADAD', 'MASREFY', 'MOAMALAT', 'TADAWUL', 'BANK_TRANSFER', 'CASH_DEPOSIT']).optional(),
  walletAddress: z.string().optional(),
  network: z.enum(['TRC20', 'ERC20']).optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
});

export class WithdrawalController {
  /**
   * Create a withdrawal request.
   * USDT withdrawals require a wallet address + network (TRC20/ERC20).
   * The system will queue an on-chain USDT send when the admin processes it.
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = withdrawalSchema.parse(req.body);

      if (data.currency === 'USDT') {
        if (!data.walletAddress) throw new AppError('Wallet address is required for USDT withdrawals', 400);
        if (!data.network) throw new AppError('Network (TRC20/ERC20) is required for USDT withdrawals', 400);
        if (data.network === 'TRC20' && !data.walletAddress.startsWith('T')) throw new AppError('Invalid TRC20 address', 400);
        if (data.network === 'ERC20' && !data.walletAddress.startsWith('0x')) throw new AppError('Invalid ERC20 address', 400);
      }
      if (data.currency !== 'USDT' && !data.paymentMethod) {
        throw new AppError('Payment method is required for fiat withdrawals', 400);
      }

      const wallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: data.currency } },
      });
      if (!wallet) throw new AppError('Wallet not found', 404);

      const available = parseFloat(wallet.balance.toString()) - parseFloat(wallet.frozen.toString());
      if (data.amount > available) throw new AppError('Insufficient balance', 400);

      const feeKey = data.currency === 'USDT' ? 'withdrawal_fee_usdt' : 'withdrawal_fee_lyd';
      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: feeKey } });
      const fee = parseFloat(feeSetting?.value || '0');
      const netAmount = data.amount - fee;
      if (netAmount <= 0) throw new AppError('Amount too small after fee deduction', 400);

      const reference = generateReference('WDR');

      // Freeze the amount
      await prisma.wallet.update({
        where: { userId_currency: { userId: req.user!.id, currency: data.currency } },
        data: { frozen: { increment: new Decimal(data.amount) } },
      });

      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId: req.user!.id,
          currency: data.currency,
          amount: data.amount,
          fee,
          netAmount,
          paymentMethod: data.paymentMethod as any,
          walletAddress: data.walletAddress,
          network: data.network,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          accountName: data.accountName,
          reference,
        },
      });

      // Notify admins
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'New Withdrawal Request',
            message: `Withdrawal of ${data.amount} ${data.currency}${data.currency === 'USDT' ? ` to ${data.walletAddress} (${data.network})` : ''}. Ref: ${reference}`,
            type: 'withdrawal',
          },
        });
      }

      res.status(201).json({ withdrawal });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.withdrawal.count({ where: { userId: req.user!.id } }),
      ]);
      res.json({ withdrawals, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const withdrawal = await prisma.withdrawal.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!withdrawal) throw new AppError('Withdrawal not found', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('Only pending withdrawals can be cancelled', 400);

      await prisma.wallet.update({
        where: { userId_currency: { userId: req.user!.id, currency: withdrawal.currency } },
        data: { frozen: { decrement: withdrawal.amount } },
      });

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'CANCELLED' },
      });

      res.json({ message: 'Withdrawal cancelled' });
    } catch (error) {
      next(error);
    }
  }
}
