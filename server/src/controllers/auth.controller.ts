import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import {
  issueSessionTokens,
  verifyAndConsumeRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
  clearAdminCache,
} from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { generateReferralCode } from '../utils/helpers';
import { AuthRequest } from '../types';
import crypto from 'crypto';
import {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  send2FARecoveryEmail,
  emailErrorSummary,
} from '../services/email';
import { createUserWallets } from '../services/wallet/walletDerivation.service';
import { startVerification, checkVerification } from '../services/whatsapp';
import { recordSecurityEvent } from '../services/platform/securityEvents';
import { recordRiskEvent } from '../services/risk/engine';
import { clearAttempts, reserveAttempt } from '../utils/redis';
import { logger } from '../utils/logger';
import {
  BCRYPT_COST,
  burnPasswordCompare,
  normalizeEmail,
  isReservedHandle,
  normalizeLoginIdentifier,
  reserveAccountLoginAttempt,
  reserveUnknownLoginAttempt,
  safeEqual,
  sensitiveActionSucceeded,
  verifyPasswordForSensitiveAction,
} from '../services/security/credentials';
import { verifyTotpOnce } from '../services/security/totp';
import { sendSecurityNotice } from '../services/security/notify';
import { recordLogin } from './security.controller';

const PHONE_OTP_MAX_ATTEMPTS = 5;
const PHONE_OTP_LOCK_SECONDS = 15 * 60;
const PHONE_OTP_SENDS_PER_HOUR = 5;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const EMAIL_CODES_PER_HOUR = 5;
const RESET_EMAILS_PER_HOUR = 3;
const RECOVERY_EMAILS_PER_HOUR = 3;
const RECOVERY_MAX_ATTEMPTS = 5;

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(4096),
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

// Legal names: letters (any script) with spaces, apostrophes, hyphens and
// dots. No markup — names are interpolated into emails the platform sends.
const personName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, 'Use letters, spaces, apostrophes and hyphens only');

// Same rule as profile updates: an https URL, a small raster data URL, or an
// emoji — never javascript:/SVG/HTML.
const safeAvatar = z.string().max(512).refine(
  (v) => v === '' || /^https:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v) || [...v].length <= 8,
  'Avatar must be an https URL, image data URL, or emoji',
);

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
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  firstName: personName,
  lastName: personName,
  // Required public @handle. Becomes the user's @username and the slug
  // for /u/[handle] (QR-pay flows). Lower-cased server-side.
  username: z
    .string()
    .min(3, 'Handle must be 3-30 characters')
    .max(30, 'Handle must be 3-30 characters')
    .regex(/^[a-z0-9._]+$/i, 'Handle: a-z 0-9 . _ only')
    .refine((h) => !isReservedHandle(h), 'That handle is reserved'),
  // ISO 3166-1 alpha-2.
  country: z.string().length(2, 'Select your country'),
  // Dial code WITHOUT the '+' prefix (server normalises). E.g. "218".
  phoneCountryCode: z.string().min(1).max(4).regex(/^\d+$/, 'Country code must be digits'),
  // Local phone number (national subscriber number).
  phone: z.string().min(4, 'Phone number required').max(20),
  // ISO date string (YYYY-MM-DD). Coerced to Date.
  dateOfBirth: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid date of birth' }) }),
  avatarUrl: safeAvatar.optional(),
  referralCode: z.string().max(64).optional(),
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

// ── Email verification codes ─────────────────────────────────────────
// Stored as a digest bound to the user (never the bare 6 digits): a DB or
// backup leak yields no live code, and two users can no longer collide on
// the unique column. Rows written before this change hold the bare code and
// are still accepted until they expire.
function emailCodeDigest(userId: string, code: string): string {
  return `ev1:${sha256(`${userId}:${code}`)}`;
}
function emailCodeMatches(stored: string, userId: string, code: string): boolean {
  return /^\d{6}$/.test(stored) ? safeEqual(stored, code) : safeEqual(stored, emailCodeDigest(userId, code));
}

type VerifiableUser = {
  id: string; email: string; firstName: string; status: string; emailVerified: boolean;
  emailVerificationToken: string | null; emailVerificationExpires: Date | null;
};

/** 5 tries per issued code (reserved before comparing); then the code is burned. */
async function confirmEmailCode(user: VerifiableUser, code: string): Promise<void> {
  if (user.emailVerified) throw new AppError('Email already verified', 400);
  const triesKey = `auth:emailcode:${user.id}`;
  const burn = () => prisma.user.updateMany({
    where: { id: user.id, emailVerified: false },
    data: { emailVerificationToken: null, emailVerificationExpires: null },
  });
  const slot = await reserveAttempt(triesKey, EMAIL_CODE_MAX_ATTEMPTS, 24 * 60 * 60);
  if (!slot.allowed) {
    await burn();
    throw new AppError('Too many attempts. Request a new code.', 429);
  }
  const stored = user.emailVerificationToken;
  const valid = !!stored && !!user.emailVerificationExpires && user.emailVerificationExpires > new Date() &&
    emailCodeMatches(stored, user.id, code);
  if (!valid) {
    if (slot.count >= EMAIL_CODE_MAX_ATTEMPTS) await burn();
    throw new AppError('Invalid or expired verification code', 400);
  }
  // Single use: only the request that clears this exact code verifies.
  const done = await prisma.user.updateMany({
    where: { id: user.id, emailVerificationToken: stored },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      emailVerificationCode: null,
      emailVerificationCodeExpires: null,
      ...(user.status === 'PENDING' ? { status: 'ACTIVE' as const } : {}),
    },
  });
  if (done.count !== 1) throw new AppError('Invalid or expired verification code', 400);
  await clearAttempts(triesKey);
  // Welcome email is sent ONLY now — proves the address is real and
  // avoids polluting inboxes for half-finished signups.
  sendWelcomeEmail({ to: user.email, firstName: user.firstName })
    .catch((e) => console.error('[email] welcome failed:', emailErrorSummary(e)));
}

/** E.164 for the OTP providers. Registration stores `+<cc><digits>`; older rows may hold the national number only. */
function e164(phone: string | null, countryCode: string | null): string {
  if (phone?.startsWith('+')) return phone;
  return `+${countryCode ?? ''}${(phone ?? '').replace(/\D/g, '')}`;
}

// Issued in the background AFTER the generic response, so neither the
// answer nor its timing reveals whether the address is registered.
async function issuePasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'CLOSED') return;
  // Each new code would buy a guesser 5 fresh tries (and spams the owner).
  const slot = await reserveAttempt(`auth:reset:issue:${user.id}`, RESET_EMAILS_PER_HOUR, 60 * 60);
  if (!slot.allowed) return;

  // Two ways to reset, two separate secrets:
  //   • a LINK with a 32-byte random token (web) — unguessable, so it
  //     can be verified by bare hash lookup, and
  //   • a 6-digit CODE the user types into the mobile app — guessable
  //     in principle (1e6 space), so it is only valid together with
  //     the account email and is capped at 5 attempts.
  // Only SHA-256 hashes are persisted (a DB/backup/replica leak must
  // not yield a live reset secret).
  const linkToken = crypto.randomBytes(32).toString('hex');
  const code      = crypto.randomInt(100000, 1000000).toString(); // 6 digits, CSPRNG
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: sha256(linkToken),
      passwordResetCode: sha256(code),
      passwordResetAttempts: 0,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await sendPasswordResetEmail({ to: user.email, firstName: user.firstName, token: linkToken, code })
    .catch((e) => console.error('[email] password reset failed:', emailErrorSummary(e)));
}

async function issue2FARecovery(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Only send when the account exists AND has 2FA enabled (nothing to recover otherwise).
  if (!user || !user.twoFactorEnabled || user.status === 'CLOSED') return;
  const slot = await reserveAttempt(`auth:2farec:issue:${user.id}`, RECOVERY_EMAILS_PER_HOUR, 60 * 60);
  if (!slot.allowed) return;
  const code = crypto.randomInt(100000, 1000000).toString();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorRecoveryCode: sha256(code),
      twoFactorRecoveryExpires: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    },
  });
  await clearAttempts(`auth:2farec:try:${user.id}`);
  await send2FARecoveryEmail({ to: user.email, firstName: user.firstName, code })
    .catch((e) => console.error('[email] 2FA recovery failed:', emailErrorSummary(e)));
}

export class AuthController {
  static async register(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = registerSchema.parse(req.body);
      const email = normalizeEmail(data.email);
      const handle = data.username.toLowerCase();

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
      // Emails and handles are compared case-insensitively, so
      // "Alice@x.com" / "@Alice" cannot shadow an existing account.
      const ENUM_GENERIC = 'Registration failed — those credentials are already in use.';
      const [existing, existingPhone, existingHandle] = await Promise.all([
        prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }),
        prisma.user.findUnique({ where: { phone: normalisedPhone }, select: { id: true } }),
        prisma.user.findFirst({ where: { username: { equals: handle, mode: 'insensitive' } }, select: { id: true } }),
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

      const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);
      const referralCode = generateReferralCode();

      const user = await prisma.user.create({
        data: {
          email,
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
          username: handle,
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
                    billingEmail:     data.businessProfile.billingEmail || email,
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

      const { sessionId: _sessionId, ...tokens } = await issueSessionTokens(
        { id: user.id, email: user.email, role: user.role },
        { ipAddress: req.ip, userAgent: req.headers['user-agent']?.toString() },
      );

      // 6-digit email verification code via CSPRNG (never Math.random).
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationToken: emailCodeDigest(user.id, verificationCode),
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      // Welcome email is intentionally NOT sent here — it goes out from
      // verifyEmailCode() once the user proves they own the address.
      sendVerificationEmail({ to: user.email, firstName: user.firstName, code: verificationCode })
        .catch((e) => console.error('[email] verification failed:', emailErrorSummary(e)));

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
      const identifier = normalizeLoginIdentifier(data.email);
      const isEmail = identifier.includes('@');

      // Every failure says the same thing at the same speed, whether or not
      // the account exists, is locked, closed or banned: account state is
      // only revealed to someone who has just proved the password.
      const GENERIC = 'Invalid credentials';
      const LOCKED = 'Too many failed attempts. Try again later.';

      const user = await prisma.user.findFirst({
        where: isEmail ? { email: identifier } : { username: identifier },
      });

      if (!user) {
        // Same lockout schedule and the same bcrypt cost as a real account.
        if (!(await reserveUnknownLoginAttempt(identifier))) throw new AppError(LOCKED, 429);
        await burnPasswordCompare(data.password);
        throw new AppError(GENERIC, 401);
      }

      // Count the attempt BEFORE checking the password (atomic), so parallel
      // guesses cannot all pass the lockout check before a failure lands.
      // Combined with the per-IP authLimiter this stops both credential
      // stuffing (many emails from one IP) and password spraying (many IPs
      // against one email).
      if (!(await reserveAccountLoginAttempt(user.id))) {
        throw new AppError(LOCKED, 429);
      }

      // CRITICAL: never short-circuit bcrypt (no request-header bypasses).
      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        void recordSecurityEvent({ type: 'FAILED_LOGIN', severity: user.role === 'ADMIN' ? 'HIGH' : 'LOW', userId: user.id, ipAddress: req.ip, path: req.originalUrl });
        void recordLogin(user.id, req, false);
        throw new AppError(GENERIC, 401);
      }

      if (user.status === 'CLOSED') {
        throw new AppError('This account was closed. Contact support if you need your records.', 403, 'ACCOUNT_CLOSED');
      }
      if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
        throw new AppError('Account is suspended or banned', 403);
      }

      if (user.twoFactorEnabled) {
        if (!data.twoFactorCode) return res.status(200).json({ requires2FA: true });
        // Single use: a code seen once (shoulder, phishing proxy) cannot be replayed.
        const verified = await verifyTotpOnce(user.id, user.twoFactorSecret, data.twoFactorCode);
        if (!verified) {
          void recordSecurityEvent({ type: 'MFA_FAILURE', severity: user.role === 'ADMIN' ? 'HIGH' : 'MEDIUM', userId: user.id, ipAddress: req.ip, path: req.originalUrl });
          throw new AppError('Invalid 2FA code', 401);
        }
      }
      if (user.role === 'ADMIN') {
        void recordSecurityEvent({ type: 'ADMIN_LOGIN', severity: 'MEDIUM', userId: user.id, ipAddress: req.ip, path: req.originalUrl, details: { userAgent: req.headers['user-agent']?.toString().slice(0, 200) } });
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
      void recordLogin(user.id, req, true);

      const { sessionId: _sessionId, ...tokens } = await issueSessionTokens(
        { id: user.id, email: user.email, role: user.role },
        { ipAddress: req.ip, userAgent: req.headers['user-agent']?.toString() },
      );

      res.json({
        user: {
          id: user.id, email: user.email, firstName: user.firstName,
          lastName: user.lastName, username: user.username,
          avatarUrl: user.avatarUrl, profilePublic: user.profilePublic,
          role: user.role, kycStatus: user.kycStatus,
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
   * Reuse of an already-rotated token revokes ALL sessions (and their live
   * access tokens) for the user.
   */
  static async refresh(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { refreshToken: presented } = refreshSchema.parse(req.body);

      // Verifies signature, token type, DB presence, expiry, and not-revoked.
      const stored = await verifyAndConsumeRefreshToken(presented);

      const user = await prisma.user.findUnique({ where: { id: stored.userId } });
      if (!user) throw new AppError('User not found', 404);
      if (user.status === 'CLOSED') {
        throw new AppError('This account was closed. Contact support if you need your records.', 403, 'ACCOUNT_CLOSED');
      }
      if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
        throw new AppError('Account is suspended or banned', 403);
      }

      // Issue a new pair, then revoke the presented token conditionally. Two
      // concurrent refreshes with the same token must not both succeed — the
      // loser is treated as token reuse and its new session is discarded.
      const { sessionId, ...tokens } = await issueSessionTokens(
        { id: user.id, email: user.email, role: user.role },
        { ipAddress: req.ip, userAgent: req.headers['user-agent']?.toString() },
      );
      const rotated = await prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedById: sessionId },
      });
      if (rotated.count !== 1) {
        await prisma.refreshToken.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
        throw new AppError('Refresh token already used', 401);
      }

      res.json({ ...tokens });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Body: { refreshToken }
   * Revokes the presented refresh token AND the access token issued with it
   * (session denylist), so the access token stops working at once.
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
      // Never replace a secret that is in use: a stolen session could swap in
      // its own authenticator and then pass every 2FA and step-up check.
      // Changing authenticator means disabling first (password + current code).
      const current = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { twoFactorEnabled: true } });
      if (current?.twoFactorEnabled) throw new AppError('Two-factor authentication is already on. Turn it off first to set up a new authenticator.', 409);
      const secret = speakeasy.generateSecret({
        name: `tazdan:${req.user!.email}`,
        issuer: 'tazdan',
      });

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { twoFactorSecret: secret.base32 },
      });

      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
      // Return both the data-URI QR and the raw otpauth URL. Field names match
      // the mobile client (qrCodeDataUrl / otpauthUrl); `qrCode` kept for any
      // older/web client that still reads it.
      res.json({
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qrCodeDataUrl: qrCodeUrl,
        qrCode: qrCodeUrl,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Turn 2FA on. Requires the account PASSWORD as well as a code from the new
   * authenticator: once 2FA is on, every step-up challenge (transfers,
   * withdrawals, account closure) is answered from the authenticator instead
   * of an email code, so a stolen session alone must not be able to enrol an
   * authenticator it controls.
   */
  static async verify2FA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { code, password } = z.object({
        code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator'),
        password: z.string().max(256).optional(),
      }).parse(req.body);
      if (!password) throw new AppError('Enter your account password to turn on two-factor authentication.', 400);

      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user?.twoFactorSecret) throw new AppError('2FA setup not initiated', 400);
      if (user.twoFactorEnabled) throw new AppError('Two-factor authentication is already on.', 409);

      const pw = await verifyPasswordForSensitiveAction(user.id, user.passwordHash, password);
      if (pw === 'locked') throw new AppError('Too many attempts. Try again in 15 minutes.', 429);
      if (pw === 'invalid') throw new AppError('Incorrect password', 400);

      if (!(await verifyTotpOnce(user.id, user.twoFactorSecret, code))) throw new AppError('Invalid 2FA code', 400);

      // Activate exactly the secret that was just verified (a concurrent
      // /2fa/enable could have replaced it).
      const activated = await prisma.user.updateMany({
        where: { id: user.id, twoFactorEnabled: false, twoFactorSecret: user.twoFactorSecret },
        data: { twoFactorEnabled: true },
      });
      if (activated.count !== 1) throw new AppError('2FA setup changed. Start again.', 409);
      await sensitiveActionSucceeded(user.id);
      clearAdminCache(user.id);
      void recordRiskEvent(user.id, 'SECURITY_CHANGE', { change: '2fa_enabled' }, 'MEDIUM');
      sendSecurityNotice(user.id, 'two_factor_enabled', { ip: req.ip });
      res.json({ message: '2FA enabled successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async disable2FA(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Require BOTH password and current TOTP code, under one shared attempt
      // budget and one answer — a stolen session can use this neither as a
      // password oracle nor to guess codes once it knows the password.
      const { code, password } = z.object({
        code: z.string().min(6).max(8),
        password: z.string().min(1).max(256),
      }).parse(req.body);
      const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
      if (!user?.twoFactorSecret || !user.twoFactorEnabled) throw new AppError('2FA is not enabled', 400);

      const pw = await verifyPasswordForSensitiveAction(user.id, user.passwordHash, password);
      if (pw === 'locked') throw new AppError('Too many attempts. Try again in 15 minutes.', 429);
      const totpOk = pw === 'ok' && await verifyTotpOnce(user.id, user.twoFactorSecret, code);
      if (!totpOk) {
        void recordSecurityEvent({ type: 'MFA_FAILURE', severity: user.role === 'ADMIN' ? 'HIGH' : 'MEDIUM', userId: user.id, ipAddress: req.ip, path: req.originalUrl });
        throw new AppError('Incorrect password or authentication code', 400);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      });
      await sensitiveActionSucceeded(user.id);
      clearAdminCache(user.id); // staff lose console access at once in production
      void recordRiskEvent(req.user!.id, 'SECURITY_CHANGE', { change: '2fa_disabled' }, 'HIGH');
      sendSecurityNotice(user.id, 'two_factor_disabled', { ip: req.ip });
      res.json({ message: '2FA disabled successfully' });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Email verification ─── */
  /**
   * GET /verify-email?email=&token= — the code alone no longer identifies an
   * account (it used to verify whichever user happened to hold that 6-digit
   * value, unauthenticated and uncapped).
   */
  static async verifyEmail(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token, email } = z.object({
        token: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
        email: z.string().email().max(254),
      }).parse(req.query);
      const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
      if (!user) throw new AppError('Invalid or expired verification code', 400);
      await confirmEmailCode(user, token);
      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async verifyEmailCode(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError('Authentication required', 401);

      const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);

      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser) throw new AppError('User not found', 404);
      await confirmEmailCode(dbUser, code);
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

      const slot = await reserveAttempt(`auth:emailcode:issue:${dbUser.id}`, EMAIL_CODES_PER_HOUR, 60 * 60);
      if (!slot.allowed) throw new AppError('Too many codes requested. Try again later.', 429);

      // CSPRNG, not Math.random — see register() above.
      const verificationCode = crypto.randomInt(100000, 1000000).toString();
      // Write to the SAME field pair `confirmEmailCode()` reads from.
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          emailVerificationToken: emailCodeDigest(dbUser.id, verificationCode),
          emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      await clearAttempts(`auth:emailcode:${dbUser.id}`);

      sendVerificationEmail({
        to: dbUser.email,
        firstName: dbUser.firstName,
        code: verificationCode,
      }).catch((e) => console.error('[email] resend verification failed:', emailErrorSummary(e)));

      res.json({ message: 'Verification email sent' });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Password reset ─── */
  static async forgotPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = z.object({ email: z.string().email().max(254) }).parse(req.body);
      // Answer first: the same response, at the same speed, whether or not
      // the address is registered (no enumeration by content or timing).
      res.json({ message: 'If an account exists, a reset email has been sent.' });
      void issuePasswordReset(normalizeEmail(email))
        .catch((e) => logger.warn('[auth] password reset issue failed', { err: e }));
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { token, password, email } = z.object({
        // 6 chars = typed code; longer = link token. Both arrive as `token`.
        token: z.string().min(6).max(128),
        password: z.string().min(8).max(128),
        // Required for the 6-digit code path (identifies the account so
        // attempts can be counted). The link token needs no email — it
        // has 256 bits of entropy and is verified by unique hash lookup.
        email: z.string().email().max(254).optional(),
      }).parse(req.body);

      const isCode = /^\d{6}$/.test(token);
      const MAX_RESET_ATTEMPTS = 5;
      const now = new Date();
      const cleared = {
        passwordResetToken: null, passwordResetCode: null,
        passwordResetExpires: null, passwordResetAttempts: 0,
      };

      let userId: string;
      if (isCode) {
        if (!email) throw new AppError('Email is required with a reset code', 400);
        const INVALID = new AppError('Invalid or expired reset code', 400);
        const candidate = await prisma.user.findUnique({
          where: { email: normalizeEmail(email) },
          select: { id: true, passwordResetCode: true },
        });
        if (!candidate?.passwordResetCode) throw INVALID;
        const issued = candidate.passwordResetCode;

        // Reserve this attempt atomically BEFORE comparing: the conditional
        // increment is re-checked by Postgres under the row lock, so a burst
        // of parallel guesses gets at most 5 comparisons per code (the old
        // read-compare-write let every parallel request see "0 attempts").
        const reserved = await prisma.user.updateMany({
          where: {
            id: candidate.id, passwordResetCode: issued,
            passwordResetExpires: { gt: now }, passwordResetAttempts: { lt: MAX_RESET_ATTEMPTS },
          },
          data: { passwordResetAttempts: { increment: 1 } },
        });
        const burn = () => prisma.user.updateMany({ where: { id: candidate.id, passwordResetCode: issued }, data: cleared });
        if (reserved.count !== 1) {
          await burn(); // exhausted or expired — the remaining space can't be walked
          throw INVALID;
        }
        if (!safeEqual(issued, sha256(token))) {
          await prisma.user.updateMany({
            where: { id: candidate.id, passwordResetCode: issued, passwordResetAttempts: { gte: MAX_RESET_ATTEMPTS } },
            data: cleared,
          });
          throw INVALID;
        }
        const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
        // Single use: only one request can consume this exact code.
        const consumed = await prisma.user.updateMany({
          where: { id: candidate.id, passwordResetCode: issued, passwordResetExpires: { gt: new Date() } },
          data: { ...cleared, passwordHash, failedLoginAttempts: 0, lockoutUntil: null },
        });
        if (consumed.count !== 1) throw INVALID;
        userId = candidate.id;
      } else {
        // Link-token path — hash lookup, mirrors forgotPassword storage.
        const tokenHash = sha256(token);
        const user = await prisma.user.findFirst({
          where: { passwordResetToken: tokenHash, passwordResetExpires: { gt: now } },
          select: { id: true },
        });
        if (!user) throw new AppError('Invalid or expired reset token', 400);
        const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
        const consumed = await prisma.user.updateMany({
          where: { id: user.id, passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() } },
          data: { ...cleared, passwordHash, failedLoginAttempts: 0, lockoutUntil: null },
        });
        if (consumed.count !== 1) throw new AppError('Invalid or expired reset token', 400);
        userId = user.id;
      }

      // Kills refresh tokens (DB) AND outstanding access tokens (cutoff).
      await revokeAllUserSessions(userId);
      void recordRiskEvent(userId, 'SECURITY_CHANGE', { change: 'password_reset' }, 'MEDIUM');
      sendSecurityNotice(userId, 'password_reset', { ip: req.ip });

      res.json({ message: 'Password reset successfully. Please log in again.' });
    } catch (error) {
      next(error);
    }
  }

  /* ─── 2FA recovery (locked-out users who lost their authenticator) ───
     Two steps:
       1. request: email a 6-digit code to the account email.
       2. verify:  code + phone + date-of-birth must all match → disable 2FA.
     The extra phone+DOB identity check means an attacker needs the email
     inbox AND knowledge of the user's phone and birthday — not just one.
     Each code gets 5 tries (then it is burned) and at most 3 codes are
     sent per hour, so the 1e6 code space cannot be walked. */
  static async request2FARecovery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email } = z.object({ email: z.string().email().max(254) }).parse(req.body);
      // Always the same answer, sent before any lookup (no enumeration).
      res.json({ message: 'If an account with 2FA exists, a recovery code has been sent.' });
      void issue2FARecovery(normalizeEmail(email))
        .catch((e) => logger.warn('[auth] 2FA recovery issue failed', { err: e }));
    } catch (error) {
      next(error);
    }
  }

  static async verify2FARecovery(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, code, phone, dateOfBirth } = z.object({
        email: z.string().email().max(254),
        code: z.string().regex(/^\d{6}$/),
        phone: z.string().min(3).max(32),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}/), // YYYY-MM-DD
      }).parse(req.body);

      const GENERIC_FAIL = new AppError('Recovery details do not match. Check your code, phone, and date of birth.', 400);

      const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
      if (!user?.twoFactorRecoveryCode || !user.twoFactorRecoveryExpires || user.twoFactorRecoveryExpires <= new Date()) {
        throw GENERIC_FAIL;
      }
      const issued = user.twoFactorRecoveryCode;
      const burn = () => prisma.user.updateMany({
        where: { id: user.id, twoFactorRecoveryCode: issued },
        data: { twoFactorRecoveryCode: null, twoFactorRecoveryExpires: null },
      });

      // Reserved before checking, so parallel guesses count too.
      const triesKey = `auth:2farec:try:${user.id}`;
      const slot = await reserveAttempt(triesKey, RECOVERY_MAX_ATTEMPTS, 30 * 60);
      if (!slot.allowed) {
        await burn();
        throw new AppError('Too many attempts. Request a new recovery code.', 429);
      }

      // Identity gate: phone (digits only; the last 9 digits so the dial code
      // and a national trunk 0 don't matter, at least 7 digits) + DOB.
      const supplied = phone.replace(/\D/g, '');
      const stored = (user.phone ?? '').replace(/\D/g, '');
      const phoneOk = supplied.length >= 7 && stored.length >= 7 && stored.endsWith(supplied.slice(-9));
      const dobOk = !!user.dateOfBirth &&
        new Date(user.dateOfBirth).toISOString().slice(0, 10) === dateOfBirth.slice(0, 10);
      const codeOk = safeEqual(issued, sha256(code));
      if (!codeOk || !phoneOk || !dobOk) {
        if (slot.count >= RECOVERY_MAX_ATTEMPTS) await burn();
        throw GENERIC_FAIL;
      }

      // All checks pass → disable 2FA and consume the code (single use).
      const consumed = await prisma.user.updateMany({
        where: { id: user.id, twoFactorRecoveryCode: issued },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorRecoveryCode: null,
          twoFactorRecoveryExpires: null,
        },
      });
      if (consumed.count !== 1) throw GENERIC_FAIL;
      await clearAttempts(triesKey);
      // Revoke sessions (refresh + live access tokens) so a re-login is
      // required with the (now 2FA-free) account.
      await revokeAllUserSessions(user.id);
      clearAdminCache(user.id);
      void recordRiskEvent(user.id, 'SECURITY_CHANGE', { change: '2fa_recovery' }, 'HIGH');
      sendSecurityNotice(user.id, 'two_factor_recovered', { ip: req.ip });

      res.json({ message: '2FA has been removed. Sign in with your email and password.' });
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
      if (!dbUser.phone) throw new AppError('No phone number on this account', 400);

      // SMS/WhatsApp cost money (SMS pumping) and every new code buys 5 tries.
      const slot = await reserveAttempt(`otp:phone:issue:${user.id}`, PHONE_OTP_SENDS_PER_HOUR, 60 * 60);
      if (!slot.allowed) throw new AppError('Too many codes requested. Try again later.', 429);

      const phone = e164(dbUser.phone, dbUser.phoneCountryCode);
      const result = await startVerification({ phone, channel, userId: user.id });
      if (!result.ok) throw new AppError(result.reason ?? 'Failed to send code', 502);
      await clearAttempts(`otp:phone:fail:${user.id}`);

      res.json({ message: 'Verification code sent', status: result.status, mode: result.mode, simulated: result.reason === 'simulated' });
    } catch (error) {
      next(error);
    }
  }

  static async verifyPhone(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AppError('Authentication required', 401);

      const { code } = z.object({ code: z.string().regex(/^\d{4,8}$/) }).parse(req.body);

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { phone: true, phoneCountryCode: true, phoneVerified: true },
      });
      if (!dbUser) throw new AppError('User not found', 404);
      if (dbUser.phoneVerified) throw new AppError('Phone already verified', 400);

      // 5 wrong codes burns the pending code — a 6-digit code must not be
      // guessable by retrying, whichever provider issued it. The attempt is
      // reserved before the check so parallel guesses count.
      const attemptsKey = `otp:phone:fail:${user.id}`;
      const burn = () => prisma.user.update({ where: { id: user.id }, data: { phoneOtpCode: null, phoneOtpExpires: null } });
      const slot = await reserveAttempt(attemptsKey, PHONE_OTP_MAX_ATTEMPTS, PHONE_OTP_LOCK_SECONDS);
      if (!slot.allowed) {
        await burn();
        throw new AppError('Too many attempts. Request a new code.', 429);
      }

      const phone = e164(dbUser.phone, dbUser.phoneCountryCode);
      const result = await checkVerification({ phone, code, userId: user.id });
      if (!result.valid) {
        if (slot.count >= PHONE_OTP_MAX_ATTEMPTS) {
          await burn();
          throw new AppError('Too many attempts. Request a new code.', 429);
        }
        throw new AppError('Invalid or expired code', 400);
      }
      await clearAttempts(attemptsKey);

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
