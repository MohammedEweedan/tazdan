import { Response, NextFunction } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { z } from 'zod';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { sendSwapConfirmed } from '../services/email';
import { pushCopy, pushTxEvent } from '../services/push.service';
import { isLedgerCurrency, postLedger } from '../services/ledger/ledger.service';

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

// Hardcoded FX rates for fiat currencies (no Binance pair available).
const FIAT_RATES: Record<string, number> = {
  USD: 1, USDT: 1,
  EUR: 1.08, GBP: 1.25,
  AED: 0.272, SAR: 0.267, EGP: 0.0202, LYD: 0.206,
};

const CRYPTO_FALLBACK: Record<string, number> = {
  BTC: 65_240, ETH: 3_215, SOL: 150, BNB: 602,
  XRP: 0.55, ADA: 0.45, DOGE: 0.12, MATIC: 0.62,
  DOT: 7.40, AVAX: 34.20,
};

const BINANCE_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
  'ADAUSDT','DOGEUSDT','MATICUSDT','DOTUSDT','AVAXUSDT',
];

let livePriceCache: Record<string, number> = {};
let livePriceCacheExpiry = 0;

async function getLivePrices(): Promise<Record<string, number>> {
  if (Date.now() < livePriceCacheExpiry) return livePriceCache;
  try {
    const symbols = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS));
    const { data } = await axios.get(
      `https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`,
      { timeout: 5_000 },
    );
    const fresh: Record<string, number> = { ...FIAT_RATES };
    for (const row of data as { symbol: string; price: string }[]) {
      const base = row.symbol.replace('USDT', '');
      fresh[base] = parseFloat(row.price);
    }
    livePriceCache = fresh;
    livePriceCacheExpiry = Date.now() + 30_000;
    return fresh;
  } catch {
    return Object.keys(livePriceCache).length
      ? livePriceCache
      : { ...FIAT_RATES, ...CRYPTO_FALLBACK };
  }
}

function fiatValueUsd(currency: string, balance: number, prices: Record<string, number>): number {
  const rate = prices[currency] ?? 0;
  return +(balance * rate).toFixed(2);
}

export class WalletController {
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const [rows, prices] = await Promise.all([
        prisma.wallet.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'asc' },
        }),
        getLivePrices(),
      ]);
      const wallets = rows.map((w) => {
        const balance = parseFloat(w.balance.toString());
        return {
          id: w.id,
          currency: w.currency,
          balance: w.balance.toString(),
          frozen: w.frozen.toString(),
          fiatValueUsd: fiatValueUsd(w.currency, balance, prices).toString(),
        };
      });
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

  /**
   * Generic atomic swap between any two of the user's wallets.
   *
   *   body: { from: Currency, to: Currency, amount: number }
   *
   * The exchange rate is derived from `USD_PRICE` so we don't need a populated
   * `ExchangeRate` table for every pair. This is the endpoint the mobile
   * Buy / Sell screens hit so the user sees holdings change immediately.
   */
  static async swap(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const schema = z.object({
        from:   z.string().toUpperCase(),
        to:     z.string().toUpperCase(),
        amount: z.number().positive(),
      });
      const { from, to, amount } = schema.parse(req.body);
      if (from === to) throw new AppError('From and to currencies must differ', 400);

      const prices = await getLivePrices();
      const fromPx = prices[from];
      const toPx   = prices[to];
      if (!fromPx || !toPx) {
        throw new AppError(`Unsupported currency pair ${from}->${to}`, 400);
      }
      // Pricing in Decimal so we don't lose precision on large
      // amounts.  The old code did `usdValue = amount * fromPx`
      // (number × number) — a 1e16 USDT swap collapsed the mantissa
      // and produced free extra `credited` units.
      const amountD   = new Decimal(amount);
      const fromPxD   = new Decimal(fromPx);
      const toPxD     = new Decimal(toPx);
      const usdValueD = amountD.mul(fromPxD);
      const creditedD = usdValueD.div(toPxD);
      const credited  = creditedD.toNumber(); // for the response only

      const result = await prisma.$transaction(async (tx) => {
        // Make sure both wallets exist for this user (auto-create the
        // destination one if missing — common when the user picks a coin
        // they don't yet hold).
        const [fromWallet, toWalletExisting] = await Promise.all([
          tx.wallet.findUnique({
            where: { userId_currency: { userId: req.user!.id, currency: from as any } },
          }),
          tx.wallet.findUnique({
            where: { userId_currency: { userId: req.user!.id, currency: to as any } },
          }),
        ]);
        if (!fromWallet) throw new AppError(`No ${from} wallet`, 404);
        // Balance check uses Decimal arithmetic — float subtraction
        // was the second half of the rounding bug.
        const fromBalanceD = new Decimal(fromWallet.balance.toString());
        const fromFrozenD  = new Decimal(fromWallet.frozen.toString());
        const availableD   = fromBalanceD.sub(fromFrozenD);
        if (availableD.lt(amountD)) {
          throw new AppError(`Insufficient ${from}. Need ${amount}, have ${availableD.toFixed(8)}`, 400);
        }

        const toWallet = toWalletExisting ?? await tx.wallet.create({
          data: { userId: req.user!.id, currency: to as any, balance: 0, frozen: 0 },
        });
        const toBalanceD = new Decimal(toWallet.balance.toString());
        const reference = `SWP-${Date.now().toString(36).toUpperCase()}`;

        // Apply balance changes
        await tx.wallet.update({
          where: { id: fromWallet.id },
          data: { balance: { decrement: amountD } },
        });
        await tx.wallet.update({
          where: { id: toWallet.id },
          data: { balance: { increment: creditedD } },
        });

        if (isLedgerCurrency(from) && isLedgerCurrency(to)) {
          await postLedger(tx as any, {
            refType: 'swap',
            refId: reference,
            memo: `Swap ${amountD.toString()} ${from} to ${creditedD.toFixed(18)} ${to}`,
            legs: [
              { type: 'USER', userId: req.user!.id, currency: from as any, amount: amountD.neg() },
              { type: 'SYSTEM_FX', currency: from as any, amount: amountD },
              { type: 'SYSTEM_FX', currency: to as any, amount: creditedD.neg() },
              { type: 'USER', userId: req.user!.id, currency: to as any, amount: creditedD },
            ],
          }, { allowNegativeUser: true });
        }
        const fromBalance = fromBalanceD.toNumber();
        const toBalance   = toBalanceD.toNumber();

        // Generate a faux on-chain hash so the receipt has something to
        // display in the activity feed. In a real system this would be set
        // by the chain RPC after broadcast.
        const fakeHash = '0x' + [...Array(64)]
          .map(() => Math.floor(Math.random() * 16).toString(16))
          .join('');

        // Two transaction rows — one debit, one credit (paired by reference).
        await tx.transaction.createMany({
          data: [
            {
              userId: req.user!.id,
              type: 'SELL',
              currency: from as any,
              amount: new Decimal(-amount),
              balanceBefore: new Decimal(fromBalance),
              balanceAfter:  new Decimal(fromBalance - amount),
              description: `Swapped ${amount} ${from} → ${credited.toFixed(8)} ${to}`,
              reference,
              metadata: { hash: fakeHash, kind: 'swap', counterparty: to },
            },
            {
              userId: req.user!.id,
              type: 'BUY',
              currency: to as any,
              amount: new Decimal(credited),
              balanceBefore: new Decimal(toBalance),
              balanceAfter:  new Decimal(toBalance + credited),
              description: `Swapped ${amount} ${from} → ${credited.toFixed(8)} ${to}`,
              reference,
              metadata: { hash: fakeHash, kind: 'swap', counterparty: from },
            },
          ],
        });

        return { from, to, amount, credited, rate: fromPx / toPx, reference };
      }, {
        // SERIALIZABLE so two concurrent swaps on the same `from`
        // wallet can't both pass the balance check off a stale read.
        isolationLevel: 'Serializable',
      });

      // Fire-and-forget: send confirmation email + push. Failures here
      // never block the response — the swap has already settled.
      const userId = req.user!.id;
      (async () => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, notificationPrefs: true as any },
          });
          if (!user) return;
          const prefs = (user as any).notificationPrefs ?? {};
          const fromAmt = amount.toFixed(8).replace(/\.?0+$/, '');
          const toAmt   = result.credited.toFixed(8).replace(/\.?0+$/, '');
          const rate    = result.rate.toFixed(8).replace(/\.?0+$/, '');
          if (prefs?.email?.trades !== false) {
            await sendSwapConfirmed({
              to: user.email,
              firstName: user.firstName || 'there',
              fromAsset: from, fromAmount: fromAmt,
              toAsset: to,     toAmount: toAmt,
              rate, fees: '0',
              orderId: result.reference,
            });
          }
          if (prefs?.push?.trades !== false) {
            await pushTxEvent(userId, pushCopy.swap(fromAmt, from, toAmt, to), result.reference);
          }
        } catch (err) {
          logger.warn('[wallet.swap] post-commit notify failed', { userId, err });
        }
      })();

      res.status(201).json({ message: 'Swap complete', swap: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Top-level paginated list of every transaction for the authed user.
   * The mobile app calls this for the "History" tab on the home dashboard.
   */
  static async getAllTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page  = parseInt(req.query.page as string)  || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const [items, total] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId: req.user!.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.transaction.count({ where: { userId: req.user!.id } }),
      ]);
      res.json({
        items: items.map((t) => ({
          id: t.id,
          type: t.type,
          currency: t.currency,
          amount: t.amount.toString(),
          fee: t.fee.toString(),
          description: t.description,
          // The mobile history screen surfaces this as a tappable hash chip.
          reference: t.reference ?? null,
          // Demo: the public txid for on-chain transactions would live in
          // metadata.hash. Surface it as `txHash` so the UI can show it.
          txHash: (t.metadata && (t.metadata as any).hash) ?? null,
          status: 'COMPLETED',
          createdAt: t.createdAt,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
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
