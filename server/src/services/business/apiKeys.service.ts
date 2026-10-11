/**
 * Business API keys.
 *
 * The raw key is shown once at creation; only its SHA-256 is stored (the key
 * carries 192 bits of randomness, so a slow hash adds nothing). Keys are
 * scoped (PAYOUTS, BALANCES, RATES, WEBHOOKS, READ_ONLY), can expire, and are
 * revoked rather than deleted so their usage history stays auditable.
 */
import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { assertCan, can, type BusinessContext } from './access';

export const API_SCOPES = ['PAYOUTS', 'BALANCES', 'RATES', 'WEBHOOKS', 'READ_ONLY'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const hashKey = (raw: string) => crypto.createHash('sha256').update(raw).digest('hex');

type KeyRow = { id: string; name: string; prefix: string; last4: string | null; permissions: string[]; isActive: boolean; revokedAt: Date | null; expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date; usageCount?: number };

export function keyStatus(k: KeyRow): 'ACTIVE' | 'REVOKED' | 'EXPIRED' {
  if (k.revokedAt || !k.isActive) return 'REVOKED';
  if (k.expiresAt && k.expiresAt < new Date()) return 'EXPIRED';
  return 'ACTIVE';
}

export function publicKey(k: KeyRow) {
  return {
    id: k.id, name: k.name, prefix: k.prefix, last4: k.last4 ?? '', permissions: k.permissions, status: keyStatus(k),
    expiresAt: k.expiresAt, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt, usageCount: k.usageCount ?? 0,
  };
}

export async function createKey(ctx: BusinessContext, input: { name: string; permissions: string[]; expiresInDays?: number }) {
  assertCan(ctx, 'keys.manage');
  const permissions = [...new Set(input.permissions.map((p) => p.toUpperCase()))];
  if (!permissions.length) throw new AppError('Choose at least one permission', 400);
  const bad = permissions.filter((p) => !API_SCOPES.includes(p as ApiScope));
  if (bad.length) throw new AppError(`Unknown permission(s): ${bad.join(', ')}`, 400);
  if (permissions.includes('READ_ONLY') && permissions.length > 1) throw new AppError('READ_ONLY cannot be combined with write permissions', 400);
  // A key can never do more than its creator may do in the app.
  if (permissions.includes('PAYOUTS') && !can(ctx, 'payouts.create')) throw new AppError('Your role cannot create keys that send payouts', 403, 'AUTHORIZATION');
  const active = await prisma.aPIKey.count({ where: { businessId: ctx.business.id, isActive: true, revokedAt: null } });
  if (active >= 20) throw new AppError('A business can have at most 20 active API keys', 400, 'LIMIT_EXCEEDED');
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  const raw = `tzk_${env}_${crypto.randomBytes(24).toString('base64url')}`;
  const days = input.expiresInDays;
  if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > 730)) throw new AppError('Expiry must be 1–730 days', 400);
  const key = await prisma.aPIKey.create({
    data: {
      userId: ctx.userId, businessId: ctx.business.id, name: input.name.trim().slice(0, 80), keyHash: hashKey(raw),
      prefix: raw.slice(0, 12), last4: raw.slice(-4), permissions, expiresAt: days ? new Date(Date.now() + days * 86400_000) : null,
    },
  });
  await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_API_KEY_CREATED', entity: 'APIKey', entityId: key.id, after: { businessId: ctx.business.id, permissions, expiresAt: key.expiresAt } });
  return { ...publicKey(key), rawKey: raw };
}

export async function listKeys(ctx: BusinessContext) {
  assertCan(ctx, 'read');
  const rows = await prisma.aPIKey.findMany({ where: { businessId: ctx.business.id }, orderBy: { createdAt: 'desc' } });
  return rows.map(publicKey);
}

export async function revokeKey(ctx: BusinessContext, id: string) {
  assertCan(ctx, 'keys.manage');
  const moved = await prisma.aPIKey.updateMany({ where: { id, businessId: ctx.business.id, revokedAt: null }, data: { revokedAt: new Date(), isActive: false } });
  if (moved.count !== 1) {
    const exists = await prisma.aPIKey.count({ where: { id, businessId: ctx.business.id } });
    if (!exists) throw new AppError('API key not found', 404);
    return; // already revoked — idempotent
  }
  await writeAudit(prisma, { actorId: ctx.userId, action: 'BUSINESS_API_KEY_REVOKED', entity: 'APIKey', entityId: id, after: { businessId: ctx.business.id } });
}

/** Resolve a presented raw key. Returns null when it is unknown, revoked or expired. */
export async function authenticateKey(raw: string) {
  if (!/^tzk_(live|test)_[A-Za-z0-9_-]{20,}$/.test(raw)) return null;
  const key = await prisma.aPIKey.findUnique({ where: { keyHash: hashKey(raw) }, include: { business: true } });
  if (!key || !key.business || keyStatus(key) !== 'ACTIVE') return null;
  // A live key never works on a non-production server and vice versa.
  const env = process.env.NODE_ENV === 'production' ? 'live' : 'test';
  if (!raw.startsWith(`tzk_${env}_`)) return null;
  return key;
}

/** Count usage without slowing the request (errors are ignored). */
export function recordUsage(keyId: string) {
  const day = new Date().toISOString().slice(0, 10);
  void Promise.all([
    prisma.apiKeyUsage.upsert({ where: { keyId_day: { keyId, day } }, create: { keyId, day, count: 1 }, update: { count: { increment: 1 } } }),
    prisma.aPIKey.update({ where: { id: keyId }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } }),
  ]).catch(() => undefined);
}
