import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().optional(),
  baseCurrency: z.enum(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']).optional(),
  profilePublic: z.boolean().optional(),
  acceptedCurrencies: z.array(z.string()).optional(),
});

export class ProfileController {
  /**
   * Search public profiles by handle prefix. Used by the mobile Send
   * screen for the "type-ahead" recipient picker. Returns up to 10
   * matches (only profiles flagged `profilePublic = true`).
   */
  static async searchProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const q = String(req.query.q ?? '').trim().toLowerCase().replace(/^@/, '');
      if (q.length < 1) return res.json({ profiles: [] });
      const matches = await prisma.user.findMany({
        where: {
          profilePublic: true,
          username: { startsWith: q, mode: 'insensitive' },
        },
        select: { id: true, username: true, firstName: true, lastName: true, avatarUrl: true, kycTier: true },
        take: 10,
      });
      res.json({ profiles: matches });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Look up a user by id for in-app surfaces (message thread headers,
   * notifications, etc). Auth-gated; returns only non-sensitive fields.
   */
  static async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true, firstName: true, lastName: true, username: true,
          avatarUrl: true, role: true, kycStatus: true,
        },
      });
      if (!user) throw new AppError('User not found', 404);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  /** Get own public profile settings */
  static async getMyProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true, username: true, firstName: true, lastName: true,
          bio: true, avatarUrl: true, baseCurrency: true, profilePublic: true,
          acceptedCurrencies: true, referralCode: true,
          kycStatus: true, createdAt: true,
        },
      });
      if (!user) throw new AppError('User not found', 404);
      res.json({ profile: user });
    } catch (error) {
      next(error);
    }
  }

  /** Update public profile */
  static async updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = updateProfileSchema.parse(req.body);

      // Check username uniqueness
      if (data.username) {
        const existing = await prisma.user.findFirst({
          where: { username: data.username, NOT: { id: req.user!.id } },
        });
        if (existing) throw new AppError('Username already taken', 400);
      }

      const user = await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          username: data.username,
          bio: data.bio,
          avatarUrl: data.avatarUrl,
          baseCurrency: data.baseCurrency,
          profilePublic: data.profilePublic,
          acceptedCurrencies: data.acceptedCurrencies,
        },
        select: {
          id: true, username: true, firstName: true, lastName: true,
          bio: true, avatarUrl: true, baseCurrency: true, profilePublic: true,
          acceptedCurrencies: true, referralCode: true,
        },
      });
      res.json({ profile: user });
    } catch (error) {
      next(error);
    }
  }

  /** Get public profile by username (no auth required) */
  static async getPublicProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const user = await prisma.user.findFirst({
        where: { username, profilePublic: true },
        select: {
          id: true, username: true, firstName: true, lastName: true,
          bio: true, avatarUrl: true, acceptedCurrencies: true,
          createdAt: true, kycStatus: true,
        },
      });
      if (!user) throw new AppError('Profile not found', 404);

      // Get user's P2P stats
      const [totalTrades, completedTrades] = await Promise.all([
        prisma.p2PTrade.count({
          where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
        }),
        prisma.p2PTrade.count({
          where: { OR: [{ buyerId: user.id }, { sellerId: user.id }], status: 'COMPLETED' },
        }),
      ]);

      res.json({
        profile: {
          ...user,
          kycVerified: user.kycStatus === 'APPROVED',
          totalTrades,
          completedTrades,
          completionRate: totalTrades > 0 ? Math.round((completedTrades / totalTrades) * 100) : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
