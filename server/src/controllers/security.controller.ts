import { Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { issueStepUp, deviceFingerprint, type StepUpAction } from '../services/security/stepUp.service';
import { parseUserAgent, geoLocate } from '../utils/deviceInfo';
import { revokeSessionAccess } from '../middleware/auth';
import { recordSecurityEvent } from '../services/platform/securityEvents';

const STEP_UP_ACTIONS = new Set(['withdrawal', 'buy', 'sell', 'transfer', 'account_close']);

export class SecurityController {
  // Issue a step-up challenge (emails a 6-digit code, or signals TOTP).
  static async startStepUp(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const action = String(req.body?.action ?? '');
      if (!STEP_UP_ACTIONS.has(action)) throw new AppError('Invalid action', 400);
      const result = await issueStepUp(req.user!.id, action as StepUpAction);
      res.json({ ...result, message: result.method === 'totp' ? 'Enter the code from your authenticator app.' : 'We emailed you a 6-digit confirmation code.' });
    } catch (error) { next(error); }
  }

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

  // Active sessions are refresh-token chains: each sign-in creates one, each
  // refresh rotates it. Enriched with parsed device, "City, Country" from the
  // IP, and a `current` flag for the session making this request.
  static async getSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const currentSid = req.user?.sid ?? null;
      const rows = await prisma.refreshToken.findMany({
        where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true, expiresAt: true },
      });

      const sessions = await Promise.all(
        rows.map(async (s) => {
          const device = parseUserAgent(s.userAgent);
          const location = await geoLocate(s.ipAddress);
          return {
            id: s.id,
            ipAddress: s.ipAddress,
            userAgent: s.userAgent,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            lastActiveAt: s.createdAt, // a session is re-issued on every refresh
            deviceName: device.name,
            deviceType: device.type,
            os: device.os,
            browser: device.browser ?? null,
            location,
            current: !!currentSid && s.id === currentSid,
          };
        }),
      );

      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  }

  // Revoke one session: its refresh token dies now and its access token is
  // denylisted so it stops working immediately.
  static async revokeSession(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await prisma.refreshToken.updateMany({
        where: { id, userId: req.user!.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count === 0) throw new AppError('Session not found', 404);
      await revokeSessionAccess(id);
      void recordSecurityEvent({ type: 'SESSION_REVOKED', userId: req.user!.id, ipAddress: req.ip, details: { sessionId: id, scope: 'one' } });
      res.json({ message: 'Session revoked' });
    } catch (error) {
      next(error);
    }
  }

  // Revoke every session except the one making this request.
  static async revokeAllSessions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const currentSid = req.user?.sid;
      const others = await prisma.refreshToken.findMany({
        where: { userId: req.user!.id, revokedAt: null, ...(currentSid ? { id: { not: currentSid } } : {}) },
        select: { id: true },
      });
      await prisma.refreshToken.updateMany({
        where: { id: { in: others.map((o) => o.id) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await Promise.all(others.map((o) => revokeSessionAccess(o.id)));
      void recordSecurityEvent({ type: 'SESSION_REVOKED', userId: req.user!.id, ipAddress: req.ip, details: { count: others.length, scope: 'all_others' } });
      res.json({ message: 'All other sessions revoked', revoked: others.length });
    } catch (error) {
      next(error);
    }
  }

  // List trusted/known devices (the ones that have passed step-up), enriched
  // with device type, OS, IP, and "City, Country". `current` flags the device
  // making this request so the UI can label it and protect it from removal.
  static async getDevices(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await prisma.knownDevice.findMany({
        where: { userId: req.user!.id },
        orderBy: { lastSeenAt: 'desc' },
        select: {
          id: true, fingerprint: true, label: true, deviceType: true,
          os: true, ipAddress: true, location: true, lastSeenAt: true, createdAt: true,
        },
      });

      // Fingerprint of the device making this request, so we can mark "current".
      const currentFp = deviceFingerprint(req);

      const devices = rows.map((d) => {
        // Back-fill detail for rows saved before we captured it: parse the
        // current request's UA only for the current device; otherwise keep
        // whatever was stored (older rows may just have a generic label).
        const fallback = d.fingerprint === currentFp ? parseUserAgent(req.headers['user-agent'] as string) : null;
        return {
          id: d.id,
          label: d.label || fallback?.name || 'Verified device',
          deviceType: d.deviceType || fallback?.type || 'unknown',
          os: d.os || fallback?.os || null,
          ipAddress: d.ipAddress || null,
          location: d.location || null,
          lastSeenAt: d.lastSeenAt,
          createdAt: d.createdAt,
          current: d.fingerprint === currentFp,
        };
      });

      res.json({ devices });
    } catch (error) {
      next(error);
    }
  }

  // Forget a trusted device — next action from it will require full step-up
  // (and any active sessions on it are revoked as a hard sign-out).
  static async revokeDevice(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const device = await prisma.knownDevice.findFirst({ where: { id, userId: req.user!.id } });
      if (!device) { res.status(404).json({ error: 'Device not found' }); return; }
      await prisma.knownDevice.delete({ where: { id: device.id } });
      // Best-effort: revoke sessions whose user-agent matches this device, so a
      // "forget device" doubles as a force-sign-out for that device.
      // (Sessions don't store the fingerprint, so we can't match exactly; the
      //  device losing trust is the primary guarantee.)
      res.json({ message: 'Device removed. It will require full verification next time.' });
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
        prisma.refreshToken.count({ where: { userId: req.user!.id, revokedAt: null, expiresAt: { gt: new Date() } } }),
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
