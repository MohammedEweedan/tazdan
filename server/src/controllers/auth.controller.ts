import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { generateTokens } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { generateReferralCode } from '../utils/helpers';
import { AuthRequest } from '../types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
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
          referralCode,
          referredBy: referrerId,
          status: 'ACTIVE',
        },
      });

      // Create wallets for LYD, USD, USDT
      await prisma.wallet.createMany({
        data: [
          { userId: user.id, currency: 'LYD' },
          { userId: user.id, currency: 'USD' },
          { userId: user.id, currency: 'USDT' },
        ],
      });

      const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });

      res.status(201).json({
        user: {
          id: user.id, email: user.email, firstName: user.firstName,
          lastName: user.lastName, role: user.role, kycStatus: user.kycStatus,
          referralCode: user.referralCode,
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
}
