import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { collectFee } from '../services/fee/feeCollector.service';
import { emitActivity } from '../utils/realtime';

// Accept amount as string OR number to preserve precision. parseFloat
// on user input is unsafe for money — never coerce to JS Number before
// the Decimal constructor sees it.
const orderSchema = z.object({
  side: z.enum(['BUY', 'SELL']),
  quoteCurrency: z.enum(['USD']),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

const ZERO = new Decimal(0);
const HUNDRED = new Decimal(100);

function dec(v: unknown): Decimal {
  return new Decimal((v as any)?.toString?.() ?? String(v));
}

export class OrderController {
  static async placeOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = orderSchema.parse(req.body);
      const amount = new Decimal(data.amount);
      if (amount.lte(0)) throw new AppError('Amount must be > 0', 400);

      const rate = await prisma.exchangeRate.findUnique({
        where: { baseCurrency_quoteCurrency: { baseCurrency: 'USDT', quoteCurrency: data.quoteCurrency } },
      });
      if (!rate || !rate.isActive) throw new AppError('Trading pair not available', 400);

      const feeSetting = await prisma.platformSettings.findUnique({ where: { key: 'trading_fee_percent' } });
      const feePercent = dec(feeSetting?.value ?? '0.5');
      const price = data.side === 'BUY' ? dec(rate.buyPrice) : dec(rate.sellPrice);
      const total = amount.mul(price);
      const fee = amount.mul(feePercent).div(HUNDRED);

      if (data.side === 'BUY') {
        await prisma.$transaction(async (tx: any) => {
          // Lock the quote wallet row so concurrent orders can't both pass
          // the balance check on the same available funds.
          const lockedQuote = await tx.$queryRaw<Array<any>>`
            SELECT id, balance, frozen FROM "Wallet"
            WHERE "userId" = ${req.user!.id} AND "currency" = ${data.quoteCurrency}
            FOR UPDATE
          `;
          const qw = lockedQuote?.[0];
          if (!qw) throw new AppError('Wallet not found', 404);

          const quoteBefore = dec(qw.balance);
          const quoteFrozen = dec(qw.frozen);
          const available = quoteBefore.sub(quoteFrozen);
          if (total.gt(available)) {
            throw new AppError(
              `Insufficient ${data.quoteCurrency} balance. Need ${total.toFixed(2)} ${data.quoteCurrency}`,
              400
            );
          }

          const usdtReceived = amount.sub(fee);

          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: data.quoteCurrency } },
            data: { balance: { decrement: total } },
          });

          const lockedUsdt = await tx.$queryRaw<Array<any>>`
            SELECT id, balance FROM "Wallet"
            WHERE "userId" = ${req.user!.id} AND "currency" = 'USDT'
            FOR UPDATE
          `;
          const usdtBefore = lockedUsdt?.[0] ? dec(lockedUsdt[0].balance) : ZERO;

          await tx.wallet.update({
            where: { userId_currency: { userId: req.user!.id, currency: 'USDT' } },
            data: { balance: { increment: usdtReceived } },
          });

          const buyOrder = await tx.order.create({
            data: {
              userId: req.user!.id, side: 'BUY', type: 'MARKET', baseCurrency: 'USDT',
              quoteCurrency: data.quoteCurrency, amount, price, filled: amount,
              total, fee, status: 'FILLED',
            },
          });

          await tx.transaction.createMany({
            data: [
              {
                userId: req.user!.id, type: 'BUY', currency: data.quoteCurrency,
                amount: total.neg(), fee: ZERO,
                balanceBefore: quoteBefore, balanceAfter: quoteBefore.sub(total),
                description: `Bought ${usdtReceived.toFixed(8)} USDT at ${price.toFixed(8)} ${data.quoteCurrency}`,
              },
              {
                userId: req.user!.id, type: 'BUY', currency: 'USDT',
                amount: usdtReceived, fee,
                balanceBefore: usdtBefore, balanceAfter: usdtBefore.add(usdtReceived),
                description: `Received ${usdtReceived.toFixed(8)} USDT`,
              },
            ],
          });

          // Pour the trading fee into the platform wallet
          await collectFee({
            tx,
            source:   'order',
            sourceId: buyOrder.id,
            payerId:  req.user!.id,
            amount:   fee,
            currency: 'USDT',
            description: `BUY ${data.quoteCurrency} fee`,
            metadata: { side: 'BUY', baseCurrency: 'USDT', quoteCurrency: data.quoteCurrency },
          });
        });

        emitActivity(req, [req.user!.id], { kind: 'transaction', type: 'BUY' });

        res.status(201).json({
          message: 'Order filled successfully',
          order: {
            side: 'BUY',
            amount: amount.toString(),
            price: price.toString(),
            total: total.toString(),
            fee: fee.toString(),
            received: amount.sub(fee).toString(),
            quoteCurrency: data.quoteCurrency,
          },
        });
        return;
      }

      // SELL USDT
      const sellFee = total.mul(feePercent).div(HUNDRED);
      const quoteReceived = total.sub(sellFee);

      await prisma.$transaction(async (tx: any) => {
        const lockedUsdt = await tx.$queryRaw<Array<any>>`
          SELECT id, balance, frozen FROM "Wallet"
          WHERE "userId" = ${req.user!.id} AND "currency" = 'USDT'
          FOR UPDATE
        `;
        const uw = lockedUsdt?.[0];
        if (!uw) throw new AppError('USDT wallet not found', 404);

        const usdtBefore = dec(uw.balance);
        const usdtFrozen = dec(uw.frozen);
        const available = usdtBefore.sub(usdtFrozen);
        if (amount.gt(available)) throw new AppError('Insufficient USDT balance', 400);

        await tx.wallet.update({
          where: { userId_currency: { userId: req.user!.id, currency: 'USDT' } },
          data: { balance: { decrement: amount } },
        });

        const lockedQuote = await tx.$queryRaw<Array<any>>`
          SELECT id, balance FROM "Wallet"
          WHERE "userId" = ${req.user!.id} AND "currency" = ${data.quoteCurrency}
          FOR UPDATE
        `;
        const quoteBefore = lockedQuote?.[0] ? dec(lockedQuote[0].balance) : ZERO;

        await tx.wallet.update({
          where: { userId_currency: { userId: req.user!.id, currency: data.quoteCurrency } },
          data: { balance: { increment: quoteReceived } },
        });

        const sellOrder = await tx.order.create({
          data: {
            userId: req.user!.id, side: 'SELL', type: 'MARKET', baseCurrency: 'USDT',
            quoteCurrency: data.quoteCurrency, amount, price, filled: amount,
            total, fee: sellFee, status: 'FILLED',
          },
        });

        await tx.transaction.createMany({
          data: [
            {
              userId: req.user!.id, type: 'SELL', currency: 'USDT',
              amount: amount.neg(), fee: ZERO,
              balanceBefore: usdtBefore, balanceAfter: usdtBefore.sub(amount),
              description: `Sold ${amount.toFixed(8)} USDT at ${price.toFixed(8)} ${data.quoteCurrency}`,
            },
            {
              userId: req.user!.id, type: 'SELL', currency: data.quoteCurrency,
              amount: quoteReceived, fee: sellFee,
              balanceBefore: quoteBefore, balanceAfter: quoteBefore.add(quoteReceived),
              description: `Received ${quoteReceived.toFixed(2)} ${data.quoteCurrency}`,
            },
          ],
        });

        // Pour the trading fee into the platform wallet
        await collectFee({
          tx,
          source:   'order',
          sourceId: sellOrder.id,
          payerId:  req.user!.id,
          amount:   sellFee,
          currency: data.quoteCurrency,
          description: `SELL USDT fee`,
          metadata: { side: 'SELL', baseCurrency: 'USDT', quoteCurrency: data.quoteCurrency },
        });
      });

      emitActivity(req, [req.user!.id], { kind: 'transaction', type: 'SELL' });

      res.status(201).json({
        message: 'Order filled successfully',
        order: {
          side: 'SELL',
          amount: amount.toString(),
          price: price.toString(),
          total: total.toString(),
          fee: sellFee.toString(),
          received: quoteReceived.toString(),
          quoteCurrency: data.quoteCurrency,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
      const limit = Math.min(100, parseInt(String(req.query.limit ?? '20'), 10) || 20);
      const side = req.query.side as string | undefined;

      const where: any = { userId: req.user!.id };
      if (side === 'BUY' || side === 'SELL') where.side = side;

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
