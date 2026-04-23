import { prisma } from '../utils/prisma';

/**
 * Automated AML (Anti-Money Laundering) service.
 * Called after transactions to check for suspicious patterns.
 */
export class AMLService {
  // Thresholds
  static readonly DAILY_LIMIT_UNVERIFIED = 500;    // $500 USDT per day for unverified
  static readonly DAILY_LIMIT_VERIFIED = 50000;     // $50k for verified
  static readonly SINGLE_TX_ALERT = 10000;          // Flag single txs > $10k
  static readonly RAPID_TX_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  static readonly RAPID_TX_COUNT = 5;               // 5 txs in 5 min = suspicious

  /**
   * Run all AML checks on a user after a transaction.
   * Returns true if the transaction should be held.
   */
  static async checkTransaction(userId: string, amount: number, currency: string, type: string): Promise<{ hold: boolean; flags: string[] }> {
    const flags: string[] = [];
    let hold = false;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { hold: false, flags: [] };

    // 1. KYC-based daily limits
    const isVerified = user.kycStatus === 'APPROVED';
    const dailyLimit = isVerified ? this.DAILY_LIMIT_VERIFIED : this.DAILY_LIMIT_UNVERIFIED;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const dailyVolume = await prisma.transaction.aggregate({
      where: {
        userId,
        createdAt: { gte: todayStart },
        type: { in: ['WITHDRAWAL', 'TRANSFER_OUT', 'SELL'] },
      },
      _sum: { amount: true },
    });
    const todayTotal = parseFloat(dailyVolume._sum.amount?.toString() || '0') + amount;

    if (todayTotal > dailyLimit) {
      flags.push('HIGH_VOLUME');
      hold = true;
      await this.createFlag(userId, 'HIGH_VOLUME', 'HIGH',
        `Daily volume ${todayTotal.toFixed(2)} USDT exceeds ${isVerified ? 'verified' : 'unverified'} limit of ${dailyLimit} USDT`,
        amount, currency, 'HOLD');
    }

    // 2. Large single transaction
    if (amount >= this.SINGLE_TX_ALERT) {
      flags.push('LARGE_WITHDRAWAL');
      await this.createFlag(userId, 'LARGE_WITHDRAWAL', 'MEDIUM',
        `Large ${type} of ${amount} ${currency}`,
        amount, currency, hold ? 'HOLD' : 'NONE');
    }

    // 3. Rapid transactions (structuring detection)
    const recentTxs = await prisma.transaction.count({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - this.RAPID_TX_WINDOW_MS) },
      },
    });

    if (recentTxs >= this.RAPID_TX_COUNT) {
      flags.push('RAPID_TRANSACTIONS');
      hold = true;
      await this.createFlag(userId, 'RAPID_TRANSACTIONS', 'HIGH',
        `${recentTxs + 1} transactions in ${this.RAPID_TX_WINDOW_MS / 60000} minutes — potential structuring`,
        amount, currency, 'HOLD');
    }

    // 4. If unverified and trying to do large amounts, escalate
    if (!isVerified && amount >= 100) {
      flags.push('STRUCTURING');
      await this.createFlag(userId, 'STRUCTURING', 'LOW',
        `Unverified user attempting ${amount} ${currency} ${type}`,
        amount, currency, 'NONE');
    }

    // If held, freeze the user's outgoing ability temporarily
    if (hold) {
      await prisma.notification.create({
        data: {
          userId,
          title: 'Transaction Under Review',
          message: 'Your recent transaction has been flagged for compliance review. This is a standard AML check and will be resolved within 24 hours.',
          type: 'warning',
        },
      });

      // Notify admins
      const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            title: 'AML Alert',
            message: `User ${user.firstName} ${user.lastName} (${user.email}) flagged: ${flags.join(', ')}. Amount: ${amount} ${currency}`,
            type: 'warning',
          },
        });
      }
    }

    return { hold, flags };
  }

  private static async createFlag(
    userId: string,
    type: string,
    severity: string,
    description: string,
    amount: number,
    currency: string,
    autoAction: string
  ) {
    await prisma.aMLFlag.create({
      data: {
        userId,
        type: type as any,
        severity,
        description,
        amount,
        currency: currency as any,
        autoAction,
        status: 'OPEN',
      },
    });
  }

  /** Check if user is allowed to proceed (no active holds) */
  static async isUserCleared(userId: string): Promise<boolean> {
    const activeHolds = await prisma.aMLFlag.count({
      where: {
        userId,
        status: { in: ['OPEN', 'REVIEWING'] },
        autoAction: { in: ['HOLD', 'FREEZE'] },
      },
    });
    return activeHolds === 0;
  }

  /** Admin: get all AML flags */
  static async getAllFlags(page: number = 1, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [flags, total] = await Promise.all([
      prisma.aMLFlag.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, kycStatus: true } },
        },
      }),
      prisma.aMLFlag.count({ where }),
    ]);

    return { flags, total, page };
  }

  /** Admin: resolve an AML flag */
  static async resolveFlag(flagId: string, adminId: string, resolution: string, status: 'CLEARED' | 'ESCALATED' | 'FROZEN') {
    const flag = await prisma.aMLFlag.update({
      where: { id: flagId },
      data: {
        status,
        resolution,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
    });

    if (status === 'FROZEN') {
      await prisma.user.update({
        where: { id: flag.userId },
        data: { status: 'SUSPENDED' },
      });
    }

    return flag;
  }
}
