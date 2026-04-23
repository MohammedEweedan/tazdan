import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

export class SecurityController {
  // Get login history
  static async getLoginHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = 20;

      const [history, total] = await Promise.all([
        prisma.loginHistory.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.loginHistory.count({ where: { userId } }),
      ]);

      res.json({ history, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
      next(error);
    }
  }

  // Get active sessions
  static async getSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sessions = await prisma.session.findMany({
        where: { userId: req.user!.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
      });
      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  }

  // Revoke a session
  static async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await prisma.session.deleteMany({ where: { id, userId: req.user!.id } });
      res.json({ message: 'Session revoked' });
    } catch (error) {
      next(error);
    }
  }

  // Revoke all other sessions
  static async revokeAllSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Keep current session, delete others
      const currentToken = req.headers.authorization?.replace('Bearer ', '');
      await prisma.session.deleteMany({
        where: { userId: req.user!.id, token: { not: currentToken || '' } },
      });
      res.json({ message: 'All other sessions revoked' });
    } catch (error) {
      next(error);
    }
  }

  // Get security overview
  static async getOverview(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          twoFactorEnabled: true, emailVerified: true, phoneVerified: true,
          kycStatus: true, lastLoginAt: true, lastLoginIp: true, createdAt: true,
        },
      });
      if (!user) throw new AppError('User not found', 404);

      const [activeSessions, recentLogins, apiKeyCount] = await Promise.all([
        prisma.session.count({ where: { userId: req.user!.id, expiresAt: { gt: new Date() } } }),
        prisma.loginHistory.count({ where: { userId: req.user!.id } }),
        prisma.aPIKey.count({ where: { userId: req.user!.id, isActive: true } }),
      ]);

      res.json({
        ...user,
        activeSessions,
        recentLogins,
        apiKeyCount,
        securityScore: calculateSecurityScore(user),
      });
    } catch (error) {
      next(error);
    }
  }
}

function calculateSecurityScore(user: any): number {
  let score = 20; // base
  if (user.twoFactorEnabled) score += 30;
  if (user.emailVerified) score += 15;
  if (user.phoneVerified) score += 15;
  if (user.kycStatus === 'APPROVED') score += 20;
  return Math.min(score, 100);
}

// Helper: record login
export async function recordLogin(userId: string, req: any, success = true) {
  try {
    await prisma.loginHistory.create({
      data: {
        userId,
        ipAddress: req.ip || req.headers['x-forwarded-for']?.toString() || null,
        userAgent: req.headers['user-agent'] || null,
        device: parseDevice(req.headers['user-agent'] || ''),
        success,
      },
    });
  } catch {
    // non-critical, don't throw
  }
}

function parseDevice(ua: string): string {
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac/i.test(ua)) return 'macOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}
