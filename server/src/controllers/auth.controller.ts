import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import {
  generateTokens,
  persistRefreshToken,
  verifyAndConsumeRefreshToken,
  revokeRefreshToken,
} from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { generateReferralCode } from '../utils/helpers';
import { AuthRequest } from '../types';
import crypto from 'crypto';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/email';

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  // Optional public @handle. When provided we save it as `username` and
  // default `profilePublic = true` so the user is immediately discoverable
  // via /u/[handle] for QR-pay flows.
  username: z.string().min(3).max(30).regex(/^[a-z0-9._]+$/i, 'Handle: a-z 0-9 . _').optional(),
  avatarUrl: z.string().optional(),
  phone: z.string().optional(),
  referralCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().optional(),
});

export class AuthController {
  static async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);

      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new AppError('Email already registered', 400);

      if (data.phone) {
        const existingPhone = await prisma.user.findUnique({ where: { phone: data.phone } });
        if (existingPhone) throw new AppError('Phone number already registered', 400);
      }

      if (data.username) {
        const existingHandle = await prisma.user.findFirst({ where: { username: data.username.toLowerCase() } });
        if (existingHandle) throw new AppError('Handle already taken', 400);
      }

      let referrerId: string | undefined;
      if (data.referralCode) {
        const referrer = await prisma.user.findUnique({ where: { referralCode: data.referralCode } });
        if (!referrer) throw new AppError('Invalid referral code', 400);
        referrerId = referrer.id;
      }

      const passwordHash = await bcrypt.hash(data.password, 12);
      const referralCode = generateReferralCode();

      const user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          // The handle the user picked at registration becomes their public
          // @username. Public-by-default so QR-code payments work out of the
          // box; can be flipped private from Settings.
          username: data.username?.toLowerCase(),
          avatarUrl: data.avatarUrl || null,
          profilePublic: !!data.username,
          referralCode,
          referredBy: referrerId,
          status: 'PENDING',
        },
      });

      // Create wallets for the standard initial currency set.
      // (Currency enum now includes all MENA + major fiat — see schema.prisma.)
      const initialCurrencies = ['USDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'] as const;
      await prisma.wallet.createMany({
        data: initialCurrencies.map((currency) => ({ userId: user.id, currency })),
      });

      const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
      await persistRefreshToken({
        userId: user.id,
        rawToken: tokens.refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.toString(),
      });

      // Generate 6-digit email verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationCode: verificationCode,
          emailVerificationCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      sendWelcomeEmail({ to: user.email, firstName: user.firstName }).catch((e) => console.error('[email] welcome failed:', e));
      sendVerificationEmail({ to: user.email, firstName: user.firstName, code: verificationCode }).catch((e) => console.error('[email] verification failed:', e));

      res.status(201).json({
        user: {
          id: user.id, email: user.email, firstName: user.firstName,
          lastName: user.lastName, username: user.username,
          profilePublic: user.profilePublic,
          role: user.role, kycStatus: user.kycStatus,
          referralCode: user.referralCode,
          emailVerified: false,
        },
        ...tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email: data.email } });
      if (!user) throw new AppError('Invalid email or password', 401);
      if (user.status === 'BANNED' || user.status === 'SUSPENDED') throw new AppError('Account is suspended or banned', 403);

      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) throw new AppError('Invalid email or password', 401);

      if (user.twoFactorEnabled) {
        if (!data.twoFactorCode) return res.status(200).json({ requires2FA: true });
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret!, encoding: 'base32', token: data.twoFactorCode, window: 2,
        });
        if (!verified) throw new AppError('Invalid 2FA code', 401);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
      });

      const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
      await persistRefreshToken({
        userId: user.id,
        rawToken: tokens.refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.toString(),
      });

      res.json({
        user: {
          id: user.id, email: user.email, firstName: user.firstName,
          lastName: user.lastName, role: user.role, kycStatus: user.kycStatus,
          twoFactorEnabled: user.twoFactorEnabled, referralCode: user.referralCode,
        },
        ...tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   * Rotates the refresh token: revokes the presented one, issues a new pair.
   * Reuse of an already-revoked token revokes ALL sessions for the user.
   */
  static async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken: presented } = refreshSchema.parse(req.body);

      // Verifies signature, DB presence, expiry, and not-revoked.
      const stored = await verifyAndConsumeRefreshToken(presented);

      const user = await prisma.user.findUnique({ where: { id: stored.userId } });
      if (!user) throw new AppError('User not found', 404);
      if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
        throw new AppError('Account is suspended or banned', 403);
      }

      // Issue a new pair, persist it, then revoke the old one and link them.
      const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
      const newRow = await persistRefreshToken({
        userId: user.id,
        rawToken: tokens.refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.toString(),
        replacedById: undefined,
      });
      await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedById: newRow.id },
      });

      res.json({ ...tokens });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Body: { refreshToken }
   * Revokes the presented refresh token. Access token simply expires (24h).
   * If you need instant access-token revocation, add a denylist with the JWT
   * `jti` claim — out of scope here.
   */
  static async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken: presented } = refreshSchema.parse(req.body);
      await revokeRefreshToken(presented);
      res.json({ message: 'Logged out' });
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: {
          id: true, email: true, phone: true, firstName: true, lastName: true,
          role: true, status: true, kycStatus: true, twoFactorEnabled: true,
          emailVerified: true, phoneVerified: true, referralCode: true,
          lastLoginAt: true, createdAt: true,
        },
      });
      if (!user) throw new AppError('User not found', 404);
      res.json({ user });
    } catch (error) {
      next(error);
    }
  }

  static async enable2FA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const secret = speakeasy.generateSecret({
        name: `promrkts:${req.user!.email}`,
        issuer: 'promrkts',
      });

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { twoFactorSecret: secret.base32 },
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
      res.json({ secret: secret.base32, qrCode: qrCodeUrl });
    } catch (error) {
      next(error);
    }
  }

  static async verify2FA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user?.twoFactorSecret) throw new AppError('2FA setup not initiated', 400);

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 2,
      });
      if (!verified) throw new AppError('Invalid 2FA code', 400);

      await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
      res.json({ message: '2FA enabled successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async disable2FA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code } = req.body;
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user?.twoFactorSecret || !user.twoFactorEnabled) throw new AppError('2FA is not enabled', 400);

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret, encoding: 'base32', token: code, window: 2,
      });
      if (!verified) throw new AppError('Invalid 2FA code', 400);

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      });
      res.json({ message: '2FA disabled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Email verification ─── */
  static async verifyEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.query as { token: string };
      if (!token) throw new AppError('Token required', 400);

      const user = await prisma.user.findFirst({
        where: {
          emailVerificationToken: token,
          emailVerificationExpires: { gt: new Date() },
        },
      });
      if (!user) throw new AppError('Invalid or expired verification token', 400);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          emailVerificationCode: null,
          emailVerificationCodeExpires: null,
          status: user.status === 'PENDING' ? 'ACTIVE' : user.status,
        },
      });

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmailCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError('Authentication required', 401);

      const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) throw new AppError('User not found', 404);
      if (dbUser.emailVerified) throw new AppError('Email already verified', 400);
      if (
        !dbUser.emailVerificationCode ||
        dbUser.emailVerificationCode !== code ||
        !dbUser.emailVerificationCodeExpires ||
        dbUser.emailVerificationCodeExpires < new Date()
      ) {
        throw new AppError('Invalid or expired verification code', 400);
      }

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          emailVerificationCode: null,
          emailVerificationCodeExpires: null,
          status: dbUser.status === 'PENDING' ? 'ACTIVE' : dbUser.status,
        },
      });

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async resendVerification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError('Authentication required', 401);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) throw new AppError('User not found', 404);
      if (dbUser.emailVerified) throw new AppError('Email already verified', 400);

      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          emailVerificationCode: verificationCode,
          emailVerificationCodeExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      sendVerificationEmail({
        to: dbUser.email,
        firstName: dbUser.firstName,
        code: verificationCode,
      }).catch((e) => console.error('[email] resend verification failed:', e));

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Password reset ─── */
  static async forgotPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        // Always return success to prevent email enumeration
        return res.json({ message: 'If an account exists, a reset email has been sent.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        token,
      }).catch((e) => console.error('[email] password reset failed:', e));

      res.json({ message: 'If an account exists, a reset email has been sent.' });
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token, password } = z.object({
        token: z.string().min(10),
        password: z.string().min(8).max(128),
      }).parse(req.body);

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
        },
      });
      if (!user) throw new AppError('Invalid or expired reset token', 400);

      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // Revoke all refresh tokens for this user as a security measure
      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      });

      res.json({ message: 'Password reset successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }
}
