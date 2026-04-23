import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const rateSchema = z.object({
  buyPrice: z.number().positive(),
  sellPrice: z.number().positive(),
});

export class AdminController {
  // ── Dashboard ──────────────────────────────────────────────────
  static async getDashboard(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsers, activeUsers, newUsersToday, newUsersWeek,
        pendingDeposits, pendingWithdrawals, pendingKYC,
        todayOrders, totalOrders, totalOrdersMonth,
        totalDepositsLYD, totalDepositsUSD, totalDepositsUSDT,
        totalWithdrawalsLYD, totalWithdrawalsUSD, totalWithdrawalsUSDT,
        todayOrderVolume, monthOrderVolume,
        totalFees, todayFees,
        totalAgents, totalTransfers,
        recentOrders, recentDeposits,
        buyOrders, sellOrders,
        ordersByPairRaw,
        userGrowthRaw,
      ] = await Promise.all([
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.user.count({ where: { role: 'USER', status: 'ACTIVE' } }),
        prisma.user.count({ where: { role: 'USER', createdAt: { gte: todayStart } } }),
        prisma.user.count({ where: { role: 'USER', createdAt: { gte: sevenDaysAgo } } }),
        prisma.deposit.count({ where: { status: 'PENDING' } }),
        prisma.withdrawal.count({ where: { status: 'PENDING' } }),
        prisma.user.count({ where: { kycStatus: 'PENDING' } }),
        prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.order.count(),
        prisma.order.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.deposit.aggregate({ where: { status: 'CONFIRMED', currency: 'LYD' }, _sum: { amount: true } }),
        prisma.deposit.aggregate({ where: { status: 'CONFIRMED', currency: 'USD' }, _sum: { amount: true } }),
        prisma.deposit.aggregate({ where: { status: 'CONFIRMED', currency: 'USDT' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { status: 'COMPLETED', currency: 'LYD' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { status: 'COMPLETED', currency: 'USD' }, _sum: { amount: true } }),
        prisma.withdrawal.aggregate({ where: { status: 'COMPLETED', currency: 'USDT' }, _sum: { amount: true } }),
        prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, status: { in: ['FILLED', 'PARTIALLY_FILLED'] } }, _sum: { total: true } }),
        prisma.order.aggregate({ where: { createdAt: { gte: thirtyDaysAgo }, status: { in: ['FILLED', 'PARTIALLY_FILLED'] } }, _sum: { total: true } }),
        prisma.order.aggregate({ where: { status: { in: ['FILLED', 'PARTIALLY_FILLED'] } }, _sum: { fee: true } }),
        prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, status: { in: ['FILLED', 'PARTIALLY_FILLED'] } }, _sum: { fee: true } }),
        prisma.user.count({ where: { role: 'AGENT' } }),
        prisma.transfer.count(),
        prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { email: true, firstName: true, lastName: true } } } }),
        prisma.deposit.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: { email: true, firstName: true } } } }),
        prisma.order.count({ where: { side: 'BUY' } }),
        prisma.order.count({ where: { side: 'SELL' } }),
        prisma.order.groupBy({ by: ['baseCurrency', 'quoteCurrency'], _count: { id: true }, _sum: { total: true }, orderBy: { _count: { id: 'desc' } } }),
        prisma.user.groupBy({ by: ['createdAt'], where: { createdAt: { gte: sevenDaysAgo } }, _count: { id: true }, orderBy: { createdAt: 'asc' } }),
      ]);

      // Format orders by pair
      const ordersByPair = ordersByPairRaw.map((p: any) => ({
        pair: `${p.baseCurrency}/${p.quoteCurrency}`,
        count: p._count.id,
        volume: p._sum.total || 0,
      }));

      // Aggregate user growth by date
      const growthMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        growthMap[d.toISOString().slice(0, 10)] = 0;
      }
      userGrowthRaw.forEach((r: any) => {
        const key = new Date(r.createdAt).toISOString().slice(0, 10);
        if (growthMap[key] !== undefined) growthMap[key] += r._count.id;
      });
      const userGrowth = Object.entries(growthMap).map(([date, count]) => ({ date, count }));

      res.json({
        totalUsers, activeUsers, newUsersToday, newUsersWeek,
        pendingDeposits, pendingWithdrawals, pendingKYC,
        todayOrders, totalOrders, totalOrdersMonth,
        totalDepositsLYD: totalDepositsLYD._sum.amount || 0,
        totalDepositsUSD: totalDepositsUSD._sum.amount || 0,
        totalDepositsUSDT: totalDepositsUSDT._sum.amount || 0,
        totalWithdrawalsLYD: totalWithdrawalsLYD._sum.amount || 0,
        totalWithdrawalsUSD: totalWithdrawalsUSD._sum.amount || 0,
        totalWithdrawalsUSDT: totalWithdrawalsUSDT._sum.amount || 0,
        todayOrderVolume: todayOrderVolume._sum.total || 0,
        monthOrderVolume: monthOrderVolume._sum.total || 0,
        totalFees: totalFees._sum.fee || 0,
        todayFees: todayFees._sum.fee || 0,
        totalAgents, totalTransfers,
        buyOrders, sellOrders,
        ordersByPair,
        userGrowth,
        recentOrders,
        recentDeposits,
      });
    } catch (error) { next(error); }
  }

  // ── Exchange Rates ─────────────────────────────────────────────
  static async updateRates(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { base, quote } = req.params;
      const data = rateSchema.parse(req.body);
      if (data.sellPrice >= data.buyPrice) throw new AppError('Sell price must be lower than buy price', 400);

      const rate = await prisma.exchangeRate.upsert({
        where: { baseCurrency_quoteCurrency: { baseCurrency: base.toUpperCase() as any, quoteCurrency: quote.toUpperCase() as any } },
        update: { buyPrice: data.buyPrice, sellPrice: data.sellPrice, setBy: req.user!.id },
        create: { baseCurrency: base.toUpperCase() as any, quoteCurrency: quote.toUpperCase() as any, buyPrice: data.buyPrice, sellPrice: data.sellPrice, setBy: req.user!.id },
      });

      const io = req.app.get('io');
      if (io) io.to('prices').emit('price:update', { baseCurrency: rate.baseCurrency, quoteCurrency: rate.quoteCurrency, buyPrice: rate.buyPrice, sellPrice: rate.sellPrice });

      await prisma.auditLog.create({
        data: { userId: req.user!.id, action: 'UPDATE_RATE', entity: 'ExchangeRate', entityId: rate.id, newValues: { buyPrice: data.buyPrice, sellPrice: data.sellPrice } },
      });
      res.json({ rate });
    } catch (error) { next(error); }
  }

  // ── Deposits ───────────────────────────────────────────────────
  static async getDeposits(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status.toUpperCase();

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          where, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.deposit.count({ where }),
      ]);
      res.json({ deposits, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async confirmDeposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findUnique({ where: { id: req.params.id } });
      if (!deposit) throw new AppError('Deposit not found', 404);
      if (deposit.status !== 'PENDING') throw new AppError('Deposit is not pending', 400);

      await prisma.$transaction(async (tx: any) => {
        await tx.deposit.update({ where: { id: deposit.id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), confirmedBy: req.user!.id, adminNotes: req.body.notes } });
        const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: deposit.userId, currency: deposit.currency } } });
        const balanceBefore = parseFloat(wallet?.balance.toString() || '0');
        const amount = parseFloat(deposit.amount.toString());
        await tx.wallet.update({ where: { userId_currency: { userId: deposit.userId, currency: deposit.currency } }, data: { balance: { increment: deposit.amount } } });
        await tx.transaction.create({ data: { userId: deposit.userId, type: 'DEPOSIT', currency: deposit.currency, amount: deposit.amount, balanceBefore, balanceAfter: balanceBefore + amount, reference: deposit.reference, description: `Deposit confirmed via ${deposit.paymentMethod}` } });
        await tx.notification.create({ data: { userId: deposit.userId, title: 'Deposit Confirmed', message: `Your deposit of ${amount} ${deposit.currency} has been confirmed.`, type: 'deposit' } });
      });
      res.json({ message: 'Deposit confirmed and funds credited' });
    } catch (error) { next(error); }
  }

  static async rejectDeposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const deposit = await prisma.deposit.findUnique({ where: { id: req.params.id } });
      if (!deposit) throw new AppError('Deposit not found', 404);
      if (deposit.status !== 'PENDING') throw new AppError('Deposit is not pending', 400);

      await prisma.deposit.update({ where: { id: deposit.id }, data: { status: 'REJECTED', adminNotes: req.body.reason || 'Rejected by admin', confirmedBy: req.user!.id } });
      await prisma.notification.create({ data: { userId: deposit.userId, title: 'Deposit Rejected', message: `Your deposit of ${deposit.amount} ${deposit.currency} has been rejected. Reason: ${req.body.reason || 'N/A'}`, type: 'deposit' } });
      res.json({ message: 'Deposit rejected' });
    } catch (error) { next(error); }
  }

  // ── Withdrawals ────────────────────────────────────────────────
  static async getWithdrawals(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const where: any = {};
      if (status) where.status = status.toUpperCase();

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where, include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.withdrawal.count({ where }),
      ]);
      res.json({ withdrawals, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async processWithdrawal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
      if (!withdrawal) throw new AppError('Withdrawal not found', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('Withdrawal is not pending', 400);

      await prisma.$transaction(async (tx: any) => {
        await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'COMPLETED', processedAt: new Date(), processedBy: req.user!.id, adminNotes: req.body.notes } });
        const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: withdrawal.userId, currency: withdrawal.currency } } });
        const balanceBefore = parseFloat(wallet?.balance.toString() || '0');
        const amount = parseFloat(withdrawal.amount.toString());

        await tx.wallet.update({ where: { userId_currency: { userId: withdrawal.userId, currency: withdrawal.currency } }, data: { balance: { decrement: withdrawal.amount }, frozen: { decrement: withdrawal.amount } } });
        await tx.transaction.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL', currency: withdrawal.currency, amount: new Decimal(-amount), fee: withdrawal.fee, balanceBefore, balanceAfter: balanceBefore - amount, reference: withdrawal.reference, description: `Withdrawal processed` } });

        // If USDT withdrawal, queue on-chain send
        if (withdrawal.currency === 'USDT' && withdrawal.walletAddress) {
          await tx.onChainTx.create({
            data: {
              withdrawalId: withdrawal.id,
              toAddress: withdrawal.walletAddress,
              network: withdrawal.network || 'TRC20',
              amount: withdrawal.netAmount,
              currency: 'USDT',
              status: 'QUEUED',
            },
          });
        }

        await tx.notification.create({ data: { userId: withdrawal.userId, title: 'Withdrawal Completed', message: `Your withdrawal of ${withdrawal.netAmount} ${withdrawal.currency} has been completed.${withdrawal.currency === 'USDT' ? ` USDT sent to ${withdrawal.walletAddress}` : ''}`, type: 'withdrawal' } });
      });
      res.json({ message: 'Withdrawal processed' });
    } catch (error) { next(error); }
  }

  static async rejectWithdrawal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: req.params.id } });
      if (!withdrawal) throw new AppError('Withdrawal not found', 404);
      if (withdrawal.status !== 'PENDING') throw new AppError('Withdrawal is not pending', 400);

      await prisma.wallet.update({ where: { userId_currency: { userId: withdrawal.userId, currency: withdrawal.currency } }, data: { frozen: { decrement: withdrawal.amount } } });
      await prisma.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'REJECTED', adminNotes: req.body.reason || 'Rejected by admin', processedBy: req.user!.id } });
      await prisma.notification.create({ data: { userId: withdrawal.userId, title: 'Withdrawal Rejected', message: `Your withdrawal has been rejected. Reason: ${req.body.reason || 'N/A'}`, type: 'withdrawal' } });
      res.json({ message: 'Withdrawal rejected and funds unfrozen' });
    } catch (error) { next(error); }
  }

  // ── KYC ────────────────────────────────────────────────────────
  static async getKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;
      const where: any = { kycStatus: { not: 'NOT_SUBMITTED' } };
      if (status) where.kycStatus = status.toUpperCase();

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where, select: { id: true, email: true, firstName: true, lastName: true, phone: true, kycStatus: true, createdAt: true, kycDocuments: true },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.user.count({ where }),
      ]);
      res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async approveKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.user.update({ where: { id: req.params.userId }, data: { kycStatus: 'APPROVED' } });
      await prisma.kYCDocument.updateMany({ where: { userId: req.params.userId, status: 'PENDING' }, data: { status: 'APPROVED', reviewedBy: req.user!.id, reviewedAt: new Date() } });
      await prisma.notification.create({ data: { userId: req.params.userId, title: 'KYC Approved', message: 'Your identity verification has been approved. You can now trade.', type: 'kyc' } });
      res.json({ message: 'KYC approved' });
    } catch (error) { next(error); }
  }

  static async rejectKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await prisma.user.update({ where: { id: req.params.userId }, data: { kycStatus: 'REJECTED' } });
      await prisma.kYCDocument.updateMany({ where: { userId: req.params.userId, status: 'PENDING' }, data: { status: 'REJECTED', rejectionReason: req.body.reason, reviewedBy: req.user!.id, reviewedAt: new Date() } });
      await prisma.notification.create({ data: { userId: req.params.userId, title: 'KYC Rejected', message: `Your identity verification was rejected. Reason: ${req.body.reason || 'N/A'}`, type: 'kyc' } });
      res.json({ message: 'KYC rejected' });
    } catch (error) { next(error); }
  }

  // ── Users ──────────────────────────────────────────────────────
  static async getUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string | undefined;
      const where: any = { role: 'USER' };
      if (search) where.OR = [{ email: { contains: search, mode: 'insensitive' } }, { firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }];

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where, select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true, kycStatus: true, createdAt: true, lastLoginAt: true, wallets: true },
          orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        }),
        prisma.user.count({ where }),
      ]);
      res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async updateUserStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) throw new AppError('Invalid status', 400);
      await prisma.user.update({ where: { id: req.params.id }, data: { status } });
      res.json({ message: `User status updated to ${status}` });
    } catch (error) { next(error); }
  }

  // ── Settings ───────────────────────────────────────────────────
  static async getSettings(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const settings = await prisma.platformSettings.findMany({ orderBy: { key: 'asc' } });
      res.json({ settings });
    } catch (error) { next(error); }
  }

  static async updateSettings(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { settings } = req.body;
      for (const [key, value] of Object.entries(settings)) {
        await prisma.platformSettings.upsert({
          where: { key }, update: { value: String(value), updatedBy: req.user!.id },
          create: { key, value: String(value), updatedBy: req.user!.id },
        });
      }
      res.json({ message: 'Settings updated' });
    } catch (error) { next(error); }
  }

  // ── Orders ─────────────────────────────────────────────────────
  static async getOrders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const [orders, total] = await Promise.all([
        prisma.order.findMany({ include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.order.count(),
      ]);
      res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  // ── Audit Log ──────────────────────────────────────────────────
  static async getAuditLog(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.auditLog.count(),
      ]);
      res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  // ── On-Chain USDT Transactions ─────────────────────────────────
  static async getOnChainTxs(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const [txs, total] = await Promise.all([
        prisma.onChainTx.findMany({ include: { withdrawal: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.onChainTx.count(),
      ]);
      res.json({ txs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) { next(error); }
  }

  static async markOnChainTxSent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { txHash } = req.body;
      if (!txHash) throw new AppError('Transaction hash is required', 400);
      const tx = await prisma.onChainTx.findUnique({ where: { id: req.params.id } });
      if (!tx) throw new AppError('On-chain TX not found', 404);
      await prisma.onChainTx.update({ where: { id: tx.id }, data: { status: 'SENT', txHash, sentAt: new Date() } });
      res.json({ message: 'On-chain TX marked as sent' });
    } catch (error) { next(error); }
  }

  // ── AML Flags ──────────────────────────────────────────────────
  static async getAMLFlags(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const status = req.query.status as string | undefined;
      const severity = req.query.severity as string | undefined;
      const limit = 20;

      const where: any = {};
      if (status) where.status = status;
      if (severity) where.severity = severity;

      const [flags, total] = await Promise.all([
        prisma.aMLFlag.findMany({
          where,
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true, kycStatus: true } } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.aMLFlag.count({ where }),
      ]);

      const summary = await Promise.all([
        prisma.aMLFlag.count({ where: { status: 'OPEN' } }),
        prisma.aMLFlag.count({ where: { status: 'REVIEWING' } }),
        prisma.aMLFlag.count({ where: { status: 'ESCALATED' } }),
        prisma.aMLFlag.count({ where: { severity: 'CRITICAL' } }),
      ]);

      res.json({
        flags, total, page, pages: Math.ceil(total / limit),
        summary: { open: summary[0], reviewing: summary[1], escalated: summary[2], critical: summary[3] },
      });
    } catch (error) { next(error); }
  }

  static async resolveAMLFlag(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, resolution } = req.body;
      if (!['CLEARED', 'ESCALATED', 'FROZEN'].includes(status)) throw new AppError('Invalid status', 400);

      const flag = await prisma.aMLFlag.findUnique({ where: { id } });
      if (!flag) throw new AppError('AML flag not found', 404);

      await prisma.aMLFlag.update({
        where: { id },
        data: { status, resolution, reviewedBy: req.user!.id, reviewedAt: new Date() },
      });

      // If freezing, freeze user's wallets
      if (status === 'FROZEN') {
        await prisma.user.update({ where: { id: flag.userId }, data: { status: 'SUSPENDED' } });
      }

      res.json({ message: `AML flag ${status.toLowerCase()}` });
    } catch (error) { next(error); }
  }
}
