import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const orderSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  quoteCurrency: z.enum(['USD']),
  amount: z.number().positive(),
});

export class OrderController {
  static async placeOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = orderSchema.parse(req.body);

      const rate = await prisma.exchangeRate.findUnique({
        where: { baseCurrency_quoteCurrency: { baseCurrency: 'USDT', quoteCurrency: data.quoteCurrency } },
      });
      if (!rate || !rate.isActive) throw new AppError('Trading pair not available', 400);

      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: 'trading_fee_percent' } });
      const feePercent = parseFloat(feeSetting?.value || '0.5');
      const price = data.side === 'BUY' ? parseFloat(rate.buyPrice.toString()) : parseFloat(rate.sellPrice.toString());
      const total = data.amount * price;
      const fee = (data.amount * feePercent) / 100;

      if (data.side === 'BUY') {
        const quoteWallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: req.user!.id, currency: data.quoteCurrency } },
        });
        if (!quoteWallet) throw new AppError('Wallet not found', 404);
        const available = parseFloat(quoteWallet.balance.toString()) - parseFloat(quoteWallet.frozen.toString());
        if (total > available) throw new AppError(`Insufficient ${data.quoteCurrency} balance. Need ${total.toFixed(2)} ${data.quoteCurrency}`, 400);

        const usdtReceived = data.amount - fee;

        await prisma.$transaction(async (tx: any) => {
          const quoteBefore = parseFloat(quoteWallet.balance.toString());
          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: data.quoteCurrency } },
            data: { balance: { decrement: new Decimal(total) } },
          });

          const usdtWallet = await tx.wallet.findUnique({
            where: { userId_currency: { userId: req.user!.id, currency: 'USDT' } },
          });
          const usdtBefore = parseFloat(usdtWallet?.balance.toString() || '0');

          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: 'USDT' } },
            data: { balance: { increment: new Decimal(usdtReceived) } },
          });

          await tx.order.create({
            data: {
              userId: req.user!.id, side: 'BUY', type: 'MARKET', baseCurrency: 'USDT',
              quoteCurrency: data.quoteCurrency, amount: data.amount, price, filled: data.amount,
              total, fee, status: 'FILLED',
            },
          });

          await tx.transaction.createMany({
            data: [
              {
                userId: req.user!.id, type: 'BUY', currency: data.quoteCurrency,
                amount: new Decimal(-total), fee: 0, balanceBefore: quoteBefore,
                balanceAfter: quoteBefore - total, description: `Bought ${usdtReceived.toFixed(8)} USDT at ${price} ${data.quoteCurrency}`,
              },
              {
                userId: req.user!.id, type: 'BUY', currency: 'USDT',
                amount: new Decimal(usdtReceived), fee, balanceBefore: usdtBefore,
                balanceAfter: usdtBefore + usdtReceived, description: `Received ${usdtReceived.toFixed(8)} USDT`,
              },
            ],
          });
        });

        res.status(201).json({
          message: 'Order filled successfully',
          order: { side: 'BUY', amount: data.amount, price, total, fee, received: usdtReceived, quoteCurrency: data.quoteCurrency },
        });
      } else {
        // SELL USDT
        const usdtWallet = await prisma.wallet.findUnique({
          where: { userId_currency: { userId: req.user!.id, currency: 'USDT' } },
        });
        if (!usdtWallet) throw new AppError('USDT wallet not found', 404);
        const available = parseFloat(usdtWallet.balance.toString()) - parseFloat(usdtWallet.frozen.toString());
        if (data.amount > available) throw new AppError('Insufficient USDT balance', 400);

        const quoteReceived = total - (total * feePercent / 100);

        await prisma.$transaction(async (tx: any) => {
          const usdtBefore = parseFloat(usdtWallet.balance.toString());
          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: 'USDT' } },
            data: { balance: { decrement: new Decimal(data.amount) } },
          });

          const quoteWallet = await tx.wallet.findUnique({
            where: { userId_currency: { userId: req.user!.id, currency: data.quoteCurrency } },
          });
          const quoteBefore = parseFloat(quoteWallet?.balance.toString() || '0');

          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: data.quoteCurrency } },
            data: { balance: { increment: new Decimal(quoteReceived) } },
          });

          await tx.order.create({
            data: {
              userId: req.user!.id, side: 'SELL', type: 'MARKET', baseCurrency: 'USDT',
              quoteCurrency: data.quoteCurrency, amount: data.amount, price, filled: data.amount,
              total, fee: total * feePercent / 100, status: 'FILLED',
            },
          });

          await tx.transaction.createMany({
            data: [
              {
                userId: req.user!.id, type: 'SELL', currency: 'USDT',
                amount: new Decimal(-data.amount), fee: 0, balanceBefore: usdtBefore,
                balanceAfter: usdtBefore - data.amount, description: `Sold ${data.amount} USDT at ${price} ${data.quoteCurrency}`,
              },
              {
                userId: req.user!.id, type: 'SELL', currency: data.quoteCurrency,
                amount: new Decimal(quoteReceived), fee: total * feePercent / 100,
                balanceBefore: quoteBefore, balanceAfter: quoteBefore + quoteReceived,
                description: `Received ${quoteReceived.toFixed(2)} ${data.quoteCurrency}`,
              },
            ],
          });
        });

        res.status(201).json({
          message: 'Order filled successfully',
          order: { side: 'SELL', amount: data.amount, price, total, fee: total * feePercent / 100, received: quoteReceived, quoteCurrency: data.quoteCurrency },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const side = req.query.side as string | undefined;

      const where: any = { userId: req.user!.id };
      if (side) where.side = side.toUpperCase();

      const [orders, total] = await Promise.all([
        prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.order.count({ where }),
      ]);
      res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }
}
