import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';

const depositSchema = z.object({
  currency: z.enum(['USD', 'USDT']),
  amount: z.number().positive(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH_DEPOSIT']),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  senderName: z.string().optional(),
  notes: z.string().optional(),
});

const INSTANT_METHODS: string[] = [];

export class DepositController {
  /**
   * Create a new deposit.
   * USD/USDT deposits via bank transfer or cash deposit
   * remain pending for admin review.
   */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body, amount: parseFloat(req.body.amount) };
      const data = depositSchema.parse(body);

      const settings = await prisma.platformSettings.findUnique({
        where: { key: data.currency === 'USDT' ? 'min_deposit_usdt' : 'min_deposit_usd' },
      });
      const minDeposit = parseFloat(settings?.value || '0');
      if (data.amount < minDeposit) throw new AppError(`Minimum deposit is ${minDeposit} ${data.currency}`, 400);

      const reference = generateReference('DEP');
      const file = req.file as Express.Multer.File | undefined;

      // No instant confirmation for USD/USDT
      const isInstant = false;

      const deposit = await prisma.deposit.create({
        data: {
          userId: req.user!.id,
          currency: data.currency,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          reference,
          proofImageUrl: file ? `/uploads/${file.filename}` : undefined,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
          senderName: data.senderName,
          notes: data.notes,
          status: isInstant ? 'CONFIRMED' : 'PENDING',
          confirmedAt: isInstant ? new Date() : undefined,
        },
      });

      if (isInstant) {
        // Instantly credit the user's wallet
        const wallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: req.user!.id, currency: data.currency } },
        });
        const balanceBefore = parseFloat(wallet?.balance.toString() || '0');

        await prisma.wallet.update({
          where: { userId_currency: { userId: req.user!.id, currency: data.currency } },
          data: { balance: { increment: data.amount } },
        });

        await prisma.transaction.create({
          data: {
            userId: req.user!.id,
            type: 'DEPOSIT',
            currency: data.currency,
            amount: data.amount,
            balanceBefore,
            balanceAfter: balanceBefore + data.amount,
            reference,
            description: `Instant LYD deposit via ${data.paymentMethod}`,
          },
        });

        await prisma.notification.create({
          data: {
            userId: req.user!.id,
            title: 'Deposit Confirmed',
            message: `Your deposit of ${data.amount} ${data.currency} via ${data.paymentMethod} has been instantly confirmed.`,
            type: 'deposit',
          },
        });
      } else {
        // Notify admins for manual review
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              title: 'New Deposit Request',
              message: `New ${data.currency} deposit of ${data.amount} via ${data.paymentMethod}. Ref: ${reference}`,
              type: 'deposit',
            },
          });
        }
      }

      res.status(201).json({ deposit, instant: isInstant });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const currency = req.query.currency as string | undefined;

      const where: any = { userId: req.user!.id };
      if (status) where.status = status;
      if (currency) where.currency = currency.toUpperCase();

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.deposit.count({ where }),
      ]);
      res.json({ deposits, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!deposit) throw new AppError('Deposit not found', 404);
      res.json({ deposit });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findFirst({
        where: { id: req.params.id, userId: req.user!.id },
      });
      if (!deposit) throw new AppError('Deposit not found', 404);
      if (deposit.status !== 'PENDING') throw new AppError('Only pending deposits can be cancelled', 400);

      await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'CANCELLED' } });
      res.json({ message: 'Deposit cancelled' });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentMethods(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const paymentMethods = [
        { id: 'BANK_TRANSFER', name: 'Bank Transfer', description: 'Direct bank wire transfer', currencies: ['USD', 'USDT'], instant: false, processingTime: '1-3 business days' },
        { id: 'CASH_DEPOSIT', name: 'Cash Deposit', description: 'Cash deposit at bank branch', currencies: ['USD', 'USDT'], instant: false, processingTime: '1-24 hours' },
      ];
      res.json({ paymentMethods });
    } catch (error) {
      next(error);
    }
  }
}
