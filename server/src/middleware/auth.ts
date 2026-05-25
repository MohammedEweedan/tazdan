import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { AuthRequest } from '../types';
import { prisma } from '../utils/prisma';
import { AppError } from './errorHandler';

// Token lifetimes — kept here so they're discoverable from one place.
// Access tokens are short-lived; clients refresh silently via the refresh
// token. 15min limits damage from a stolen access token.
const ACCESS_TOKEN_TTL  = '2h';
const REFRESH_TOKEN_TTL_DAYS = 7;

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

  try {
    const decoded = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] }) as {
      id: string;
      email: string;
      role: string;
    };
    req.user = decoded;
    next();
  } catch {
    return next(new AppError('Invalid or expired token', 401));
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return next(new AppError('Admin access required', 403));
  }
  next();
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
