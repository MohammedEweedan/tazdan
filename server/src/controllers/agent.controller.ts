import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { generateReference } from '../utils/helpers';
import { AuthRequest } from '../types';

const agentSchema = z.object({
  userId: z.string().uuid('Valid user ID required'),
  name: z.string().min(1, 'Agent name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional(),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  region: z.string().min(1, 'Region is required'),
  googleMapsLink: z.string().url().optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  maxDailyLimit: z.number().min(0).optional(),
  notes: z.string().optional(),
});

const requestDepositSchema = z.object({
  agentId: z.string().uuid(),
  amount: z.number().positive().min(1),
  currency: z.enum(['LYD', 'USD', 'USDT']).default('USDT'),
  notes: z.string().max(500).optional(),
});

const requestWithdrawalSchema = z.object({
  agentId: z.string().uuid(),
  amount: z.number().positive().min(1),
  currency: z.enum(['LYD', 'USD', 'USDT']).default('USDT'),
  notes: z.string().max(500).optional(),
});

export class AgentController {
  // ── Public: find agents ──────────────────────────────────────────
  static async findNearby(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { city, region } = req.query;
      const where: any = { isActive: true };
      if (city) where.city = city;
      if (region) where.region = region;

      const agents = await prisma.agent.findMany({
        where,
        orderBy: { city: 'asc' },
        select: {
          id: true, name: true, phone: true, city: true, region: true,
          address: true, googleMapsLink: true,
        },
      });
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  }

  // ── User: request deposit via agent ──────────────────────────────
  static async requestDeposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = requestDepositSchema.parse(req.body);

      const agent = await prisma.agent.findUnique({ where: { id: data.agentId, isActive: true } });
      if (!agent) throw new AppError('Agent not found or inactive', 404);

      const reference = generateReference('AGD');

      const transaction = await prisma.agentTransaction.create({
        data: {
          agentId: data.agentId,
          userId: req.user!.id,
          type: 'DEPOSIT',
          amount: data.amount,
          currency: data.currency,
          reference,
          userNotes: data.notes,
        },
        include: { agent: { select: { name: true, phone: true, city: true } } },
      });

      // Notify agent
      await prisma.notification.create({
        data: {
          userId: agent.userId,
          title: 'New Deposit Request',
          message: `New ${data.amount} ${data.currency} deposit request. Ref: ${reference}`,
          type: 'agent_deposit',
        },
      });

      res.status(201).json({ transaction });
    } catch (error) {
      next(error);
    }
  }

  // ── User: request withdrawal via agent ───────────────────────────
  static async requestWithdrawal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = requestWithdrawalSchema.parse(req.body);

      const agent = await prisma.agent.findUnique({ where: { id: data.agentId, isActive: true } });
      if (!agent) throw new AppError('Agent not found or inactive', 404);

      // Check user balance
      const wallet = await prisma.wallet.findUnique({
        where: { userId_currency: { userId: req.user!.id, currency: data.currency } },
      });
      const available = parseFloat(wallet?.balance.toString() || '0') - parseFloat(wallet?.frozen.toString() || '0');
      if (data.amount > available) throw new AppError(`Insufficient ${data.currency} balance`, 400);

      // Freeze the amount
      await prisma.wallet.update({
        where: { userId_currency: { userId: req.user!.id, currency: data.currency } },
        data: { frozen: { increment: new Decimal(data.amount) } },
      });

      const reference = generateReference('AGW');

      const transaction = await prisma.agentTransaction.create({
        data: {
          agentId: data.agentId,
          userId: req.user!.id,
          type: 'WITHDRAWAL',
          amount: data.amount,
          currency: data.currency,
          reference,
          userNotes: data.notes,
        },
        include: { agent: { select: { name: true, phone: true, city: true } } },
      });

      // Notify agent
      await prisma.notification.create({
        data: {
          userId: agent.userId,
          title: 'New Withdrawal Request',
          message: `New ${data.amount} ${data.currency} withdrawal request. Ref: ${reference}`,
          type: 'agent_withdrawal',
        },
      });

      res.status(201).json({ transaction });
    } catch (error) {
      next(error);
    }
  }

  // ── User: get own agent transactions ─────────────────────────────
  static async getUserTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string | undefined;

      const where: any = { userId: req.user!.id };
      if (status) where.status = status;

      const [transactions, total] = await Promise.all([
        prisma.agentTransaction.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { agent: { select: { name: true, city: true, phone: true } } },
        }),
        prisma.agentTransaction.count({ where }),
      ]);

      res.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  // ── Agent: get pending requests ──────────────────────────────────
  static async getAgentQueue(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const agentProfile = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
      if (!agentProfile) throw new AppError('Agent profile not found', 404);

      const status = req.query.status as string || 'PENDING';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [transactions, total] = await Promise.all([
        prisma.agentTransaction.findMany({
          where: { agentId: agentProfile.id, status },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          },
        }),
        prisma.agentTransaction.count({ where: { agentId: agentProfile.id, status } }),
      ]);

      res.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  // ── Agent: confirm deposit (credits user wallet) ─────────────────
  static async confirmDeposit(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const agentProfile = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
      if (!agentProfile) throw new AppError('Agent profile not found', 404);

      const txn = await prisma.agentTransaction.findFirst({
        where: { id, agentId: agentProfile.id, type: 'DEPOSIT', status: 'PENDING' },
      });
      if (!txn) throw new AppError('Transaction not found or already processed', 404);

      const amount = parseFloat(txn.amount.toString());
      const commissionRate = parseFloat(agentProfile.commissionRate.toString());
      const commission = parseFloat((amount * commissionRate).toFixed(8));

      await prisma.$transaction(async (tx: any) => {
        // Credit user wallet
        const userWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: txn.userId, currency: txn.currency } },
        });
        const balanceBefore = parseFloat(userWallet?.balance.toString() || '0');

        await tx.wallet.upsert({
          where: { userId_currency: { userId: txn.userId, currency: txn.currency } },
          update: { balance: { increment: new Decimal(amount) } },
          create: { userId: txn.userId, currency: txn.currency, balance: amount },
        });

        // Update agent transaction
        await tx.agentTransaction.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            commission,
            processedAt: new Date(),
            processedBy: req.user!.id,
          },
        });

        // Update agent stats
        await tx.agent.update({
          where: { id: agentProfile.id },
          data: {
            totalCommission: { increment: new Decimal(commission) },
            dailyVolume: { increment: new Decimal(amount) },
          },
        });

        // Create transaction record for user
        await tx.transaction.create({
          data: {
            userId: txn.userId,
            type: 'AGENT_DEPOSIT',
            currency: txn.currency,
            amount,
            fee: 0,
            balanceBefore,
            balanceAfter: balanceBefore + amount,
            reference: txn.reference,
            description: `Agent deposit confirmed by ${agentProfile.name}`,
          },
        });

        // Notify user
        await tx.notification.create({
          data: {
            userId: txn.userId,
            title: 'Deposit Confirmed',
            message: `Your ${amount} ${txn.currency} deposit has been confirmed by agent ${agentProfile.name}.`,
            type: 'agent_deposit',
          },
        });
      });

      res.json({ message: 'Deposit confirmed and user wallet credited' });
    } catch (error) {
      next(error);
    }
  }

  // ── Agent: confirm withdrawal (deducts from user wallet) ─────────
  static async confirmWithdrawal(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const agentProfile = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
      if (!agentProfile) throw new AppError('Agent profile not found', 404);

      const txn = await prisma.agentTransaction.findFirst({
        where: { id, agentId: agentProfile.id, type: 'WITHDRAWAL', status: 'PENDING' },
      });
      if (!txn) throw new AppError('Transaction not found or already processed', 404);

      const amount = parseFloat(txn.amount.toString());
      const commissionRate = parseFloat(agentProfile.commissionRate.toString());
      const commission = parseFloat((amount * commissionRate).toFixed(8));

      await prisma.$transaction(async (tx: any) => {
        // Deduct from user wallet (unfreeeze + deduct)
        const userWallet = await tx.wallet.findUnique({
          where: { userId_currency: { userId: txn.userId, currency: txn.currency } },
        });
        const balanceBefore = parseFloat(userWallet?.balance.toString() || '0');

        await tx.wallet.update({
          where: { userId_currency: { userId: txn.userId, currency: txn.currency } },
          data: {
            balance: { decrement: new Decimal(amount) },
            frozen: { decrement: new Decimal(amount) },
          },
        });

        // Update agent transaction
        await tx.agentTransaction.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            commission,
            processedAt: new Date(),
            processedBy: req.user!.id,
          },
        });

        // Update agent stats
        await tx.agent.update({
          where: { id: agentProfile.id },
          data: {
            totalCommission: { increment: new Decimal(commission) },
            dailyVolume: { increment: new Decimal(amount) },
          },
        });

        // Create transaction record for user
        await tx.transaction.create({
          data: {
            userId: txn.userId,
            type: 'AGENT_WITHDRAWAL',
            currency: txn.currency,
            amount: new Decimal(-amount),
            fee: 0,
            balanceBefore,
            balanceAfter: balanceBefore - amount,
            reference: txn.reference,
            description: `Agent withdrawal confirmed by ${agentProfile.name}`,
          },
        });

        // Notify user
        await tx.notification.create({
          data: {
            userId: txn.userId,
            title: 'Withdrawal Completed',
            message: `Your ${amount} ${txn.currency} withdrawal has been completed by agent ${agentProfile.name}.`,
            type: 'agent_withdrawal',
          },
        });
      });

      res.json({ message: 'Withdrawal confirmed' });
    } catch (error) {
      next(error);
    }
  }

  // ── Agent: reject transaction ────────────────────────────────────
  static async rejectTransaction(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const agentProfile = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
      if (!agentProfile) throw new AppError('Agent profile not found', 404);

      const txn = await prisma.agentTransaction.findFirst({
        where: { id, agentId: agentProfile.id, status: 'PENDING' },
      });
      if (!txn) throw new AppError('Transaction not found or already processed', 404);

      // If withdrawal, unfreeze user funds
      if (txn.type === 'WITHDRAWAL') {
        await prisma.wallet.update({
          where: { userId_currency: { userId: txn.userId, currency: txn.currency } },
          data: { frozen: { decrement: new Decimal(parseFloat(txn.amount.toString())) } },
        });
      }

      await prisma.agentTransaction.update({
        where: { id },
        data: { status: 'REJECTED', notes: reason, processedAt: new Date(), processedBy: req.user!.id },
      });

      await prisma.notification.create({
        data: {
          userId: txn.userId,
          title: `${txn.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Rejected`,
          message: `Your ${txn.type.toLowerCase()} request was rejected.${reason ? ` Reason: ${reason}` : ''}`,
          type: 'agent_rejection',
        },
      });

      res.json({ message: 'Transaction rejected' });
    } catch (error) {
      next(error);
    }
  }

  // ── Agent: dashboard stats ───────────────────────────────────────
  static async getAgentStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const agentProfile = await prisma.agent.findUnique({ where: { userId: req.user!.id } });
      if (!agentProfile) throw new AppError('Agent profile not found', 404);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [pendingCount, todayCompleted, totalCompleted, todayVolume] = await Promise.all([
        prisma.agentTransaction.count({
          where: { agentId: agentProfile.id, status: 'PENDING' },
        }),
        prisma.agentTransaction.count({
          where: { agentId: agentProfile.id, status: 'COMPLETED', processedAt: { gte: today } },
        }),
        prisma.agentTransaction.count({
          where: { agentId: agentProfile.id, status: 'COMPLETED' },
        }),
        prisma.agentTransaction.aggregate({
          where: { agentId: agentProfile.id, status: 'COMPLETED', processedAt: { gte: today } },
          _sum: { amount: true, commission: true },
        }),
      ]);

      res.json({
        stats: {
          pendingCount,
          todayCompleted,
          totalCompleted,
          todayVolume: parseFloat(todayVolume._sum.amount?.toString() || '0'),
          todayCommission: parseFloat(todayVolume._sum.commission?.toString() || '0'),
          totalCommission: parseFloat(agentProfile.totalCommission.toString()),
          commissionRate: parseFloat(agentProfile.commissionRate.toString()),
          maxDailyLimit: parseFloat(agentProfile.maxDailyLimit.toString()),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: create agent ──────────────────────────────────────────
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = agentSchema.parse(req.body);

      // Verify user exists and update role
      const user = await prisma.user.findUnique({ where: { id: data.userId } });
      if (!user) throw new AppError('User not found', 404);

      await prisma.user.update({
        where: { id: data.userId },
        data: { role: 'AGENT' },
      });

      const agent = await prisma.agent.create({
        data: {
          userId: data.userId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          region: data.region,
          googleMapsLink: data.googleMapsLink,
          commissionRate: data.commissionRate,
          maxDailyLimit: data.maxDailyLimit,
          notes: data.notes,
        },
      });

      res.status(201).json({ agent });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: get all agents ────────────────────────────────────────
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const agents = await prisma.agent.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          _count: { select: { agentTransactions: true } },
        },
      });
      res.json({ agents });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: update agent ──────────────────────────────────────────
  static async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = agentSchema.partial().parse(req.body);

      const agent = await prisma.agent.update({
        where: { id },
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          region: data.region,
          googleMapsLink: data.googleMapsLink,
          commissionRate: data.commissionRate,
          maxDailyLimit: data.maxDailyLimit,
          notes: data.notes,
        },
      });

      res.json({ agent });
    } catch (error) {
      next(error);
    }
  }

  // ── Admin: deactivate agent ──────────────────────────────────────
  static async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.agent.update({ where: { id }, data: { isActive: false } });
      res.json({ message: 'Agent deactivated' });
    } catch (error) {
      next(error);
    }
  }
}
