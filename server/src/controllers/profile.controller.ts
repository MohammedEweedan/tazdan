import { Response, NextFunction, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { isAccessRevoked, verifyAccessToken } from '../middleware/auth';
import { isReservedHandle } from '../services/security/credentials';

function messagePrivacyOf(user: { notificationPrefs?: any } | null | undefined) {
  const prefs = user?.notificationPrefs && typeof user.notificationPrefs === 'object' ? user.notificationPrefs : {};
  const msg = prefs.messages && typeof prefs.messages === 'object' ? prefs.messages : {};
  return {
    readReceiptsOn: msg.readReceiptsOn !== false,
    lastSeenOn: msg.lastSeenOn !== false,
  };
}

// Strip HTML angle brackets from free-text so stored values can never carry
// markup into any HTML surface (web client, emails). Defense-in-depth on top
// of the client's own escaping.
const noHtml = (s: string) => s.replace(/[<>]/g, '');
// Avatar must be a safe https/data-image URL or a short emoji — never a
// javascript:/data:text/html scheme (classic stored-XSS vector).
const safeAvatar = z.string().max(512).refine(
  (v) => v === '' || /^https:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v) || [...v].length <= 8,
  'Avatar must be an https URL, image data URL, or emoji',
);

const updateProfileSchema = z.object({
  // Handles are stored lower-case and unique regardless of case, so "@Alice"
  // can never sit next to "@alice" and catch payments meant for her.
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .transform((u) => u.toLowerCase())
    .refine((u) => !isReservedHandle(u), 'That handle is reserved')
    .optional(),
  bio: z.string().max(500).transform(noHtml).optional(),
  avatarUrl: safeAvatar.optional(),
  baseCurrency: z.enum(['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']).optional(),
  profilePublic: z.boolean().optional(),
  acceptedCurrencies: z.array(z.string().max(12)).max(50).optional(),
});

export class ProfileController {
  /**
   * Search public profiles by handle prefix. Used by the mobile Send
   * screen for the "type-ahead" recipient picker. Returns up to 10
   * matches (only profiles flagged `profilePublic = true`).
   */
  static async searchProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      // Signed-in customers only (the app always sends its token): an open
      // endpoint let anyone page through every public customer's full name
      // by handle prefix.
      const auth = req.headers.authorization;
      const viewer = auth?.startsWith('Bearer ') ? verifyAccessToken(auth.slice(7)) : null;
      if (!viewer || await isAccessRevoked(viewer.id, viewer.iat, viewer.sid)) throw new AppError('Sign in to search for people', 401);
      const q = String(req.query.q ?? '').trim().toLowerCase().replace(/^@/, '').slice(0, 30);
      if (q.length < 1) return res.json({ profiles: [] });
      const matches = await prisma.user.findMany({
        where: {
          profilePublic: true,
          // Only accounts that can actually receive money (not frozen,
          // closed, banned or unverified-pending), and never the viewer.
          status: 'ACTIVE',
          id: { not: viewer.id },
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
          bio: true, avatarUrl: true, role: true, kycStatus: true,
          profilePublic: true, createdAt: true, notificationPrefs: true,
        },
      });
      if (!user) throw new AppError('User not found', 404);
      const [me, lastLogin] = await Promise.all([
        prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { notificationPrefs: true },
        }),
        prisma.loginHistory.findFirst({
          where: { userId: id, success: true },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);
      const mine = messagePrivacyOf(me);
      const theirs = messagePrivacyOf(user);
      const canSeeReadReceipts = mine.readReceiptsOn && theirs.readReceiptsOn;
      const canSeePresence = mine.lastSeenOn && theirs.lastSeenOn;
      const onlineUsers = req.app.get('onlineUsers') as Map<string, number> | undefined;
      const onlineNow = canSeePresence ? Boolean(onlineUsers?.has(id)) : false;
      // Name, handle and avatar are what a chat header needs. Bio, KYC state
      // and join date only for public profiles (or yourself). `role` is never
      // exposed (it let any customer find staff/admin accounts to target);
      // the support account is flagged so the app can label its thread.
      const isSelf = id === req.user!.id;
      const showDetails = isSelf || user.profilePublic;
      const isSupport = user.username === 'support';
      res.json({
        user: {
          id: user.id, firstName: user.firstName, lastName: user.lastName, username: user.username,
          avatarUrl: user.avatarUrl, profilePublic: user.profilePublic,
          ...(showDetails ? { bio: user.bio, kycStatus: user.kycStatus, createdAt: user.createdAt } : {}),
          isSupport,
          messagePrivacy: {
            ...theirs,
            canSeeReadReceipts,
            canSeePresence,
            onlineNow,
            lastSeenAt: canSeePresence ? lastLogin?.createdAt ?? null : null,
          },
        },
      });
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
          where: { username: { equals: data.username, mode: 'insensitive' }, NOT: { id: req.user!.id } },
          select: { id: true },
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
