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
import { createUserWallets } from '../services/wallet/walletDerivation.service';
import { startVerification, checkVerification } from '../services/whatsapp';

const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

/**
 * Eighteen-years-ago cutoff. We compute it once per request rather than
 * baking it into the schema — Zod doesn't have built-in age validation.
 */
function isAdult(dob: Date): boolean {
  const now = new Date();
  const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  return dob.getTime() <= cutoff.getTime();
}

// Business profile payload. Required when accountType === 'BUSINESS'.
// Validated via zod refinement on the outer schema below.
const businessProfileSchema = z.object({
  companyName:      z.string().min(2, 'Company name required').max(200),
  legalName:        z.string().max(200).optional(),
  registrationNo:   z.string().max(80).optional(),
  taxId:            z.string().max(80).optional(),
  country:          z.string().length(2, 'Select company country'),
  industry:         z.string().max(80).optional(),
  employeeCount:    z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).optional(),
  website:          z.string().url('Enter a valid URL').optional().or(z.literal('')),
  billingEmail:     z.string().email().optional().or(z.literal('')),
  supportEmail:     z.string().email().optional().or(z.literal('')),
  useCase:          z.string().max(500).optional(),
  monthlyVolumeUsd: z.coerce.number().nonnegative().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  // Required public @handle. Becomes the user's @username and the slug
  // for /u/[handle] (QR-pay flows). Lower-cased server-side.
  username: z
    .string()
    .min(3, 'Handle must be 3-30 characters')
    .max(30, 'Handle must be 3-30 characters')
    .regex(/^[a-z0-9._]+$/i, 'Handle: a-z 0-9 . _ only'),
  // ISO 3166-1 alpha-2.
  country: z.string().length(2, 'Select your country'),
  // Dial code WITHOUT the '+' prefix (server normalises). E.g. "218".
  phoneCountryCode: z.string().min(1).max(4).regex(/^\d+$/, 'Country code must be digits'),
  // Local phone number (national subscriber number).
  phone: z.string().min(4, 'Phone number required').max(20),
  // ISO date string (YYYY-MM-DD). Coerced to Date.
  dateOfBirth: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date of birth' }) }),
  avatarUrl: z.string().optional(),
  referralCode: z.string().optional(),
  // ── B2B ──────────────────────────────────────────────────────
  // Defaults to PERSONAL. When BUSINESS, the businessProfile object
  // becomes required (refinement below).
  accountType: z.enum(['PERSONAL', 'BUSINESS']).default('PERSONAL'),
  businessProfile: businessProfileSchema.optional(),
}).refine(
  (d) => d.accountType !== 'BUSINESS' || !!d.businessProfile,
  { message: 'businessProfile is required when accountType is BUSINESS', path: ['businessProfile'] },
);

const loginSchema = z.object({
  // Can be an email or a handle (username).
  email: z.string().min(1, 'Email or handle is required').max(254),
  password: z.string().min(1).max(256),
  twoFactorCode: z.string().min(6).max(8).optional(),
});

// Per-user brute-force protection. Lockout grows from 5 → 15 → 60 min
// after each subsequent burst of 5 failed attempts. Combined with the
// per-IP authLimiter this stops both credential-stuffing (many emails
// from one IP) and password-spray (many IPs against one email).
async function recordFailedLogin(userId: string) {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: { increment: 1 } },
    select: { failedLoginAttempts: true },
  });
  if (u.failedLoginAttempts >= 5) {
    const tier = Math.min(3, Math.floor(u.failedLoginAttempts / 5));
    const minutes = [5, 15, 60][tier - 1] ?? 60;
    await prisma.user.update({
      where: { id: userId },
      data: { lockoutUntil: new Date(Date.now() + minutes * 60 * 1000) },
    });
  }
}

export class AuthController {
  static async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);

      // 18+ check (legal requirement for trading + AML).
      if (!isAdult(data.dateOfBirth)) {
        throw new AppError('You must be 18 or older to register', 400);
      }

      // Normalise phone to E.164: + + countryCode + nationalNumber, digits only.
      const normalisedPhone = `+${data.phoneCountryCode}${data.phone.replace(/\D/g, '')}`;

      // Generic message on collisions so an attacker can't enumerate
      // which emails / phones / handles are registered.  Surfacing the
      // specific conflicting field (the old behaviour) gave them a
      // free user-existence oracle for credential-stuffing list
      // priming and phishing-target qualification.
      const ENUM_GENERIC = 'Registration failed — those credentials are already in use.';
      const [existing, existingPhone, existingHandle] = await Promise.all([
        prisma.user.findUnique({ where: { email: data.email } }),
        prisma.user.findUnique({ where: { phone: normalisedPhone } }),
        prisma.user.findFirst({ where: { username: data.username.toLowerCase() } }),
      ]);
      if (existing || existingPhone || existingHandle) {
        throw new AppError(ENUM_GENERIC, 400);
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
          phone: normalisedPhone,
          phoneCountryCode: data.phoneCountryCode,
          country: data.country.toUpperCase(),
          dateOfBirth: data.dateOfBirth,
          // The handle the user picked at registration becomes their public
          // @username. Public-by-default so QR-code payments work out of the
          // box; can be flipped private from Settings.
          username: data.username.toLowerCase(),
          avatarUrl: data.avatarUrl || null,
          profilePublic: true,
          referralCode,
          referredBy: referrerId,
          status: 'PENDING',
          accountType: data.accountType,
          // 1:1 BusinessProfile — only when registering as BUSINESS.
          ...(data.accountType === 'BUSINESS' && data.businessProfile
            ? {
                businessProfile: {
                  create: {
                    companyName:      data.businessProfile.companyName,
                    legalName:        data.businessProfile.legalName,
                    registrationNo:   data.businessProfile.registrationNo,
                    taxId:            data.businessProfile.taxId,
                    country:          data.businessProfile.country.toUpperCase(),
                    industry:         data.businessProfile.industry,
                    employeeCount:    data.businessProfile.employeeCount,
                    website:          data.businessProfile.website || null,
                    billingEmail:     data.businessProfile.billingEmail || data.email,
                    supportEmail:     data.businessProfile.supportEmail || null,
                    useCase:          data.businessProfile.useCase,
                    monthlyVolumeUsd: data.businessProfile.monthlyVolumeUsd,
                  },
                },
              }
            : {}),
        },
      });

      // Create wallets for the standard initial currency set.
      // (Currency enum now includes all MENA + major fiat — see schema.prisma.)
      const initialCurrencies = ['USDT', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'] as const;
      await prisma.wallet.createMany({
        data: initialCurrencies.map((currency) => ({ userId: user.id, currency })),
      });

      // Derive ETH/BTC/SOL/TRON custody addresses from the master BIP-39
      // seed. Non-fatal on failure — user can still log in; wallet
      // endpoints will lazily back-fill.
      createUserWallets(user.id).catch((e) => {
        console.error('[wallet] createUserWallets failed for', user.id, e);
      });

      const tokens = generateTokens({ id: user.id, email: user.email, role: user.role });
      await persistRefreshToken({
        userId: user.id,
        rawToken: tokens.refreshToken,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']?.toString(),
      });

      // Generate 6-digit email verification code via CSPRNG.
      // Math.random() is predictable from a single observed output
      // (Mersenne Twister state recovery) and is not safe for any
      // value that gates auth flow.  randomInt draws from /dev/urandom.
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: verificationCode,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      // Welcome email is intentionally NOT sent here — it goes out from
      // verifyEmailCode() once the user proves they own the address.
      sendVerificationEmail({ to: user.email, firstName: user.firstName, code: verificationCode })
        .catch((e) => console.error('[email] verification failed:', e));

      res.status(201).json({
        user: {
          id: user.id, email: user.email, firstName: user.firstName,
          lastName: user.lastName, username: user.username,
          profilePublic: user.profilePublic,
          role: user.role, accountType: user.accountType,
          kycStatus: user.kycStatus,
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

      // Support login by email OR handle (@username).
      const loginIdentifier = data.email.toLowerCase().replace(/^@/, '');
      const isEmail = loginIdentifier.includes('@');

      const user = await prisma.user.findFirst({
        where: isEmail
          ? { email: loginIdentifier }
          : { username: loginIdentifier },
      });

      // Single, generic message for all credential failures to defeat
      // enumeration. Bcrypt dummy compare keeps response time uniform
      // whether the email exists or not.
      const GENERIC = 'Invalid credentials';
      const DUMMY_HASH = '$2a$12$abcdefghijklmnopqrstuv0123456789012345678901234567890123';

      if (!user) {
        await bcrypt.compare(data.password, DUMMY_HASH).catch(() => false);
        throw new AppError(GENERIC, 401);
      }

      if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
        throw new AppError('Account is suspended or banned', 403);
      }

      // Per-account lockout window. Independent from the per-IP rate
      // limiter (which catches credential stuffing across many emails).
      if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        throw new AppError('Too many failed attempts. Try again later.', 429);
      }

      // CRITICAL: never short-circuit bcrypt. The previous
      // `x-simulator: true` header bypass meant any staging /
      // preview / QA environment (which often carries real prod
      // data) accepted ANY password, and a single `NODE_ENV`
      // misconfiguration in prod was full auth bypass. If load
      // testing needs to skip bcrypt, do it via a build-time flag
      // tied to a non-prod database, not a request header.
      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        await recordFailedLogin(user.id);
        throw new AppError(GENERIC, 401);
      }

      if (user.twoFactorEnabled) {
        if (!data.twoFactorCode) return res.status(200).json({ requires2FA: true });
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret!, encoding: 'base32', token: data.twoFactorCode, window: 1,
        });
        if (!verified) {
          await recordFailedLogin(user.id);
          throw new AppError('Invalid 2FA code', 401);
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          lastLoginIp: req.ip,
          failedLoginAttempts: 0,
          lockoutUntil: null,
        },
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
          username: true, avatarUrl: true,
          role: true, accountType: true,
          status: true, kycStatus: true, twoFactorEnabled: true,
          emailVerified: true, phoneVerified: true, referralCode: true,
          lastLoginAt: true, createdAt: true,
          businessProfile: {
            select: {
              id: true, companyName: true, legalName: true, country: true,
              industry: true, employeeCount: true, website: true,
              billingEmail: true, supportEmail: true, kybStatus: true,
            },
          },
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
        name: `Fortuni:${req.user!.email}`,
        issuer: 'Fortuni',
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
      // Require BOTH password and current TOTP code.  Previously
      // only the TOTP was required, so a stolen unlocked phone (the
      // TOTP app + a session) could disable 2FA in one tap, then go
      // change the withdrawal address (which only requires 2FA).
      // Forcing a password re-prompt breaks that chain.
      const { code, password } = z.object({
        code: z.string().min(6),
        password: z.string().min(1),
      }).parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user?.twoFactorSecret || !user.twoFactorEnabled) throw new AppError('2FA is not enabled', 400);

      const validPw = await bcrypt.compare(password, user.passwordHash);
      if (!validPw) throw new AppError('Invalid password', 401);

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
        !dbUser.emailVerificationToken ||
        dbUser.emailVerificationToken !== code ||
        !dbUser.emailVerificationExpires ||
        dbUser.emailVerificationExpires < new Date()
      ) {
        throw new AppError('Invalid or expired verification code', 400);
      }

      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
          status: dbUser.status === 'PENDING' ? 'ACTIVE' : dbUser.status,
        },
      });

      // Welcome email is sent ONLY now — proves the address is real and
      // avoids polluting inboxes for half-finished signups.
      sendWelcomeEmail({ to: dbUser.email, firstName: dbUser.firstName })
        .catch((e) => console.error('[email] welcome failed:', e));

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

      // CSPRNG, not Math.random — see register() above.
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      // Write to the SAME field pair `verifyEmailCode()` reads from
      // (`emailVerificationToken` / `emailVerificationExpires`).  The
      // previous code wrote to `emailVerificationCode` / `…Expires`,
      // which `verifyEmailCode()` never reads — so after a resend the
      // user could no longer verify with any code.  Pre-existing
      // breakage, fixed in passing.
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          emailVerificationToken: verificationCode,
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

      // Generate the raw token (high-entropy, 256 bits) for the email
      // link, but persist only the SHA-256 hash.  A read-only DB
      // compromise (backup leak, replica access, slow-query log)
      // would otherwise yield every live reset token → instant
      // takeover.  Same pattern refreshTokens already uses.
      const token     = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: tokenHash,
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

      // Hash the supplied token and compare against the stored hash —
      // mirrors the forgotPassword storage change above.
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: tokenHash,
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

      await prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { revokedAt: new Date() },
      });

      res.json({ message: 'Password reset successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Phone / WhatsApp OTP ─── */

  static async startPhoneVerification(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError('Authentication required', 401);

      const { channel } = z.object({
        channel: z.enum(['whatsapp', 'sms']).default('whatsapp'),
      }).parse(req.body);

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { phone: true, phoneCountryCode: true, phoneVerified: true },
      });
      if (!dbUser) throw new AppError('User not found', 404);
      if (dbUser.phoneVerified) throw new AppError('Phone already verified', 400);

      const phone = `+${dbUser.phoneCountryCode}${dbUser.phone}`;
      const result = await startVerification({ phone, channel, userId: user.id });
      if (!result.ok) throw new AppError(result.reason ?? 'Failed to send code', 502);

      res.json({ message: 'Verification code sent', status: result.status, mode: result.mode, simulated: result.reason === 'simulated' });
    } catch (error) {
      next(error);
    }
  }

  static async verifyPhone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError('Authentication required', 401);

      const { code } = z.object({ code: z.string().min(4).max(8) }).parse(req.body);

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { phone: true, phoneCountryCode: true, phoneVerified: true },
      });
      if (!dbUser) throw new AppError('User not found', 404);
      if (dbUser.phoneVerified) throw new AppError('Phone already verified', 400);

      const phone = `+${dbUser.phoneCountryCode}${dbUser.phone}`;
      const result = await checkVerification({ phone, code, userId: user.id });
      if (!result.valid) throw new AppError('Invalid or expired code', 400);

      await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });

      res.json({ message: 'Phone verified successfully' });
    } catch (error) {
      next(error);
    }
  }
}
