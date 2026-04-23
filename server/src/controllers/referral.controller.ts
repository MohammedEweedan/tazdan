import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

// Tiered commission rates
const TIERS = [
  { min: 0, max: 10, rate: 0.05 },     // 5% of platform fee for 0-10 referrals
  { min: 10, max: 50, rate: 0.08 },     // 8% for 10-50
  { min: 50, max: 200, rate: 0.10 },    // 10% for 50-200
  { min: 200, max: Infinity, rate: 0.15 }, // 15% for 200+
];

export class ReferralController {
  // Get referral dashboard
  static async getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { referralCode: true },
      });
      if (!user) throw new AppError('User not found', 404);

      const referrals = await prisma.user.findMany({
        where: { referredBy: userId },
        select: { id: true, firstName: true, lastName: true, createdAt: true, kycStatus: true },
        orderBy: { createdAt: 'desc' },
      });

      const rewards = await prisma.referralReward.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const totalEarned = rewards
        .filter((r: any) => r.paid)
        .reduce((sum: number, r: any) => sum + parseFloat(r.amount.toString()), 0);
      const pendingEarnings = rewards
        .filter((r: any) => !r.paid)
        .reduce((sum: number, r: any) => sum + parseFloat(r.amount.toString()), 0);

      const count = referrals.length;
      const currentTier = TIERS.find((t) => count >= t.min && count < t.max) || TIERS[TIERS.length - 1];

      res.json({
        referralCode: user.referralCode,
        referralLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/register?ref=${user.referralCode}`,
        totalReferrals: count,
        totalEarned,
        pendingEarnings,
        currentTier: {
          rate: currentTier.rate,
          name: count < 10 ? 'Bronze' : count < 50 ? 'Silver' : count < 200 ? 'Gold' : 'Diamond',
          nextTierAt: currentTier.max === Infinity ? null : currentTier.max,
        },
        tiers: TIERS.map((t) => ({
          name: t.min < 10 ? 'Bronze' : t.min < 50 ? 'Silver' : t.min < 200 ? 'Gold' : 'Diamond',
          minReferrals: t.min,
          rate: t.rate,
          active: count >= t.min && count < t.max,
        })),
        referrals: referrals.map((r: any) => ({
          id: r.id,
          name: `${r.firstName} ${r.lastName?.[0] || ''}`.trim(),
          joinedAt: r.createdAt,
          kycVerified: r.kycStatus === 'APPROVED',
        })),
        rewards,
      });
    } catch (error) {
      next(error);
    }
  }

  // Claim pending rewards
  static async claimRewards(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const pending = await prisma.referralReward.findMany({
        where: { referrerId: userId, paid: false },
      });
      if (pending.length === 0) throw new AppError('No pending rewards', 400);

      const totalByCurrency: Record<string, number> = {};
      pending.forEach((r: any) => {
        const c = r.currency;
        totalByCurrency[c] = (totalByCurrency[c] || 0) + parseFloat(r.amount.toString());
      });

      // Credit wallets and mark as paid
      for (const [currency, amount] of Object.entries(totalByCurrency)) {
        await prisma.wallet.upsert({
          where: { userId_currency: { userId, currency: currency as any } },
          create: { userId, currency: currency as any, balance: amount },
          update: { balance: { increment: amount } },
        });
      }

      await prisma.referralReward.updateMany({
        where: { referrerId: userId, paid: false },
        data: { paid: true, paidAt: new Date() },
      });

      res.json({ message: 'Rewards claimed successfully', claimed: totalByCurrency });
    } catch (error) {
      next(error);
    }
  }
}
