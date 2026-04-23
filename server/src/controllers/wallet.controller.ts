import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';

interface WalletRecord {
  id: string;
  userId: string;
  currency: string;
  balance: { toString(): string };
  frozen: { toString(): string };
}

interface RateRecord {
  baseCurrency: string;
  quoteCurrency: string;
  buyPrice: { toString(): string };
  sellPrice: { toString(): string };
  isActive: boolean;
}

export class WalletController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const wallets = await prisma.wallet.findMany({ where: { userId: req.user!.id } });
      res.json({ wallets });
    } catch (error) {
      next(error);
    }
  }

  static async getByCurrency(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const currency = req.params.currency.toUpperCase();
      const validCurrencies = ['LYD', 'USD', 'USDT'];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({ error: 'Invalid currency. Must be LYD, USD, or USDT' });
      }
      const wallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: currency as any } },
      });
      res.json({ wallet });
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const currency = req.params.currency.toUpperCase();
      const validCurrencies = ['LYD', 'USD', 'USDT'];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({ error: 'Invalid currency. Must be LYD, USD, or USDT' });
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId: req.user!.id, currency: currency as any },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.transaction.count({ where: { userId: req.user!.id, currency: currency as any } }),
      ]);
      res.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  static async getPortfolio(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const wallets = await prisma.wallet.findMany({ where: { userId: req.user!.id } });
      const rates = await prisma.exchangeRate.findMany({ where: { isActive: true } });

      let totalUsdValue = 0;
      const portfolio = wallets.map((wallet: WalletRecord) => {
        const balance = parseFloat(wallet.balance.toString());
        let usdValue = 0;

        if (wallet.currency === 'USD') {
          usdValue = balance;
        } else if (wallet.currency === 'USDT') {
          const rate = rates.find((r: RateRecord) => r.baseCurrency === 'USDT' && r.quoteCurrency === 'USD');
          usdValue = balance * parseFloat(rate?.sellPrice.toString() || '1');
        } else if (wallet.currency === 'LYD') {
          const rate = rates.find((r: RateRecord) => r.baseCurrency === 'USDT' && r.quoteCurrency === 'LYD');
          if (rate) usdValue = balance / parseFloat(rate.buyPrice.toString());
        }
        totalUsdValue += usdValue;
        return {
          currency: wallet.currency,
          balance,
          frozen: parseFloat(wallet.frozen.toString()),
          available: balance - parseFloat(wallet.frozen.toString()),
          usdValue,
        };
      });
      res.json({ portfolio, totalUsdValue });
    } catch (error) {
      next(error);
    }
  }
}
