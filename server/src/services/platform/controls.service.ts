/**
 * Emergency controls (kill switches).
 *
 * A switch blocks NEW activity in one scope: a whole feature, a corridor, a
 * provider, one customer (entirely or for one feature) or one wallet. Every
 * money path calls `assertMovementAllowed` before it moves funds. Unwinding
 * actions (cancel, refund, release) are deliberately not gated so a switch
 * can never strand customer money.
 *
 * Every change writes a ControlSwitchEvent (append-only) and an AuditLog row
 * with actor, reason, previous and new state.
 */
import type { ControlScope } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { writeAudit } from './audit';
import { recordSecurityEvent } from './securityEvents';

export const CONTROL_FEATURES = [
  'withdrawals', 'deposits', 'p2p', 'fx', 'remittance', 'blockchain', 'cards', 'transfers', 'business_payouts',
] as const;
export type ControlFeature = (typeof CONTROL_FEATURES)[number];

interface CachedSwitch { blocked: boolean; reason: string; expiresAt: Date | null }

let cache: Map<string, CachedSwitch> | null = null;
let cacheAt = 0;
const CACHE_MS = 5_000;

const keyOf = (scope: ControlScope, key: string) => `${scope}:${key}`;

async function loadSwitches(): Promise<Map<string, CachedSwitch>> {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const rows = await prisma.controlSwitch.findMany({ where: { blocked: true } });
  const next = new Map<string, CachedSwitch>();
  for (const r of rows) next.set(keyOf(r.scope, r.key), { blocked: r.blocked, reason: r.reason, expiresAt: r.expiresAt });
  cache = next;
  cacheAt = Date.now();
  return next;
}

export function invalidateControlCache(): void {
  cache = null;
}

async function blockedReason(scope: ControlScope, key: string): Promise<string | null> {
  const sw = (await loadSwitches()).get(keyOf(scope, key));
  if (!sw || !sw.blocked) return null;
  if (sw.expiresAt && sw.expiresAt.getTime() <= Date.now()) return null;
  return sw.reason;
}

export async function isBlocked(scope: ControlScope, key: string): Promise<boolean> {
  return (await blockedReason(scope, key)) !== null;
}

export interface MovementCheck {
  userId?: string | null;
  feature: ControlFeature;
  currency?: string | null;
  corridor?: string | null;
  provider?: string | null;
}

/**
 * Throw if any switch in scope blocks this movement, or if the customer's
 * account is not ACTIVE. The account check closes the window between a
 * suspension and the expiry of an already-issued access token.
 */
export async function assertMovementAllowed(check: MovementCheck): Promise<void> {
  const featureReason = await blockedReason('FEATURE', check.feature);
  if (featureReason) {
    throw new AppError('This service is temporarily paused. Please try again later.', 503, 'FEATURE_DISABLED', {
      control: `FEATURE:${check.feature}`,
    });
  }
  if (check.corridor && (await blockedReason('CORRIDOR', check.corridor))) {
    throw new AppError('Transfers on this corridor are temporarily paused.', 503, 'FEATURE_DISABLED', {
      control: `CORRIDOR:${check.corridor}`,
    });
  }
  if (check.provider && (await blockedReason('PROVIDER', check.provider))) {
    throw new AppError('This payment route is temporarily unavailable.', 503, 'PROVIDER_UNAVAILABLE', {
      control: `PROVIDER:${check.provider}`,
    });
  }
  if (check.userId) {
    const user = await prisma.user.findUnique({ where: { id: check.userId }, select: { status: true } });
    if (!user) throw new AppError('User not found', 404);
    if (user.status !== 'ACTIVE') {
      throw new AppError('Your account is restricted. Please contact support.', 403, 'COMPLIANCE_HOLD');
    }
    if (
      (await blockedReason('USER', check.userId)) ||
      (await blockedReason('USER', `${check.userId}:${check.feature}`))
    ) {
      throw new AppError('This action is restricted on your account. Please contact support.', 403, 'COMPLIANCE_HOLD');
    }
    if (check.currency && (await blockedReason('WALLET', `${check.userId}:${check.currency.toUpperCase()}`))) {
      throw new AppError(`Your ${check.currency.toUpperCase()} wallet is restricted. Please contact support.`, 403, 'COMPLIANCE_HOLD');
    }
  }
}

export interface SetControlInput {
  scope: ControlScope;
  key: string;
  blocked: boolean;
  reason: string;
  actorId: string;
  expiresAt?: Date | null;
  req?: { ip?: string; headers?: Record<string, any> };
}

export async function setControl(input: SetControlInput) {
  if (!input.reason || input.reason.trim().length < 5) {
    throw new AppError('A reason of at least 5 characters is required', 400);
  }
  if (input.scope === 'FEATURE' && !CONTROL_FEATURES.includes(input.key as ControlFeature)) {
    throw new AppError(`Unknown feature "${input.key}"`, 400);
  }
  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.controlSwitch.findUnique({ where: { scope_key: { scope: input.scope, key: input.key } } });
    const row = await tx.controlSwitch.upsert({
      where: { scope_key: { scope: input.scope, key: input.key } },
      create: {
        scope: input.scope, key: input.key, blocked: input.blocked, reason: input.reason.trim(),
        setById: input.actorId, expiresAt: input.expiresAt ?? null,
      },
      update: { blocked: input.blocked, reason: input.reason.trim(), setById: input.actorId, expiresAt: input.expiresAt ?? null },
    });
    await tx.controlSwitchEvent.create({
      data: {
        scope: input.scope, key: input.key, previousBlocked: prev?.blocked ?? null, newBlocked: input.blocked,
        reason: input.reason.trim(), actorId: input.actorId, ipAddress: input.req?.ip ?? null,
      },
    });
    await writeAudit(tx, {
      actorId: input.actorId,
      action: input.blocked ? 'CONTROL_BLOCK' : 'CONTROL_UNBLOCK',
      entity: 'ControlSwitch',
      entityId: row.id,
      before: prev ? { blocked: prev.blocked, reason: prev.reason, expiresAt: prev.expiresAt } : null,
      after: { scope: row.scope, key: row.key, blocked: row.blocked, expiresAt: row.expiresAt },
      reason: input.reason,
      req: input.req,
    });
    return row;
  });
  invalidateControlCache();
  logger.warn('[controls] switch changed', { scope: input.scope, key: input.key, blocked: input.blocked, actor: input.actorId });
  void recordSecurityEvent({
    type: 'CONTROL_CHANGED',
    severity: input.blocked ? 'HIGH' : 'MEDIUM',
    userId: input.actorId,
    ipAddress: input.req?.ip ?? null,
    details: { scope: input.scope, key: input.key, blocked: input.blocked },
  });
  return result;
}

export async function listControls() {
  const [switches, events] = await Promise.all([
    prisma.controlSwitch.findMany({ orderBy: [{ scope: 'asc' }, { key: 'asc' }] }),
    prisma.controlSwitchEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const now = Date.now();
  const features = CONTROL_FEATURES.map((f) => {
    const sw = switches.find((s) => s.scope === 'FEATURE' && s.key === f);
    const active = Boolean(sw?.blocked && (!sw.expiresAt || sw.expiresAt.getTime() > now));
    return { feature: f, blocked: active, reason: active ? sw!.reason : null, setById: sw?.setById ?? null, updatedAt: sw?.updatedAt ?? null, expiresAt: sw?.expiresAt ?? null };
  });
  return { features, switches, events };
}
