import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { getMarketPrice } from '../services/exchange/priceEngine.service';

const FIAT_USD_RATES: Record<string, number> = {
  USD: 1, USDT: 1,
  EUR: 1.08, GBP: 1.25,
  AED: 0.272, SAR: 0.267, EGP: 0.0202, LYD: 0.206,
};

const CRYPTO_USD_FALLBACK: Record<string, number> = {
  BTC: 65_000, ETH: 3_200, BNB: 600, SOL: 150,
  XRP: 0.55, ADA: 0.45, DOGE: 0.12, MATIC: 0.62,
  DOT: 7.4, AVAX: 34.2, USDT: 1, USDC: 1,
};

function inclusiveDateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const createdAt: any = {};
  if (from) createdAt.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.lte = end;
  }
  return createdAt;
}

function txCategory(type: string): 'deposit' | 'withdrawal' | 'transferIn' | 'transferOut' | 'buy' | 'sell' | 'fee' | 'other' {
  if (type === 'DEPOSIT' || type === 'ADMIN_CREDIT' || type === 'REFERRAL_BONUS') return 'deposit';
  if (type === 'WITHDRAWAL' || type === 'ADMIN_DEBIT') return 'withdrawal';
  if (type === 'TRANSFER_IN') return 'transferIn';
  if (type === 'TRANSFER_OUT') return 'transferOut';
  if (type === 'BUY') return 'buy';
  if (type === 'SELL') return 'sell';
  if (type === 'FEE' || type === 'COMMISSION') return 'fee';
  return 'other';
}

async function usdPrice(currency: string): Promise<number> {
  const code = currency.toUpperCase();
  if (FIAT_USD_RATES[code] != null) return FIAT_USD_RATES[code];
  if (CRYPTO_USD_FALLBACK[code] != null) {
    if (code === 'USDT' || code === 'USDC') return 1;
    try {
      const px = await getMarketPrice(`${code}USDT`);
      const n = Number(px.toString());
      if (Number.isFinite(n) && n > 0) return n;
    } catch { /* fallback below */ }
    return CRYPTO_USD_FALLBACK[code];
  }
  return 0;
}

function nativeCryptoHoldings(userWallet: any | null | undefined): Array<{ currency: string; balance: string; frozen: string; source: string }> {
  if (!userWallet) return [];
  const out = [
    { currency: 'BTC',  balance: userWallet.btcBalance?.toString?.() ?? '0', frozen: '0', source: 'self_custody' },
    { currency: 'ETH',  balance: userWallet.ethBalance?.toString?.() ?? '0', frozen: '0', source: 'self_custody' },
    { currency: 'SOL',  balance: userWallet.solBalance?.toString?.() ?? '0', frozen: '0', source: 'self_custody' },
    { currency: 'USDT', balance: userWallet.usdtErc20Bal?.toString?.() ?? '0', frozen: '0', source: 'self_custody_erc20' },
    { currency: 'USDT', balance: userWallet.usdtTrc20Bal?.toString?.() ?? '0', frozen: '0', source: 'self_custody_trc20' },
  ];
  const alt = userWallet.altBalances && typeof userWallet.altBalances === 'object' ? userWallet.altBalances : {};
  for (const [currency, balance] of Object.entries(alt)) {
    out.push({ currency: String(currency).toUpperCase(), balance: String(balance ?? '0'), frozen: '0', source: 'self_custody_alt' });
  }
  return out;
}

export class ExportController {
  // Export transactions as CSV
  static async exportCSV(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { from, to, type } = req.query;

      const where: any = { userId };
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) where.createdAt.lte = new Date(to as string);
      }
      if (type) where.type = type;

      const txs = await prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      const header = 'Date,Type,Currency,Amount,Fee,Balance Before,Balance After,Reference,Description\n';
      const rows = txs.map((t: any) =>
        [
          t.createdAt.toISOString(),
          t.type,
          t.currency,
          t.amount.toString(),
          t.fee.toString(),
          t.balanceBefore.toString(),
          t.balanceAfter.toString(),
          t.reference || '',
          `"${(t.description || '').replace(/"/g, '""')}"`,
        ].join(',')
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      const filename = `tazdan-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(header + rows);
    } catch (error) {
      next(error);
    }
  }

  // Export transactions as JSON (for PDF generation on client)
  static async exportJSON(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { from, to, type, currency } = req.query;

      const where: any = { userId };
      const createdAt = inclusiveDateRange(from as string | undefined, to as string | undefined);
      if (createdAt) where.createdAt = createdAt;
      if (type) where.type = type;
      if (currency) where.currency = String(currency).toUpperCase();

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, baseCurrency: true },
      });
      if (!user) throw new AppError('User not found', 404);

      const [txs, walletRows, userWallet, recurringBuys, recurringOrders] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.wallet.findMany({
          where: { userId, ...(currency ? { currency: String(currency).toUpperCase() as any } : {}) },
          select: { currency: true, balance: true, frozen: true, updatedAt: true },
          orderBy: { currency: 'asc' },
        }),
        (prisma as any).userWallet.findUnique({ where: { userId } }).catch(() => null),
        prisma.recurringBuy.findMany({
          where: { userId, status: { not: 'CANCELLED' } },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, asset: true, network: true, fiatCurrency: true, fiatAmount: true,
            frequency: true, sourceType: true, sourceId: true, status: true,
            nextRunAt: true, lastRunAt: true, runCount: true, failureCount: true,
            lastError: true, createdAt: true,
          },
        }).catch(() => []),
        (prisma as any).cryptoOrder.findMany({
          where: {
            userId,
            idempotencyKey: { startsWith: 'rb_' },
            ...(createdAt ? { createdAt } : {}),
          },
          select: { id: true, idempotencyKey: true },
        }).catch(() => []),
      ]);

      const recurringOrderIds = new Set((recurringOrders as any[]).map((o) => o.id));
      const prices: Record<string, number> = {};
      const holdingInputs = [
        ...walletRows.map((w) => ({ currency: String(w.currency), balance: w.balance.toString(), frozen: w.frozen.toString(), source: 'wallet' })),
        ...nativeCryptoHoldings(userWallet),
      ].filter((w) => !currency || w.currency === String(currency).toUpperCase());

      for (const code of Array.from(new Set([
        ...holdingInputs.map((w) => w.currency),
        ...txs.map((t) => String(t.currency)),
        ...recurringBuys.map((r) => String(r.fiatCurrency)),
        ...recurringBuys.map((r) => String(r.asset)),
      ]))) {
        prices[code] = await usdPrice(code);
      }

      const wallets = holdingInputs.map((w) => {
        const balance = Number(w.balance);
        const frozen = Number(w.frozen);
        const priceUsd = prices[w.currency] ?? 0;
        return {
          ...w,
          priceUsd: priceUsd.toFixed(8),
          valueUsd: (balance * priceUsd).toFixed(2),
          frozenValueUsd: (frozen * priceUsd).toFixed(2),
        };
      });

      const totalAccountValueUsd = wallets.reduce((sum, w) => sum + Number(w.valueUsd), 0);
      const totalFrozenUsd = wallets.reduce((sum, w) => sum + Number(w.frozenValueUsd), 0);
      const byCategory = {
        deposits: 0, withdrawals: 0, transferIn: 0, transferOut: 0,
        buys: 0, sells: 0, fees: 0, recurringBuys: 0, other: 0,
      };
      const byCurrency: Record<string, { debit: number; credit: number; fees: number; count: number }> = {};
      const transactions = txs.map((t: any) => {
        const amount = Number(t.amount.toString());
        const fee = Number(t.fee?.toString?.() ?? '0');
        const category = txCategory(t.type);
        const metadata = t.metadata && typeof t.metadata === 'object' ? t.metadata : null;
        const isRecurringExecution = Boolean(metadata?.orderId && recurringOrderIds.has(metadata.orderId));
        const priceUsd = prices[String(t.currency)] ?? 0;
        if (!byCurrency[t.currency]) byCurrency[t.currency] = { debit: 0, credit: 0, fees: 0, count: 0 };
        byCurrency[t.currency].count += 1;
        byCurrency[t.currency].fees += Math.abs(fee);
        if (amount < 0) byCurrency[t.currency].debit += Math.abs(amount);
        else byCurrency[t.currency].credit += amount;
        if (category === 'deposit') byCategory.deposits += amount;
        else if (category === 'withdrawal') byCategory.withdrawals += Math.abs(amount);
        else if (category === 'transferIn') byCategory.transferIn += amount;
        else if (category === 'transferOut') byCategory.transferOut += Math.abs(amount);
        else if (category === 'buy') byCategory.buys += Math.abs(amount);
        else if (category === 'sell') byCategory.sells += amount;
        else if (category === 'fee') byCategory.fees += Math.abs(amount);
        else byCategory.other += Math.abs(amount);
        if (isRecurringExecution) byCategory.recurringBuys += Math.abs(amount);
        byCategory.fees += Math.abs(fee);
        return {
          id: t.id,
          type: t.type,
          category,
          currency: t.currency,
          amount: t.amount.toString(),
          debit: amount < 0 ? Math.abs(amount).toFixed(8) : '0',
          credit: amount > 0 ? amount.toFixed(8) : '0',
          fee: t.fee.toString(),
          balanceBefore: t.balanceBefore.toString(),
          balanceAfter: t.balanceAfter.toString(),
          valueUsd: (amount * priceUsd).toFixed(2),
          balanceAfterValueUsd: (Number(t.balanceAfter.toString()) * priceUsd).toFixed(2),
          reference: t.reference ?? null,
          description: t.description ?? null,
          metadata,
          source: isRecurringExecution ? 'RECURRING_BUY' : 'MANUAL',
          createdAt: t.createdAt.toISOString(),
        };
      });

      res.json({
        user,
        summary: {
          totalTransactions: txs.length,
          totalDeposits: byCategory.deposits,
          totalWithdrawals: byCategory.withdrawals,
          totalFees: byCategory.fees,
          totalTransfersIn: byCategory.transferIn,
          totalTransfersOut: byCategory.transferOut,
          totalBuys: byCategory.buys,
          totalSells: byCategory.sells,
          totalRecurringBuys: byCategory.recurringBuys,
          totalAccountValueUsd,
          totalFrozenUsd,
          byCurrency,
        },
        wallets,
        recurringBuys: recurringBuys.map((r) => ({
          ...r,
          fiatAmount: r.fiatAmount.toString(),
          nextRunAt: r.nextRunAt?.toISOString?.() ?? null,
          lastRunAt: r.lastRunAt?.toISOString?.() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
        transactions,
        valuation: {
          currency: 'USD',
          totalAccountValueUsd: totalAccountValueUsd.toFixed(2),
          totalFrozenUsd: totalFrozenUsd.toFixed(2),
          prices,
          pricedAt: new Date().toISOString(),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  // Get portfolio history for analytics
  static async getPortfolioHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;

      const since = new Date(Date.now() - days * 86400000);
      const txs = await prisma.transaction.findMany({
        where: { userId, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { type: true, currency: true, amount: true, fee: true, balanceAfter: true, createdAt: true },
      });

      // Group by day
      const dailyMap: Record<string, { date: string; deposits: number; withdrawals: number; trades: number; fees: number }> = {};
      txs.forEach((t: any) => {
        const day = t.createdAt.toISOString().slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { date: day, deposits: 0, withdrawals: 0, trades: 0, fees: 0 };
        const amt = parseFloat(t.amount.toString());
        if (t.type === 'DEPOSIT' || t.type === 'AGENT_DEPOSIT') dailyMap[day].deposits += amt;
        else if (t.type === 'WITHDRAWAL' || t.type === 'AGENT_WITHDRAWAL') dailyMap[day].withdrawals += amt;
        else if (t.type === 'BUY' || t.type === 'SELL') dailyMap[day].trades += amt;
        dailyMap[day].fees += parseFloat(t.fee.toString());
      });

      // Current wallet balances
      const wallets = await prisma.wallet.findMany({
        where: { userId },
        select: { currency: true, balance: true, frozen: true },
      });

      res.json({
        history: Object.values(dailyMap),
        currentBalances: wallets,
        period: { from: since.toISOString(), to: new Date().toISOString(), days },
      });
    } catch (error) {
      next(error);
    }
  }
}
