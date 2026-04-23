import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

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
      const filename = `promrkts-transactions-${new Date().toISOString().split('T')[0]}.csv`;
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
      const { from, to, type } = req.query;

      const where: any = { userId };
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) where.createdAt.lte = new Date(to as string);
      }
      if (type) where.type = type;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true, createdAt: true },
      });

      const txs = await prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      const wallets = await prisma.wallet.findMany({
        where: { userId },
        select: { currency: true, balance: true },
      });

      // Summary stats
      const totalDeposits = txs.filter((t: any) => t.type === 'DEPOSIT').reduce((s: number, t: any) => s + parseFloat(t.amount.toString()), 0);
      const totalWithdrawals = txs.filter((t: any) => t.type === 'WITHDRAWAL').reduce((s: number, t: any) => s + parseFloat(t.amount.toString()), 0);
      const totalFees = txs.reduce((s: number, t: any) => s + parseFloat(t.fee.toString()), 0);

      res.json({
        user,
        summary: { totalTransactions: txs.length, totalDeposits, totalWithdrawals, totalFees },
        wallets,
        transactions: txs,
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
