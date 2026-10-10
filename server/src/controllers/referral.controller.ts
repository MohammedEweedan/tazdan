import { Response, NextFunction } from 'express';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { assertMovementAllowed } from '../services/platform/controls.service';
import { postLedger, isLedgerCurrency } from '../services/ledger/ledger.service';

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
      await assertMovementAllowed({ userId, feature: 'transfers' });

      // Lock the unpaid rows, mark exactly those paid, then credit their sum —
      // all in one transaction. Two concurrent claims cannot both pay: the
      // second waits on the row locks and then finds nothing unpaid.
      const claimed = await prisma.$transaction(async (tx) => {
        const pending = await tx.$queryRaw<Array<{ id: string; amount: string; currency: string }>>`
          SELECT "id", "amount"::text AS "amount", "currency"::text AS "currency"
          FROM "ReferralReward"
          WHERE "referrerId" = ${userId} AND "paid" = false
          FOR UPDATE
        `;
        if (pending.length === 0) throw new AppError('No pending rewards', 400);

        const marked = await tx.referralReward.updateMany({
          where: { id: { in: pending.map((p) => p.id) }, paid: false },
          data: { paid: true, paidAt: new Date() },
        });
        if (marked.count !== pending.length) throw new AppError('Rewards changed while claiming — try again', 409);

        const totals = new Map<string, Decimal>();
        for (const r of pending) totals.set(r.currency, (totals.get(r.currency) ?? new Decimal(0)).plus(r.amount));

        for (const [currency, amount] of totals) {
          await tx.wallet.upsert({
            where: { userId_currency: { userId, currency: currency as any } },
            create: { userId, currency: currency as any, balance: amount },
            update: { balance: { increment: amount } },
          });
          // Double-entry: the platform funds the referral incentive.
          if (isLedgerCurrency(currency)) {
            await postLedger(tx, {
              refType: 'referral_reward',
              refId: `${userId}:${pending.map((p) => p.id).sort()[0]}`,
              memo: `Referral reward ${currency} (${pending.length} reward rows)`,
              legs: [
                { type: 'PLATFORM', currency: currency as any, amount: amount.neg() },
                { type: 'USER', userId, currency: currency as any, amount },
              ],
            }, { allowNegativeUser: true });
          }
        }
        return Object.fromEntries([...totals].map(([c, a]) => [c, a.toNumber()]));
      });

      res.json({ message: 'Rewards claimed successfully', claimed });
    } catch (error) {
      next(error);
    }
  }
}
