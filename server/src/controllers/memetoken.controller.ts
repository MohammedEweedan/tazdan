import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const CHAIN_FEES: Record<string, number> = {
  BNB: 50,    // $50 USDT
  ETH: 150,   // $150 USDT (higher gas)
  SOL: 25,    // $25 USDT
  AVAX: 40,   // $40 USDT
  MATIC: 20,  // $20 USDT
};

const createTokenSchema = z.object({
  name: z.string().min(2).max(50),
  symbol: z.string().min(2).max(10).transform(s => s.toUpperCase()),
  description: z.string().max(500).optional(),
  totalSupply: z.string().regex(/^\d+$/, 'Must be a whole number'),
  decimals: z.number().int().min(0).max(18).default(18),
  chain: z.enum(['BNB', 'ETH', 'SOL', 'AVAX', 'MATIC']),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  twitter: z.string().max(100).optional(),
  telegram: z.string().max(100).optional(),
});

export class MemeTokenController {
  /** Get fee schedule */
  static async getFees(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json({ fees: CHAIN_FEES });
    } catch (error) {
      next(error);
    }
  }

  /** Create a new memecoin (requires KYC + payment) */
  static async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // KYC gate
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user || user.kycStatus !== 'APPROVED') {
        throw new AppError('KYC verification required to mint tokens', 403);
      }

      const data = createTokenSchema.parse(req.body);
      const fee = CHAIN_FEES[data.chain] || 50;

      // Check if symbol is taken on this chain
      const existing = await prisma.memeToken.findUnique({
        where: { chain_symbol: { chain: data.chain, symbol: data.symbol } },
      });
      if (existing) throw new AppError(`Symbol ${data.symbol} already exists on ${data.chain}`, 400);

      // Check user has enough USDT to pay fee
      const wallet = await prisma.wallet.findFirst({
        where: { userId: req.user!.id, currency: 'USDT' },
      });
      const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
      const frozen = wallet ? parseFloat(wallet.frozen.toString()) : 0;
      if (balance - frozen < fee) {
        throw new AppError(`Insufficient USDT balance. Fee: ${fee} USDT`, 400);
      }

      // Deduct fee atomically
      const token = await prisma.$transaction(async (tx) => {
        // Deduct fee from user wallet
        await tx.wallet.update({
          where: { id: wallet!.id },
          data: { balance: { decrement: fee } },
        });

        // Record the fee transaction
        await tx.transaction.create({
          data: {
            userId: req.user!.id,
            type: 'FEE',
            currency: 'USDT',
            amount: fee,
            fee: 0,
            balanceBefore: balance,
            balanceAfter: balance - fee,
            description: `Memecoin deployment fee: ${data.symbol} on ${data.chain}`,
            reference: `MEME-${Date.now()}`,
          },
        });

        // Create token record
        const t = await tx.memeToken.create({
          data: {
            userId: req.user!.id,
            name: data.name,
            symbol: data.symbol,
            description: data.description,
            totalSupply: data.totalSupply,
            decimals: data.decimals,
            chain: data.chain,
            logoUrl: data.logoUrl,
            website: data.website,
            twitter: data.twitter,
            telegram: data.telegram,
            platformFee: fee,
            status: 'DEPLOYING',
          },
        });

        // Notify admins
        const admins = await tx.user.findMany({ where: { role: 'ADMIN' } });
        for (const admin of admins) {
          await tx.notification.create({
            data: {
              userId: admin.id,
              title: 'New Token Deployment',
              message: `${user.firstName} ${user.lastName} is deploying ${data.symbol} on ${data.chain}. Fee: ${fee} USDT collected.`,
              type: 'info',
            },
          });
        }

        return t;
      });

      // In production, this would trigger an actual blockchain deployment
      // For now, simulate auto-deploy after a delay
      setTimeout(async () => {
        try {
          const fakeAddress = `0x${Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
          const fakeTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
          await prisma.memeToken.update({
            where: { id: token.id },
            data: {
              status: 'DEPLOYED',
              contractAddress: fakeAddress,
              deployTxHash: fakeTxHash,
              deployedAt: new Date(),
            },
          });
          await prisma.notification.create({
            data: {
              userId: req.user!.id,
              title: 'Token Deployed!',
              message: `Your token ${data.symbol} has been deployed on ${data.chain}. Contract: ${fakeAddress}`,
              type: 'success',
            },
          });
        } catch (e) {
          console.error('Token deploy simulation failed:', e);
          await prisma.memeToken.update({
            where: { id: token.id },
            data: { status: 'FAILED' },
          });
        }
      }, 5000);

      res.status(201).json({ token, fee });
    } catch (error) {
      next(error);
    }
  }

  /** Get user's tokens */
  static async getMyTokens(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tokens = await prisma.memeToken.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ tokens });
    } catch (error) {
      next(error);
    }
  }

  /** Get all deployed tokens (public) */
  static async getAll(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const chain = req.query.chain as string;
      const where: any = { status: 'DEPLOYED' };
      if (chain) where.chain = chain;

      const [tokens, total] = await Promise.all([
        prisma.memeToken.findMany({
          where,
          orderBy: { deployedAt: 'desc' },
          skip: (page - 1) * 20,
          take: 20,
          include: {
            user: { select: { firstName: true, lastName: true, username: true } },
          },
        }),
        prisma.memeToken.count({ where }),
      ]);

      res.json({ tokens, total, page });
    } catch (error) {
      next(error);
    }
  }
}
