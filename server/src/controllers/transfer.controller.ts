import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';

const SUPPORTED_CURRENCIES = [
  'USDT', 'USD', 'LYD', 'BTC', 'ETH', 'BNB', 'SOL',
  'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX',
] as const;

const transferSchema = z.object({
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  recipientUsername: z.string().min(3).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).default('USDT'),
  amount: z.number().positive(),
  note: z.string().max(200).optional(),
}).refine(data => data.recipientEmail || data.recipientPhone || data.recipientUsername, {
  message: 'Recipient email, phone, or username is required',
});

export class TransferController {
  static async send(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = transferSchema.parse(req.body);
      const currency = data.currency;

      // Find recipient by any of email / phone / profile username
      let recipient: any = null;
      if (data.recipientEmail) {
        recipient = await prisma.user.findFirst({ where: { email: data.recipientEmail } });
      } else if (data.recipientPhone) {
        recipient = await prisma.user.findFirst({ where: { phone: data.recipientPhone } });
      } else if (data.recipientUsername) {
        recipient = await prisma.user.findFirst({
          where: { username: data.recipientUsername.toLowerCase() },
        });
      }

      if (!recipient) throw new AppError('Recipient not found', 404);
      if (recipient.id === req.user!.id) throw new AppError('Cannot transfer to yourself', 400);
      if (recipient.status !== 'ACTIVE') throw new AppError('Recipient account is not active', 400);

      // Fee lookup (per-currency, with a sensible default)
      const feeKey = `transfer_fee_${currency.toLowerCase()}`;
      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: feeKey } });
      const fee = parseFloat(feeSetting?.value || '0');
      const totalDeducted = data.amount + fee;

      // Minimum amount sanity check (low dust for crypto, $1 for fiat-like)
      const MIN: Record<string, number> = { USDT: 1, USD: 1, LYD: 1 };
      const min = MIN[currency] ?? 0.00001;
      if (data.amount < min) throw new AppError(`Minimum transfer is ${min} ${currency}`, 400);

      // Sender wallet
      const senderWallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: currency as any } },
      });
      if (!senderWallet) throw new AppError(`${currency} wallet not found`, 404);

      const available = parseFloat(senderWallet.balance.toString()) - parseFloat(senderWallet.frozen.toString());
      if (totalDeducted > available) throw new AppError(`Insufficient ${currency} balance`, 400);

      const reference = generateReference('TRF');
      const senderBalanceBefore = parseFloat(senderWallet.balance.toString());

      // Execute atomically
      await prisma.$transaction(async (tx: any) => {
        await tx.wallet.update({
          where: { userId_currency: { userId: req.user!.id, currency: currency as any } },
          data: { balance: { decrement: new Decimal(totalDeducted) } },
        });

        const recipientWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: recipient.id, currency: currency as any } },
        });
        const recipientBalanceBefore = parseFloat(recipientWallet?.balance.toString() || '0');

        await tx.wallet.upsert({
          where: { userId_currency: { userId: recipient.id, currency: currency as any } },
          update: { balance: { increment: new Decimal(data.amount) } },
          create: { userId: recipient.id, currency: currency as any, balance: data.amount },
        });

        await tx.transfer.create({
          data: {
            senderId: req.user!.id,
            receiverId: recipient.id,
            currency: currency as any,
            amount: data.amount,
            fee,
            reference,
            note: data.note,
          },
        });

        await tx.transaction.createMany({
          data: [
            {
              userId: req.user!.id,
              type: 'TRANSFER_OUT',
              currency: currency as any,
              amount: new Decimal(-totalDeducted),
              fee,
              balanceBefore: senderBalanceBefore,
              balanceAfter: senderBalanceBefore - totalDeducted,
              reference,
              description: `Sent ${data.amount} ${currency} to ${recipient.firstName}`,
            },
            {
              userId: recipient.id,
              type: 'TRANSFER_IN',
              currency: currency as any,
              amount: new Decimal(data.amount),
              fee: 0,
              balanceBefore: recipientBalanceBefore,
              balanceAfter: recipientBalanceBefore + data.amount,
              reference,
              description: `Received ${data.amount} ${currency} from transfer`,
            },
          ],
        });

        await tx.notification.create({
          data: {
            userId: recipient.id,
            title: `${currency} received`,
            message: `You received ${data.amount} ${currency}. Ref: ${reference}`,
            type: 'transfer',
          },
        });
      });

      res.status(201).json({
        message: 'Transfer successful',
        transfer: {
          currency,
          amount: data.amount,
          fee,
          total: totalDeducted,
          reference,
          recipient: { firstName: recipient.firstName, lastName: recipient.lastName },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [sent, received, totalSent, totalReceived] = await Promise.all([
        prisma.transfer.findMany({
          where: { senderId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { receiver: { select: { firstName: true, lastName: true, email: true } } },
        }),
        prisma.transfer.findMany({
          where: { receiverId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { sender: { select: { firstName: true, lastName: true, email: true } } },
        }),
        prisma.transfer.count({ where: { senderId: req.user!.id } }),
        prisma.transfer.count({ where: { receiverId: req.user!.id } }),
      ]);

      res.json({ sent, received, totalSent, totalReceived, page });
    } catch (error) {
      next(error);
    }
  }
}
