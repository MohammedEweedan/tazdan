/**
 * Product availability — hide or lock a feature, a currency or a currency
 * pair, for everyone or for chosen customers.
 *
 * Each rule has a state for everyone (AVAILABLE, LOCKED or HIDDEN), an allow
 * list (always AVAILABLE — pilots and testers, optionally every staff member)
 * and a deny list (always the deny state). Deny wins over allow.
 *
 * LOCKED keeps the item on screen but refuses new activity; HIDDEN also takes
 * it out of the apps. The server enforces both: `assertMovementAllowed` checks
 * the currencies, the pair and the feature of every money path, and
 * `assertFeatureAvailable` covers features without one. Read, history and
 * unwinding paths (cancel, refund, release) are never gated, so a rule can
 * never strand money that is already in motion.
 *
 * Rules only narrow access. Environment flags, the launch gate and the kill
 * switches still apply on top: an allow-listed customer gets nothing that
 * those close.
 */
import { Currency, type AvailabilityKind, type AvailabilityState } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { writeAudit } from './audit';
import { recordSecurityEvent } from './securityEvents';

interface FeatureDef { key: string; label: string; group: string; description: string; parent?: string }

export const AVAILABILITY_FEATURES = [
  { key: 'transfers', label: 'Send money', group: 'Payments', description: 'Send to other customers. Also covers Pay, chat payments and claim links.' },
  { key: 'pay', label: 'Pay', group: 'Payments', parent: 'transfers', description: 'The Pay tab: scan a QR code or pay an @username.' },
  { key: 'chat_payments', label: 'Payments in chat', group: 'Payments', parent: 'transfers', description: 'Send money inside a conversation.' },
  { key: 'claim_links', label: 'Claim links', group: 'Payments', parent: 'transfers', description: 'Create and claim money links.' },
  { key: 'business_payouts', label: 'Business payouts', group: 'Payments', description: 'Bulk payouts from business accounts.' },
  { key: 'deposits', label: 'Top up', group: 'Money in and out', description: 'Bank deposits and card top-ups.' },
  { key: 'withdrawals', label: 'Withdraw', group: 'Money in and out', description: 'Bank and crypto withdrawals.' },
  { key: 'remittance', label: 'International transfers', group: 'Money in and out', description: 'Send abroad on remittance corridors.' },
  { key: 'cards', label: 'Cards', group: 'Money in and out', description: 'Card issuing, funding and physical cards.' },
  { key: 'fx', label: 'Convert currencies', group: 'Exchange', description: 'Convert between wallets in the app.' },
  { key: 'crypto_trading', label: 'Buy and sell crypto', group: 'Exchange', description: 'Crypto buy and sell orders.' },
  { key: 'recurring_buys', label: 'Recurring buys', group: 'Exchange', parent: 'crypto_trading', description: 'Scheduled crypto purchases.' },
  { key: 'p2p', label: 'P2P marketplace', group: 'Exchange', description: 'New P2P listings and trades.' },
  { key: 'budgets', label: 'Budget wallets', group: 'Accounts', description: 'Savings goals and automatic contributions.' },
  { key: 'blockchain', label: 'On-chain wallets', group: 'Accounts', description: 'Deposit addresses and on-chain withdrawals.' },
  { key: 'lydt', label: 'LYDT dinar token', group: 'Accounts', description: 'Issue, transfer and redeem LYDT (sandbox).' },
  { key: 'referrals', label: 'Referrals', group: 'Accounts', description: 'Invite rewards and payouts.' },
] as const satisfies readonly FeatureDef[];

export type AvailabilityFeature = (typeof AVAILABILITY_FEATURES)[number]['key'];
const FEATURE_KEYS = new Set<string>(AVAILABILITY_FEATURES.map((f) => f.key));
const PARENT: Record<string, string | undefined> = Object.fromEntries(
  AVAILABILITY_FEATURES.map((f) => [f.key, (f as FeatureDef).parent]),
);

const CRYPTO = new Set(['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX']);
export const AVAILABILITY_CURRENCIES = (Object.values(Currency) as string[]).map((code) => ({
  code,
  type: CRYPTO.has(code) ? ('crypto' as const) : ('fiat' as const),
}));
const CURRENCY_CODES = new Set(AVAILABILITY_CURRENCIES.map((c) => c.code));

/** The availability feature behind each kill-switch feature of a money path. */
const PRODUCT_OF_CONTROL: Record<string, AvailabilityFeature> = {
  transfers: 'transfers', deposits: 'deposits', withdrawals: 'withdrawals', remittance: 'remittance',
  p2p: 'p2p', cards: 'cards', blockchain: 'blockchain', business_payouts: 'business_payouts',
  lydt: 'lydt', fx: 'fx',
};

const RANK: Record<AvailabilityState, number> = { AVAILABLE: 0, LOCKED: 1, HIDDEN: 2 };
const MAX_LISTED = 500;

export interface Resolved { state: AvailabilityState; message: string | null }
const OPEN: Resolved = { state: 'AVAILABLE', message: null };

export interface Viewer { id: string | null; isStaff: boolean }
export const PUBLIC_VIEWER: Viewer = { id: null, isStaff: false };

interface CachedRule {
  state: AvailabilityState;
  allow: Set<string>;
  deny: Set<string>;
  denyState: AvailabilityState;
  includeStaff: boolean;
  message: string | null;
  expiresAt: Date | null;
}

let cache: Map<string, CachedRule> | null = null;
let cacheAt = 0;
const CACHE_MS = 5_000;

const ruleKey = (kind: AvailabilityKind, key: string) => `${kind}:${key}`;

async function loadRules(): Promise<Map<string, CachedRule>> {
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const rows = await prisma.availabilityRule.findMany();
  const next = new Map<string, CachedRule>();
  for (const r of rows) {
    next.set(ruleKey(r.kind, r.key), {
      state: r.state, allow: new Set(r.allowUserIds), deny: new Set(r.denyUserIds), denyState: r.denyState,
      includeStaff: r.includeStaff, message: r.message, expiresAt: r.expiresAt,
    });
  }
  cache = next;
  cacheAt = Date.now();
  return next;
}

export function invalidateAvailabilityCache(): void {
  cache = null;
}

/** What one viewer gets from one rule. */
export function resolveRule(rule: CachedRule | undefined, viewer: Viewer, now = Date.now()): Resolved {
  if (!rule) return OPEN;
  if (rule.expiresAt && rule.expiresAt.getTime() <= now) return OPEN;
  if (viewer.id && rule.deny.has(viewer.id)) return { state: rule.denyState, message: rule.message };
  if (viewer.id && rule.allow.has(viewer.id)) return OPEN;
  if (viewer.isStaff && rule.includeStaff) return OPEN;
  return rule.state === 'AVAILABLE' ? OPEN : { state: rule.state, message: rule.message };
}

const stricter = (a: Resolved, b: Resolved) => (RANK[b.state] > RANK[a.state] ? b : a);

/** A pair matches its rule in either direction. Returns the stored key, if any. */
function pairRuleKey(rules: Map<string, CachedRule>, a: string, b: string): string | null {
  const forward = `${a}/${b}`;
  if (rules.has(ruleKey('PAIR', forward))) return forward;
  const reverse = `${b}/${a}`;
  if (rules.has(ruleKey('PAIR', reverse))) return reverse;
  return null;
}

function featureState(rules: Map<string, CachedRule>, key: string, viewer: Viewer): Resolved {
  let out = resolveRule(rules.get(ruleKey('FEATURE', key)), viewer);
  for (let parent = PARENT[key]; parent; parent = PARENT[parent]) {
    out = stricter(out, resolveRule(rules.get(ruleKey('FEATURE', parent)), viewer));
  }
  return out;
}

export async function viewerFor(userId: string | null | undefined): Promise<Viewer> {
  if (!userId) return PUBLIC_VIEWER;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return { id: userId, isStaff: user?.role === 'ADMIN' };
}

/**
 * Everything one viewer is restricted from. Features are always listed (with
 * their effective state, parents applied); currencies and pairs only when
 * restricted.
 */
export async function availabilityFor(viewer: Viewer) {
  const rules = await loadRules();
  const features: Record<string, Resolved> = {};
  for (const f of AVAILABILITY_FEATURES) features[f.key] = featureState(rules, f.key, viewer);
  const currencies: Record<string, Resolved> = {};
  const pairs: Record<string, Resolved> = {};
  for (const [k, rule] of rules) {
    const [kind, key] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    if (kind === 'FEATURE') continue;
    const r = resolveRule(rule, viewer);
    if (r.state === 'AVAILABLE') continue;
    (kind === 'CURRENCY' ? currencies : pairs)[key] = r;
  }
  return { features, currencies, pairs };
}

export interface AvailabilityCheck {
  viewer: Viewer;
  products?: Array<AvailabilityFeature | null | undefined>;
  currencies?: Array<string | null | undefined>;
  /** Both sides of a conversion or trade. */
  pair?: [string | null | undefined, string | null | undefined];
}

/** Throw if any rule closes this activity for this viewer. */
export async function assertAvailable(check: AvailabilityCheck): Promise<void> {
  const rules = await loadRules();
  if (rules.size === 0) return;
  for (const product of check.products ?? []) {
    if (!product) continue;
    const r = featureState(rules, product, check.viewer);
    if (r.state !== 'AVAILABLE') {
      throw new AppError(r.message || 'This isn\'t available on your account yet.', 403, 'FEATURE_DISABLED', {
        availability: `FEATURE:${product}`, state: r.state,
      });
    }
  }
  for (const raw of check.currencies ?? []) {
    if (!raw) continue;
    const code = raw.toUpperCase();
    const r = resolveRule(rules.get(ruleKey('CURRENCY', code)), check.viewer);
    if (r.state !== 'AVAILABLE') {
      throw new AppError(r.message || `${code} isn't available right now.`, 403, 'FEATURE_DISABLED', {
        availability: `CURRENCY:${code}`, state: r.state,
      });
    }
  }
  const [a, b] = check.pair ?? [];
  if (a && b && a.toUpperCase() !== b.toUpperCase()) {
    const key = pairRuleKey(rules, a.toUpperCase(), b.toUpperCase());
    const r = key ? resolveRule(rules.get(ruleKey('PAIR', key)), check.viewer) : OPEN;
    if (r.state !== 'AVAILABLE') {
      throw new AppError(r.message || `${a.toUpperCase()} to ${b.toUpperCase()} isn't available right now.`, 403, 'FEATURE_DISABLED', {
        availability: `PAIR:${key}`, state: r.state,
      });
    }
  }
}

/** Gate for features without a money path of their own (budgets, Pay lookup…). */
export async function assertFeatureAvailable(userId: string, product: AvailabilityFeature): Promise<void> {
  await assertAvailable({ viewer: await viewerFor(userId), products: [product] });
}

/** Availability products checked for a kill-switch feature (an explicit product replaces the default). */
export function productsForMovement(controlFeature: string, product?: AvailabilityFeature | null): AvailabilityFeature[] {
  const p = product ?? PRODUCT_OF_CONTROL[controlFeature];
  return p ? [p] : [];
}

// ── Admin ────────────────────────────────────────────────────────────

export interface SetAvailabilityInput {
  kind: AvailabilityKind;
  key: string;
  state: AvailabilityState;
  allowUserIds?: string[];
  denyUserIds?: string[];
  denyState?: AvailabilityState;
  includeStaff?: boolean;
  message?: string | null;
  expiresAt?: Date | null;
  reason: string;
  actorId: string;
  req?: { ip?: string; headers?: Record<string, any> };
}

/** Validate and normalise a key. Pairs keep an existing rule's direction. */
async function normaliseKey(kind: AvailabilityKind, raw: string): Promise<string> {
  const key = raw.trim();
  if (kind === 'FEATURE') {
    if (!FEATURE_KEYS.has(key)) throw new AppError(`Unknown feature "${key}"`, 400);
    return key;
  }
  if (kind === 'CURRENCY') {
    const code = key.toUpperCase();
    if (!CURRENCY_CODES.has(code)) throw new AppError(`Unknown currency "${key}"`, 400);
    return code;
  }
  const parts = key.toUpperCase().split('/').map((s) => s.trim());
  if (parts.length !== 2 || !CURRENCY_CODES.has(parts[0]) || !CURRENCY_CODES.has(parts[1])) {
    throw new AppError('A pair is two currency codes, like BTC/LYD', 400);
  }
  if (parts[0] === parts[1]) throw new AppError('A pair needs two different currencies', 400);
  const reverse = `${parts[1]}/${parts[0]}`;
  const existing = await prisma.availabilityRule.findUnique({ where: { kind_key: { kind: 'PAIR', key: reverse } }, select: { id: true } });
  return existing ? reverse : `${parts[0]}/${parts[1]}`;
}

async function checkUsers(ids: string[], label: string): Promise<string[]> {
  const unique = [...new Set(ids.map((s) => s.trim()).filter(Boolean))];
  if (unique.length > MAX_LISTED) throw new AppError(`The ${label} list can hold at most ${MAX_LISTED} customers`, 400);
  if (!unique.length) return unique;
  const found = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) {
    const known = new Set(found.map((u) => u.id));
    throw new AppError(`Unknown customer on the ${label} list: ${unique.filter((id) => !known.has(id)).join(', ')}`, 400);
  }
  return unique;
}

const snapshot = (r: any) => r ? {
  state: r.state, allowUserIds: r.allowUserIds, includeStaff: r.includeStaff, denyUserIds: r.denyUserIds,
  denyState: r.denyState, message: r.message, expiresAt: r.expiresAt,
} : null;

/**
 * Create, change or reset one rule. A rule that leaves everyone with
 * AVAILABLE (default open, no deny list) is removed — the item is back to
 * normal. Takes effect within 5 seconds on every process.
 */
export async function setAvailabilityRule(input: SetAvailabilityInput) {
  const reason = input.reason?.trim() ?? '';
  if (reason.length < 5) throw new AppError('A reason of at least 5 characters is required', 400);
  const denyState = input.denyState ?? 'LOCKED';
  if (denyState === 'AVAILABLE') throw new AppError('Customers on the deny list must get Locked or Hidden', 400);
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) throw new AppError('The end time must be in the future', 400);
  const key = await normaliseKey(input.kind, input.key);
  const allowUserIds = await checkUsers(input.allowUserIds ?? [], 'allow');
  const denyUserIds = await checkUsers(input.denyUserIds ?? [], 'deny');
  const overlap = allowUserIds.filter((id) => denyUserIds.includes(id));
  if (overlap.length) throw new AppError('A customer can\'t be on both the allow and the deny list', 400);
  const message = input.message?.trim() ? input.message.trim().slice(0, 140) : null;
  const reset = input.state === 'AVAILABLE' && denyUserIds.length === 0;
  const entityId = `${input.kind}:${key}`;

  const row = await prisma.$transaction(async (tx) => {
    const prev = await tx.availabilityRule.findUnique({ where: { kind_key: { kind: input.kind, key } } });
    if (reset) {
      if (prev) await tx.availabilityRule.delete({ where: { id: prev.id } });
      await writeAudit(tx, {
        actorId: input.actorId, action: 'AVAILABILITY_RESET', entity: 'AvailabilityRule', entityId,
        before: snapshot(prev), after: { state: 'AVAILABLE' }, reason, req: input.req,
      });
      return null;
    }
    const data = {
      state: input.state, allowUserIds, denyUserIds, denyState, includeStaff: Boolean(input.includeStaff),
      message, expiresAt: input.expiresAt ?? null, reason, setById: input.actorId,
    };
    const saved = await tx.availabilityRule.upsert({
      where: { kind_key: { kind: input.kind, key } },
      create: { kind: input.kind, key, ...data },
      update: data,
    });
    await writeAudit(tx, {
      actorId: input.actorId, action: 'AVAILABILITY_SET', entity: 'AvailabilityRule', entityId,
      before: snapshot(prev), after: snapshot(saved), reason, req: input.req,
    });
    return saved;
  });
  invalidateAvailabilityCache();
  logger.warn('[availability] rule changed', { kind: input.kind, key, state: reset ? 'RESET' : input.state, actor: input.actorId });
  void recordSecurityEvent({
    type: 'CONTROL_CHANGED',
    severity: input.state === 'AVAILABLE' ? 'MEDIUM' : 'HIGH',
    userId: input.actorId,
    ipAddress: input.req?.ip ?? null,
    details: { availability: entityId, state: reset ? 'RESET' : input.state, allow: allowUserIds.length, deny: denyUserIds.length },
  });
  return { key, rule: row };
}

/** Everything the admin screens need: catalog, rules, holders, people and history. */
export async function listAvailability() {
  const [rules, holders, history] = await Promise.all([
    prisma.availabilityRule.findMany({ orderBy: [{ kind: 'asc' }, { key: 'asc' }] }),
    prisma.wallet.groupBy({ by: ['currency'], where: { balance: { gt: 0 } }, _count: { _all: true }, _sum: { balance: true } }),
    prisma.auditLog.findMany({ where: { entity: 'AvailabilityRule' }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  const ids = [...new Set([
    ...rules.flatMap((r) => [...r.allowUserIds, ...r.denyUserIds, r.setById]),
    ...history.map((h) => h.userId).filter(Boolean) as string[],
  ])];
  const people = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, username: true, email: true, role: true } })
    : [];
  const byKey = (kind: AvailabilityKind, key: string) => rules.find((r) => r.kind === kind && r.key === key) ?? null;
  const now = Date.now();
  const expired = (r: { expiresAt: Date | null } | null) => Boolean(r?.expiresAt && r.expiresAt.getTime() <= now);
  return {
    features: AVAILABILITY_FEATURES.map((f) => ({ ...f, rule: byKey('FEATURE', f.key), expired: expired(byKey('FEATURE', f.key)) })),
    currencies: AVAILABILITY_CURRENCIES.map((c) => {
      const h = holders.find((x) => x.currency === c.code);
      return { ...c, rule: byKey('CURRENCY', c.code), expired: expired(byKey('CURRENCY', c.code)), holders: h?._count._all ?? 0, held: h?._sum.balance?.toString() ?? '0' };
    }),
    pairs: rules.filter((r) => r.kind === 'PAIR').map((r) => ({ key: r.key, rule: r, expired: expired(r) })),
    people,
    history: history.map((h) => ({
      id: h.id, at: h.createdAt, actorId: h.userId, action: h.action, item: h.entityId,
      before: h.oldValues, after: h.newValues,
    })),
  };
}
