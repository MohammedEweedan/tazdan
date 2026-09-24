import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRequest } from '../types';
import { prisma } from '../utils/prisma';
import { AppError } from './errorHandler';
import { getRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

// Token lifetimes — kept here so they're discoverable from one place.
// Access tokens are short-lived; clients refresh silently via the refresh
// token. 15min limits damage from a stolen access token, and is the window
// a banned/demoted user can keep acting if Redis is down (see cutoff below).
const ACCESS_TOKEN_TTL  = '15m';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 7;

// ── Instant session revocation ───────────────────────────────────────
// Redis holds a per-user "tokens issued before T are dead" cutoff. Setting
// it (ban, password reset, 2FA recovery) kills every outstanding access
// token immediately instead of waiting out the TTL. Key TTL only needs to
// outlive the access-token lifetime. Fail-open when Redis is missing: the
// residual exposure is bounded by the 15m token TTL, and a hard dependency
// on Redis for EVERY request would turn a cache blip into a full outage.
const cutoffKey = (userId: string) => `sec:cutoff:${userId}`;

export async function revokeAllUserSessions(userId: string): Promise<void> {
  // Refresh tokens die in the DB (authoritative), access tokens via Redis.
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const client = getRedisClient();
  if (client) {
    await client
      .set(cutoffKey(userId), String(Date.now()), { EX: ACCESS_TOKEN_TTL_SECONDS + 60 })
      .catch((err) => logger.warn('[auth] failed to set session cutoff', { userId, err }));
  }
}

async function isRevokedByCutoff(userId: string, iatSeconds?: number): Promise<boolean> {
  if (!iatSeconds) return false;
  const client = getRedisClient();
  if (!client) return false;
  try {
    const raw = await client.get(cutoffKey(userId));
    if (!raw) return false;
    return iatSeconds * 1000 < Number(raw);
  } catch {
    return false; // fail-open, bounded by the 15m TTL
  }
}

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return s;
}

function jwtRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error('JWT_REFRESH_SECRET is not set');
  return s;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication required', 401));
  }

  let decoded: { id: string; email: string; role: string; iat?: number };
  try {
    decoded = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as typeof decoded;
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }

  // Instant-revocation check (ban / password reset / 2FA recovery).
  isRevokedByCutoff(decoded.id, decoded.iat)
    .then((revoked) => {
      if (revoked) return next(new AppError('Session revoked. Please log in again.', 401));
      req.user = decoded;
      next();
    })
    .catch(() => { req.user = decoded; next(); });
}

/**
 * For public endpoints that show more to signed-in users. A valid token sets
 * `req.user`; a missing, invalid or revoked one leaves the request anonymous
 * instead of failing it.
 */
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return next();

  let decoded: { id: string; email: string; role: string; iat?: number };
  try {
    decoded = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as typeof decoded;
  } catch {
    return next();
  }
  isRevokedByCutoff(decoded.id, decoded.iat)
    .then((revoked) => { if (!revoked) req.user = decoded; next(); })
    .catch(() => next());
}

// ── Admin gate ───────────────────────────────────────────────────────
// The JWT role claim alone is not enough for the admin surface: a demoted
// or suspended admin keeps a valid token until expiry. Re-check the DB
// (with a 60s in-process cache so the admin dashboard's polling doesn't
// add a query per request), require 2FA on the account in production, and
// optionally pin admin access to an IP allowlist (ADMIN_IP_ALLOWLIST,
// comma-separated exact IPs — e.g. an office/VPN egress).
const adminCache = new Map<string, { at: number; ok: boolean; reason?: string }>();
const ADMIN_CACHE_MS = 60 * 1000;

function adminIpAllowed(ip: string | undefined): boolean {
  const raw = process.env.ADMIN_IP_ALLOWLIST?.trim();
  if (!raw) return true; // unset = no IP restriction
  if (!ip) return false;
  return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(ip);
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin access required', 403));
  }
  if (!adminIpAllowed(req.ip)) {
    logger.warn('[auth] admin request from non-allowlisted IP', { userId: req.user.id, ip: req.ip });
    return next(new AppError('Admin access is not permitted from this network', 403));
  }

  const cached = adminCache.get(req.user.id);
  if (cached && Date.now() - cached.at < ADMIN_CACHE_MS) {
    return cached.ok ? next() : next(new AppError(cached.reason ?? 'Admin access required', 403));
  }

  prisma.user
    .findUnique({
      where: { id: req.user.id },
      select: { role: true, status: true, twoFactorEnabled: true },
    })
    .then((u) => {
      let ok = true;
      let reason: string | undefined;
      if (!u || u.role !== 'ADMIN' || u.status !== 'ACTIVE') {
        ok = false; reason = 'Admin access required';
      } else if (
        process.env.NODE_ENV === 'production' &&
        process.env.ADMIN_REQUIRE_2FA !== '0' &&
        !u.twoFactorEnabled
      ) {
        ok = false; reason = 'Enable 2FA on your account to access the admin console';
      }
      adminCache.set(req.user!.id, { at: Date.now(), ok, reason });
      return ok ? next() : next(new AppError(reason!, 403));
    })
    .catch(() => next(new AppError('Internal error', 500)));
}

export function requireAgent(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'AGENT' && req.user.role !== 'ADMIN')) {
    return next(new AppError('Agent access required', 403));
  }
  next();
}

export function requireKYC(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  prisma.user
    .findUnique({ where: { id: req.user.id }, select: { kycStatus: true } })
    .then((user) => {
      if (!user || user.kycStatus !== 'APPROVED') {
        return next(new AppError('KYC verification required', 403));
      }
      next();
    })
    .catch(() => next(new AppError('Internal error', 500)));
}

export function generateTokens(user: { id: string; email: string; role: string }) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtSecret(),
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    jwtRefreshSecret(),
    { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`, algorithm: 'HS256' }
  );

  return { accessToken, refreshToken };
}

// ─── Refresh-token persistence ───────────────────────────────────────
//
// We store SHA-256 hash of the raw refresh token, never the raw value.
// On `/auth/refresh` we hash the incoming token, look it up, and reject
// anything `revokedAt != null` or `expiresAt < now`.
//
// On every successful refresh we ROTATE — the old token is revoked and a new
// one issued. Reusing a revoked token = potential theft → revoke entire chain.

export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function persistRefreshToken(args: {
  userId: string;
  rawToken: string;
  ipAddress?: string;
  userAgent?: string;
  replacedById?: string;
}) {
  return prisma.refreshToken.create({
    data: {
      userId: args.userId,
      tokenHash: hashRefreshToken(args.rawToken),
      ipAddress: args.ipAddress ?? null,
      userAgent: args.userAgent ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
      replacedById: args.replacedById ?? null,
    },
  });
}

export async function revokeRefreshToken(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  return prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Verify a refresh token against the DB. Returns the row if valid, throws
 * AppError otherwise. Reuse of an already-revoked token revokes ALL of the
 * user's active refresh tokens (defense against token theft).
 */
export async function verifyAndConsumeRefreshToken(rawToken: string) {
  let payload: { id: string; jti?: string };
  try {
    payload = jwt.verify(
      rawToken,
      jwtRefreshSecret(),
      { algorithms: ['HS256'] },
    ) as { id: string; jti?: string };
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const tokenHash = hashRefreshToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    // Token was signed with our secret but is unknown — reject.
    throw new AppError('Refresh token not recognised', 401);
  }
  if (stored.userId !== payload.id) {
    throw new AppError('Refresh token user mismatch', 401);
  }
  if (stored.revokedAt) {
    // Reuse of a revoked token → revoke the entire chain for this user.
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Refresh token already used. All sessions revoked.', 401);
  }
  if (stored.expiresAt < new Date()) {
    throw new AppError('Refresh token expired', 401);
  }
  return stored;
}
