/**
 * LYD market maker: the two-sided price every LYD quote path uses.
 *
 * The Fulus rate is the reference. Bid and ask sit around it with a pip
 * half-spread, a demand skew in discrete pip steps, and the owner's clamps:
 * the ask never goes below Fulus (+ askFloorOffsetPips), the bid always sits
 * at least minHalfSpreadPips below Fulus, and the upside is capped. The maths
 * is in lydMarketMaker.math.ts; this file holds state, configuration and
 * wiring.
 *
 * Paths: getRate (all X/LYD and LYD/X pairs), conversion.executableUsdPrice
 * (swaps, USDT/LYD at par through USD) and priceEngine (crypto quotes funded
 * or settled in LYD). The public quote shows only the executable price.
 *
 * Flow. Executed LYD trades are read from the database of record (swap and
 * crypto-order Transaction rows; failed orders are skipped) by a poller on
 * the scheduler worker. They go to a Redis sorted set shared by every worker
 * and surviving restarts. The applied skew is a token bucket updated
 * atomically by a Lua script. If Redis is unavailable, a process-local copy
 * takes over and the quote widens by degradedWidenPips.
 *
 * Reference health. If Fulus last confirmed the rate more than refFreshSec
 * ago, the quote widens. Past refMaxAgeSec, LYD quoting stops (503). A
 * missing rate stops quoting too. We never quote off a stale mid.
 *
 * Control. Configuration lives in PlatformSettings `fx_market_maker.LYD` and
 * only counts if bound to an approved maker-checker request (FX_OVERRIDE,
 * payload kind MARKET_MAKER_CONFIG) and its append-only audit record, so the
 * generic settings endpoint cannot bypass approval. Kill switches use the
 * existing controls: PROVIDER `FX_MM:LYD` (all pairs) or `FX_MM:<CCY>/LYD`.
 *
 * Profit. Every fill is on the profitable side of the reference at quote time
 * and is re-checked at execution. Inventory still carries rate risk; this
 * does not hedge it.
 */
import crypto from 'crypto';
import Decimal from 'decimal.js';
import { prisma } from '../../utils/prisma';
import { getRedisClient } from '../../utils/redis';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { writeAudit } from '../platform/audit';
import { FULUS_CURRENCIES, fulusCachedRates, getFulusLydRate } from './fulus.service';
import {
  DEFAULT_MARKET_MAKER_CONFIG, MarketMakerConfigError, advanceSkew, canonicalConfigJson, checkFillAgainstReference,
  fillMarginLyd, mergeMarketMakerConfig, pairDecimals, priceLydPair, referenceTooOld, summarizeFlow, targetSkewPips,
  toPips, validateMarketMakerConfig, widenPips,
  type FlowEvent, type FlowSide, type FlowSummary, type LydSide, type MarketMakerConfig, type PairQuote, type SkewState,
} from './lydMarketMaker.math';

export type { LydSide, FlowSide, MarketMakerConfig } from './lydMarketMaker.math';

// ── Configuration (maker-checker bound) ──────────────────────────────

export const MARKET_MAKER_SETTING_KEY = 'fx_market_maker.LYD';
export const MARKET_MAKER_REQUEST_KIND = 'MARKET_MAKER_CONFIG';
export const MARKET_MAKER_APPLIED_ACTION = 'FX_MM_CONFIG_APPLIED';

export interface LoadedConfig {
  config: MarketMakerConfig;
  source: 'default' | 'approved' | 'rejected';
  approvalId: string | null;
  digest: string;
  problem?: string;
}

export function configDigest(c: MarketMakerConfig): string {
  return crypto.createHash('sha256').update(canonicalConfigJson(c)).digest('hex');
}

const defaults = (): LoadedConfig => {
  const config = { ...DEFAULT_MARKET_MAKER_CONFIG };
  return { config, source: 'default', approvalId: null, digest: configDigest(config) };
};

const CONFIG_TTL_MS = 15_000;
let configCache: { value: LoadedConfig; exp: number } | null = null;
let lastVerified: LoadedConfig | null = null;
let lastRejectedValue = '';

async function loadConfig(): Promise<LoadedConfig> {
  const row = await prisma.platformSettings.findUnique({ where: { key: MARKET_MAKER_SETTING_KEY } });
  if (!row?.value) return defaults();
  try {
    const stored = JSON.parse(row.value) as { config?: unknown; approvalId?: unknown; digest?: unknown };
    const config = validateMarketMakerConfig(stored?.config);
    const digest = configDigest(config);
    if (stored.digest !== digest) throw new Error('digest does not match the stored configuration');
    const approvalId = typeof stored.approvalId === 'string' ? stored.approvalId : '';
    if (!approvalId) throw new Error('no approval reference');
    const [approval, applied] = await Promise.all([
      prisma.approvalRequest.findUnique({
        where: { id: approvalId },
        select: { type: true, status: true, requestedById: true, decidedById: true, payload: true },
      }),
      prisma.auditLog.findFirst({ where: { action: MARKET_MAKER_APPLIED_ACTION, entityId: approvalId }, select: { newValues: true } }),
    ]);
    if (!approval || approval.type !== 'FX_OVERRIDE' || (approval.payload as { kind?: string } | null)?.kind !== MARKET_MAKER_REQUEST_KIND) {
      throw new Error('approval request not found');
    }
    if (!['APPROVED', 'EXECUTED'].includes(approval.status) || !approval.decidedById || approval.decidedById === approval.requestedById) {
      throw new Error('configuration was not approved by a second person');
    }
    if ((applied?.newValues as { digest?: string } | null)?.digest !== digest) throw new Error('no audit record of this configuration being applied');
    const value: LoadedConfig = { config, source: 'approved', approvalId, digest };
    lastVerified = value;
    return value;
  } catch (err) {
    const problem = (err as Error).message;
    if (lastRejectedValue !== row.value) {
      lastRejectedValue = row.value;
      logger.error('[fx-mm] stored market-maker configuration rejected', { problem });
    }
    const fallback = lastVerified ?? defaults();
    return { ...fallback, source: lastVerified ? fallback.source : 'rejected', problem };
  }
}

export async function getMarketMakerConfig(): Promise<LoadedConfig> {
  const now = Date.now();
  if (configCache && configCache.exp > now) return configCache.value;
  let value: LoadedConfig;
  try {
    value = await loadConfig();
  } catch (err) {
    // Database unavailable: keep the last configuration, retry shortly.
    value = configCache?.value ?? lastVerified ?? defaults();
    configCache = { value, exp: now + 5_000 };
    return value;
  }
  configCache = { value, exp: now + CONFIG_TTL_MS };
  return value;
}

export function isMarketMakerRequest(payload: unknown): boolean {
  return Boolean(payload) && (payload as { kind?: unknown }).kind === MARKET_MAKER_REQUEST_KIND;
}

/** Request-time validation: the change applied to today's configuration must be valid. */
export async function validateMarketMakerRequest(payload: { changes?: unknown }): Promise<MarketMakerConfig> {
  const current = await getMarketMakerConfig();
  try {
    return mergeMarketMakerConfig(current.config, payload?.changes);
  } catch (err) {
    if (err instanceof MarketMakerConfigError) throw new AppError(err.message, 400, 'VALIDATION');
    throw err;
  }
}

/**
 * Approval-time execution. The change is merged onto the configuration in
 * force now, so two approved changes to different settings both apply. The
 * setting and its audit record are written in one transaction.
 */
export async function applyMarketMakerRequest(
  payload: { changes?: unknown },
  ctx: { requestId: string; requestedById: string; approvedById: string; reason: string },
): Promise<{ setting: string; digest: string; changes: unknown }> {
  configCache = null;
  const current = await getMarketMakerConfig();
  const next = await validateMarketMakerRequest(payload);
  const digest = configDigest(next);
  const value = JSON.stringify({ v: 1, config: next, approvalId: ctx.requestId, digest });
  await prisma.$transaction(async (tx) => {
    await tx.platformSettings.upsert({
      where: { key: MARKET_MAKER_SETTING_KEY },
      update: { value, updatedBy: ctx.approvedById },
      create: {
        key: MARKET_MAKER_SETTING_KEY, value, updatedBy: ctx.approvedById,
        description: 'LYD market maker (pips). Change only through an approved FX_OVERRIDE request of kind MARKET_MAKER_CONFIG.',
      },
    });
    await writeAudit(tx, {
      actorId: ctx.approvedById, action: MARKET_MAKER_APPLIED_ACTION, entity: 'FxMarketMaker', entityId: ctx.requestId,
      before: { config: current.config, source: current.source, digest: current.digest },
      after: { setting: MARKET_MAKER_SETTING_KEY, digest, config: next, changes: payload.changes, requestedById: ctx.requestedById, approvalId: ctx.requestId },
      reason: ctx.reason,
    });
  });
  invalidateLydMarketMaker();
  logger.warn('[fx-mm] configuration changed', { approvalId: ctx.requestId, digest, changes: payload.changes });
  return { setting: MARKET_MAKER_SETTING_KEY, digest, changes: payload.changes };
}

// ── Kill switches (existing controls, PROVIDER scope) ────────────────

export const HALT_ALL_KEY = 'FX_MM:LYD';
export const haltKeyFor = (currency: string) => `FX_MM:${currency.toUpperCase()}/LYD`;

type ControlsModule = typeof import('../platform/controls.service');
let controls: ControlsModule | null = null;

/** The switch that halts this pair, or null. Lookup failures propagate: quoting fails closed. */
export async function haltedBy(currency: string): Promise<string | null> {
  controls ??= await import('../platform/controls.service');
  for (const key of [HALT_ALL_KEY, haltKeyFor(currency)]) {
    if (await controls.isBlocked('PROVIDER', key)) return key;
  }
  return null;
}

// ── Reference (Fulus) ────────────────────────────────────────────────

interface Reference { rate: Decimal; ageMs: number; source: string }
let lastUsdReference: Decimal | null = null;

async function referenceFor(currency: string): Promise<Reference> {
  let rate: number | null = null;
  try { rate = await getFulusLydRate(currency); } catch { rate = null; }
  if (rate == null || !Number.isFinite(rate) || rate <= 0) {
    throw new AppError(`Fulus rate unavailable for ${currency}/LYD. Pricing is paused until it returns.`, 503, 'PROVIDER_UNAVAILABLE');
  }
  // Age = time since Fulus last confirmed the rate (an unchanged rate is
  // still current; one we could not re-check is not).
  const meta = fulusCachedRates()[currency];
  const ref = { rate: new Decimal(rate), ageMs: meta ? Math.max(0, meta.checkedAgeMs) : 0, source: meta?.source ?? 'fulus' };
  if (currency === 'USD') lastUsdReference = ref.rate;
  return ref;
}

// ── Shared flow state: Redis with a process-local fallback ───────────

const FILLS_KEY = 'fxmm:lyd:fills';
const SKEW_KEY = 'fxmm:lyd:skew';
const MAX_EVENTS = 5_000;

interface RedisLike { sendCommand(args: string[]): Promise<unknown> }
function redis(): RedisLike | null {
  return (getRedisClient() as unknown as RedisLike | null) ?? null;
}
/** Shared state is expected when Redis is configured, and always in production. */
function sharedExpected(): boolean {
  return Boolean(process.env.REDIS_URL?.trim()) || process.env.NODE_ENV === 'production';
}
export type StateMode = 'SHARED' | 'DEGRADED' | 'LOCAL';

const local = {
  events: new Map<string, FlowEvent>(), // fills seen by this process
  unsynced: new Map<string, FlowEvent>(), // recorded while Redis was down
  shared: [] as FlowEvent[], // last snapshot read from Redis
  skew: null as SkewState | null,
};
const seenFills = new Map<string, number>();
let pendingVolumeUsd = 0;

const clean = (s: string) => String(s).replace(/[|\s]/g, '_').slice(0, 120);
function encode(e: FlowEvent): string {
  return [e.id, e.userId, e.usd.toFixed(2), e.marginLyd != null && Number.isFinite(e.marginLyd) ? e.marginLyd.toFixed(3) : ''].join('|');
}
function decode(member: string, score: string): FlowEvent | null {
  const [id, userId, usd, margin] = member.split('|');
  const u = Number(usd); const at = Number(score);
  if (!id || !userId || !Number.isFinite(u) || u === 0 || !Number.isFinite(at)) return null;
  const m = margin ? Number(margin) : NaN;
  return { id, userId, usd: u, at, marginLyd: Number.isFinite(m) ? m : undefined };
}

function trimLocal(now: number, windowMs: number): void {
  for (const [id, e] of local.events) if (e.at < now - windowMs) local.events.delete(id);
  for (const [id, e] of local.unsynced) if (e.at < now - windowMs) local.unsynced.delete(id);
  for (const id of local.events.keys()) { if (local.events.size <= MAX_EVENTS) break; local.events.delete(id); }
  for (const [id, at] of seenFills) if (at < now - windowMs) seenFills.delete(id);
}

async function zadd(r: RedisLike, e: FlowEvent): Promise<boolean> {
  return Number(await r.sendCommand(['ZADD', FILLS_KEY, String(e.at), encode(e)])) === 1;
}
async function trimShared(r: RedisLike, now: number, windowMs: number): Promise<void> {
  await r.sendCommand(['ZREMRANGEBYSCORE', FILLS_KEY, '-inf', `(${now - windowMs}`]);
  await r.sendCommand(['ZREMRANGEBYRANK', FILLS_KEY, '0', String(-(MAX_EVENTS + 1))]);
  await r.sendCommand(['PEXPIRE', FILLS_KEY, String(windowMs + 3_600_000)]);
}
async function flushUnsynced(r: RedisLike): Promise<void> {
  if (!local.unsynced.size) return;
  for (const e of [...local.unsynced.values()]) {
    await zadd(r, e);
    local.unsynced.delete(e.id);
  }
}

async function readEvents(cfg: MarketMakerConfig, now: number): Promise<{ events: FlowEvent[]; mode: StateMode }> {
  const windowMs = cfg.flowWindowSec * 1000;
  const r = redis();
  if (r) {
    try {
      await flushUnsynced(r);
      const raw = await r.sendCommand(['ZRANGEBYSCORE', FILLS_KEY, String(now - windowMs), '+inf', 'WITHSCORES', 'LIMIT', '0', String(MAX_EVENTS)]);
      const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
      const events: FlowEvent[] = [];
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const e = decode(arr[i], arr[i + 1]);
        if (e) events.push(e);
      }
      local.shared = events;
      return { events, mode: 'SHARED' };
    } catch (err) {
      logger.warn('[fx-mm] shared flow state unavailable; using the local copy and widening', { err: (err as Error).message });
    }
  }
  trimLocal(now, windowMs);
  const merged = new Map<string, FlowEvent>();
  for (const e of local.shared) if (e.at >= now - windowMs) merged.set(e.id, e);
  for (const e of local.events.values()) if (!merged.has(e.id)) merged.set(e.id, e);
  return { events: [...merged.values()], mode: sharedExpected() ? 'DEGRADED' : 'LOCAL' };
}

/**
 * Token-bucket advance, atomic in Redis. Mirrors advanceSkew() in the maths
 * module exactly (same clamps, refill, one-minute capacity, whole steps).
 * Replies are strings: Redis would truncate fractional Lua numbers.
 */
export const SKEW_LUA = `
local v = redis.call('HMGET', KEYS[1], 's', 'b', 't')
local target = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local rate = tonumber(ARGV[3])
local step = tonumber(ARGV[4])
local up = tonumber(ARGV[5])
local down = tonumber(ARGV[6])
local s = tonumber(v[1]) or 0
local b = tonumber(v[2]) or rate
local t = tonumber(v[3]) or now
if s > up then s = up end
if s < -down then s = -down end
if now > t then
  b = b + rate * (now - t) / 60000
  t = now
end
if b > rate then b = rate end
if b < 0 then b = 0 end
if target > up then target = up end
if target < -down then target = -down end
local diff = target - s
local allowed = math.floor(b / step + 1e-9) * step
local move = math.abs(diff)
if move > allowed then move = allowed end
if diff < 0 then s = s - move else s = s + move end
b = b - move
redis.call('HSET', KEYS[1], 's', tostring(s), 'b', tostring(b), 't', tostring(t))
redis.call('PEXPIRE', KEYS[1], ARGV[7])
return {tostring(s), tostring(b), tostring(t)}
`;

async function advanceSkewState(target: number, cfg: MarketMakerConfig, now: number, mode: StateMode): Promise<{ state: SkewState; mode: StateMode }> {
  const r = mode === 'SHARED' ? redis() : null;
  if (r) {
    try {
      const out = await r.sendCommand([
        'EVAL', SKEW_LUA, '1', SKEW_KEY, String(target), String(now), String(cfg.maxSkewChangePipsPerMin),
        String(cfg.skewStepPips), String(cfg.maxUpSkewPips), String(cfg.maxDownSkewPips), String(cfg.flowWindowSec * 2000),
      ]);
      const [s, b, t] = (Array.isArray(out) ? out : []).map((x) => Number(String(x)));
      if ([s, b, t].every((n) => Number.isFinite(n))) {
        local.skew = { skewPips: s, budgetPips: b, at: t };
        return { state: local.skew, mode };
      }
      throw new Error('unexpected reply from the skew script');
    } catch (err) {
      logger.warn('[fx-mm] shared skew state unavailable; using the local copy and widening', { err: (err as Error).message });
      mode = sharedExpected() ? 'DEGRADED' : 'LOCAL';
    }
  }
  local.skew = advanceSkew(local.skew, target, cfg, now);
  return { state: local.skew, mode };
}

// ── Market-maker state ───────────────────────────────────────────────

export interface MarketMakerState {
  mode: StateMode;
  flow: FlowSummary;
  targetSkewPips: number;
  skewPips: number;
  budgetPips: number;
  /** Estimated LYD captured against the reference over the flow window. */
  capturedLyd: number;
  at: number;
}

const STATE_TTL_MS = 3_000;
let stateCache: { value: MarketMakerState; exp: number; digest: string } | null = null;
let statePending: Promise<MarketMakerState> | null = null;
let lastState: MarketMakerState | null = null;
let lastConfig: MarketMakerConfig = { ...DEFAULT_MARKET_MAKER_CONFIG };

export async function marketMakerState(loaded?: LoadedConfig): Promise<MarketMakerState> {
  const cfg = loaded ?? (await getMarketMakerConfig());
  if (stateCache && stateCache.exp > Date.now() && stateCache.digest === cfg.digest) return stateCache.value;
  if (statePending) return statePending;
  statePending = (async () => {
    const now = Date.now();
    const { events, mode } = await readEvents(cfg.config, now);
    const flow = summarizeFlow(events, cfg.config, now);
    const target = targetSkewPips(flow, cfg.config);
    const adv = await advanceSkewState(target, cfg.config, now, mode);
    const counted = new Set<string>();
    let captured = 0;
    for (const e of events) {
      if (counted.has(e.id)) continue;
      counted.add(e.id);
      captured += e.marginLyd ?? 0;
    }
    const value: MarketMakerState = {
      mode: adv.mode, flow, targetSkewPips: target, skewPips: adv.state.skewPips, budgetPips: adv.state.budgetPips,
      capturedLyd: Math.round(captured * 1000) / 1000, at: now,
    };
    stateCache = { value, exp: now + STATE_TTL_MS, digest: cfg.digest };
    lastState = value;
    lastConfig = cfg.config;
    return value;
  })();
  try { return await statePending; } finally { statePending = null; }
}

// ── Recording fills ──────────────────────────────────────────────────

export interface LydFill {
  /** Stable id of the executed trade (swap reference, order id) so a fill counts once. */
  fillId: string;
  userId: string;
  /** BUY = the customer bought USD (paid LYD); SELL = sold USD. */
  side: FlowSide;
  /** USD notional, positive. */
  usd: number;
  at?: number;
  marginLyd?: number;
}

/** Record an executed LYD trade. Never throws. Returns true when the fill is new. */
export async function recordLydFill(f: LydFill): Promise<boolean> {
  try {
    if (!f.fillId || !f.userId || !Number.isFinite(f.usd) || f.usd <= 0) return false;
    const now = Date.now();
    const { config } = await getMarketMakerConfig();
    const windowMs = config.flowWindowSec * 1000;
    const e: FlowEvent = {
      id: clean(f.fillId), userId: clean(f.userId), usd: Math.round((f.side === 'BUY' ? f.usd : -f.usd) * 100) / 100,
      at: Number.isFinite(f.at) ? Math.min(f.at as number, now) : now, marginLyd: f.marginLyd,
    };
    if (e.usd === 0 || e.at < now - windowMs) return false;
    let isNew = !local.events.has(e.id) && !seenFills.has(e.id);
    local.events.set(e.id, e);
    const r = redis();
    let stored = false;
    if (r) {
      try {
        await flushUnsynced(r);
        const added = await zadd(r, e);
        await trimShared(r, now, windowMs);
        stored = true;
        isNew = isNew && added;
      } catch (err) {
        logger.warn('[fx-mm] could not store a fill in shared state; kept locally', { err: (err as Error).message });
      }
    }
    if (!stored) local.unsynced.set(e.id, e);
    trimLocal(now, windowMs);
    if (isNew) {
      seenFills.set(e.id, e.at);
      pendingVolumeUsd += Math.abs(e.usd);
    }
    stateCache = null;
    return isNew;
  } catch (err) {
    logger.warn('[fx-mm] recordLydFill failed', { err: (err as Error).message });
    return false;
  }
}

/** History ticks: USD volume of fills recorded since the last tick. */
export function takePendingVolumeUsd(): number { const v = pendingVolumeUsd; pendingVolumeUsd = 0; return v; }
export function restorePendingVolumeUsd(v: number): void { if (Number.isFinite(v) && v > 0) pendingVolumeUsd += v; }

// ── Quotes ───────────────────────────────────────────────────────────

export interface LydMarketQuote {
  currency: string;
  reference: Decimal;
  usdReference: Decimal;
  refAgeMs: number;
  refSource: string;
  bid: Decimal;
  ask: Decimal;
  quote: PairQuote;
  state: MarketMakerState;
  config: LoadedConfig;
  halted: string | null;
  at: number;
}

const MM_CURRENCIES = FULUS_CURRENCIES as readonly string[];

/**
 * The market maker's two-way quote for X/LYD (LYD per 1 X). Throws 503 when
 * the pair is halted, the reference is missing or too old, or a price would
 * break an invariant.
 */
export async function quoteLydMarket(currency: string, opts: { ignoreHalt?: boolean } = {}): Promise<LydMarketQuote> {
  const cur = currency.toUpperCase();
  if (!MM_CURRENCIES.includes(cur)) throw new AppError(`${cur}/LYD is not priced by the market maker`, 400, 'VALIDATION');
  const halted = await haltedBy(cur);
  if (halted && !opts.ignoreHalt) {
    throw new AppError(`${cur}/LYD pricing is paused right now. Please try again later.`, 503, 'FEATURE_DISABLED', { control: `PROVIDER:${halted}` });
  }
  const loaded = await getMarketMakerConfig();
  const cfg = loaded.config;
  const ref = await referenceFor(cur);
  if (referenceTooOld(ref.ageMs, cfg)) {
    throw new AppError(`Fulus rate unavailable for ${cur}/LYD: the last confirmed rate is too old to quote from.`, 503, 'PROVIDER_UNAVAILABLE');
  }
  const isUsd = cur === 'USD';
  const usd = isUsd ? ref : await referenceFor('USD');
  const state = await marketMakerState(loaded);
  const W = widenPips({ refAgeMs: ref.ageMs, held: false, degraded: state.mode === 'DEGRADED' }, cfg);
  let quote: PairQuote;
  try {
    quote = priceLydPair({
      reference: ref.rate, usdReference: usd.rate, isUsd, decimals: pairDecimals(cfg, ref.rate, usd.rate, isUsd),
      skewPips: state.skewPips, widenPips: W, cfg,
    });
  } catch (err) {
    logger.error('[fx-mm] refusing to quote', { currency: cur, reference: ref.rate.toString(), err: (err as Error).message });
    throw new AppError(`${cur}/LYD pricing is unavailable right now. Please try again shortly.`, 503, 'PROVIDER_UNAVAILABLE');
  }
  return {
    currency: cur, reference: ref.rate, usdReference: usd.rate, refAgeMs: ref.ageMs, refSource: ref.source,
    bid: quote.bid, ask: quote.ask, quote, state, config: loaded, halted, at: Date.now(),
  };
}

/** getRate shape for a Fulus pair (X/LYD or LYD/X), from the market maker's quote. */
export async function lydRatePair(base: string, quote: string): Promise<{ buyPrice: string; sellPrice: string; source: string; fetchedAt: Date }> {
  const b = base.toUpperCase(); const q = quote.toUpperCase();
  const mq = await quoteLydMarket(b === 'LYD' ? q : b);
  if (q === 'LYD') {
    // buyPrice: LYD the customer pays per unit (our ask). sellPrice: LYD they receive (our bid).
    return { buyPrice: mq.ask.toFixed(8), sellPrice: mq.bid.toFixed(8), source: 'live:fulus', fetchedAt: new Date(mq.at) };
  }
  // LYD/X. Buying LYD = selling X to us at our bid; selling LYD = buying X at our ask.
  const one = new Decimal(1);
  return {
    buyPrice: one.div(mq.bid).toDecimalPlaces(8, Decimal.ROUND_UP).toFixed(8),
    sellPrice: one.div(mq.ask).toDecimalPlaces(8, Decimal.ROUND_DOWN).toFixed(8),
    source: 'derived:fulus',
    fetchedAt: new Date(mq.at),
  };
}

/**
 * Execution re-check for a locked price: re-verify the invariant against the
 * reference NOW, and refuse (409) if the market moved through the quote.
 * `price` is LYD per 1 unit of `currency`.
 */
export async function assertLydFillWithinMarket(p: { currency: string; side: LydSide; price: Decimal | string | number }): Promise<{ reference: Decimal; marginPerUnit: Decimal }> {
  const cur = p.currency.toUpperCase();
  const price = new Decimal(p.price.toString());
  const halted = await haltedBy(cur);
  if (halted) throw new AppError(`${cur}/LYD pricing is paused right now. Please try again later.`, 503, 'FEATURE_DISABLED', { control: `PROVIDER:${halted}` });
  const { config: cfg } = await getMarketMakerConfig();
  const ref = await referenceFor(cur);
  if (referenceTooOld(ref.ageMs, cfg)) throw new AppError(`Fulus rate unavailable for ${cur}/LYD. Please request a new quote shortly.`, 503, 'PROVIDER_UNAVAILABLE');
  const usd = cur === 'USD' ? ref : await referenceFor('USD');
  const check = checkFillAgainstReference({ side: p.side, price, reference: ref.rate, usdReference: usd.rate, isUsd: cur === 'USD', cfg });
  if (!check.ok) {
    logger.warn('[fx-mm] fill refused: the market moved through the quote', {
      currency: cur, side: p.side, price: price.toString(), reference: ref.rate.toString(), limit: check.limit.toString(),
    });
    throw new AppError('The LYD rate moved since your quote. Please request a new quote.', 409, 'TRANSACTION_CONFLICT');
  }
  return { reference: ref.rate, marginPerUnit: p.side === 'ASK' ? price.minus(ref.rate) : ref.rate.minus(price) };
}

// ── Staff view (never sent to customers) ─────────────────────────────

export async function lydMarketMakerView(currency: string): Promise<Record<string, unknown>> {
  const cur = currency.toUpperCase();
  const loaded = await getMarketMakerConfig();
  let mq: LydMarketQuote | null = null; let error: string | null = null;
  try { mq = await quoteLydMarket(cur, { ignoreHalt: true }); } catch (e) { error = (e as Error).message; }
  const state = mq?.state ?? lastState;
  const q = mq?.quote;
  const pips = (d: Decimal | undefined) => (d && q ? toPips(d, q.unit) : null);
  return {
    pair: `${cur}/LYD`,
    reference: mq?.reference.toString() ?? null,
    referenceAgeSec: mq ? Math.round(mq.refAgeMs / 1000) : null,
    referenceSource: mq?.refSource ?? null,
    bid: mq?.bid.toString() ?? null,
    ask: mq?.ask.toString() ?? null,
    mid: mq ? mq.ask.plus(mq.bid).div(2).toString() : null,
    spreadPips: mq ? pips(mq.ask.minus(mq.bid)) : null,
    askAboveReferencePips: mq ? pips(mq.ask.minus(mq.reference)) : null,
    bidBelowReferencePips: mq ? pips(mq.reference.minus(mq.bid)) : null,
    pipValueLyd: q?.unit.toString() ?? null,
    skewPips: state?.skewPips ?? null,
    targetSkewPips: state?.targetSkewPips ?? null,
    widenPips: q?.widenPips ?? null,
    stateMode: state?.mode ?? null,
    halted: mq?.halted ?? null,
    haltSwitches: { scope: 'PROVIDER', keys: [HALT_ALL_KEY, haltKeyFor(cur)] },
    flow: state?.flow ?? null,
    capturedLydInWindow: state?.capturedLyd ?? null,
    config: loaded.config,
    configSource: loaded.source,
    configApprovalId: loaded.approvalId,
    configProblem: loaded.problem ?? null,
    error,
  };
}

/** Sync snapshot for the legacy order-book accessor (admin LYD panel). */
export function lastMarketMakerSnapshot(): { state: MarketMakerState | null; config: MarketMakerConfig; usdReference: string | null } {
  return { state: lastState, config: lastConfig, usdReference: lastUsdReference?.toString() ?? null };
}

/** Applied skew as a fraction of the USD/LYD reference (history ticks). */
export function lastSkewFraction(): number {
  if (!lastState || !lastUsdReference || lastUsdReference.lte(0)) return 0;
  return new Decimal(lastState.skewPips).mul(lastConfig.pipSize).div(lastUsdReference).toDecimalPlaces(6).toNumber();
}

// ── Fill ingestion from the database of record ───────────────────────

interface TxRow { id: string; userId: string; type: string; amount: unknown; reference: string | null; metadata: unknown; createdAt: Date }

/** A swap's LYD Transaction row → a fill. SELL row = LYD left the customer (they bought foreign currency). */
export function fillFromSwapRow(row: TxRow, usdReference: Decimal | null): LydFill | null {
  const m = row.metadata as { kind?: string; counterparty?: string; rate?: string | number } | null;
  if (m?.kind !== 'swap') return null;
  const side: FlowSide | null = row.type === 'SELL' ? 'BUY' : row.type === 'BUY' ? 'SELL' : null;
  if (!side) return null;
  let lyd: Decimal;
  try { lyd = new Decimal(String(row.amount)).abs(); } catch { return null; }
  if (!lyd.gt(0)) return null;
  const counter = String(m.counterparty ?? '').toUpperCase();
  let rate: Decimal | null = null;
  try { rate = m.rate != null ? new Decimal(String(m.rate)) : null; } catch { rate = null; }
  let usd: Decimal | null = null; let price: Decimal | null = null; // price: LYD per USD
  if ((counter === 'USD' || counter === 'USDT') && rate && rate.gt(0)) {
    if (side === 'BUY') { usd = lyd.mul(rate); price = new Decimal(1).div(rate); } // rate = USD per LYD
    else { usd = lyd.div(rate); price = rate; } // rate = LYD per USD
  } else if (usdReference && usdReference.gt(0)) {
    usd = lyd.div(usdReference);
  }
  if (!usd || !usd.gt(0)) return null;
  const marginLyd = price && usdReference ? fillMarginLyd(side === 'BUY' ? 'ASK' : 'BID', price, usdReference, usd).toNumber() : undefined;
  return { fillId: `swap:${row.reference ?? row.id}`, userId: row.userId, side, usd: usd.toDecimalPlaces(2).toNumber(), at: row.createdAt.getTime(), marginLyd };
}

/** A crypto order settled in LYD → a fill, only once the order has EXECUTED. */
export function fillFromCryptoRow(row: TxRow, orderStatus: string | undefined, usdReference: Decimal | null): LydFill | null {
  const m = row.metadata as { kind?: string; settlementCurrency?: string; orderId?: string; fiatAmount?: string; settlementAmount?: string } | null;
  if (m?.kind !== 'crypto_order' || String(m.settlementCurrency ?? '').toUpperCase() !== 'LYD' || orderStatus !== 'EXECUTED') return null;
  const side: FlowSide | null = row.type === 'BUY' ? 'BUY' : row.type === 'SELL' ? 'SELL' : null;
  if (!side) return null;
  let usd: Decimal; let lyd: Decimal;
  try { usd = new Decimal(String(m.fiatAmount ?? 0)); lyd = new Decimal(String(m.settlementAmount ?? 0)); } catch { return null; }
  if (!usd.gt(0)) return null;
  const price = lyd.gt(0) ? lyd.div(usd) : null;
  const marginLyd = price && usdReference ? fillMarginLyd(side === 'BUY' ? 'ASK' : 'BID', price, usdReference, usd).toNumber() : undefined;
  return { fillId: `crypto:${m.orderId ?? row.id}`, userId: row.userId, side, usd: usd.toDecimalPlaces(2).toNumber(), at: row.createdAt.getTime(), marginLyd };
}

const INGEST_INTERVAL_MS = Number(process.env.LYD_MM_INGEST_INTERVAL_MS ?? 20_000);
const INGEST_LOOKBACK_MS = 15 * 60_000;
let ingestStarted = false;
let ingesting: Promise<number> | null = null;
let ingestSoon: NodeJS.Timeout | null = null;

/** Read recent committed LYD trades and record the new ones. Idempotent. */
export async function ingestLydFills(now = Date.now()): Promise<number> {
  if (ingesting) return ingesting;
  ingesting = (async () => {
    const since = new Date(now - INGEST_LOOKBACK_MS);
    const select = { id: true, userId: true, type: true, amount: true, reference: true, metadata: true, createdAt: true } as const;
    const [swaps, cryptos] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: since }, currency: 'LYD', metadata: { path: ['kind'], equals: 'swap' } },
        select, orderBy: { createdAt: 'asc' }, take: 2_000,
      }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: since }, AND: [{ metadata: { path: ['kind'], equals: 'crypto_order' } }, { metadata: { path: ['settlementCurrency'], equals: 'LYD' } }] },
        select, orderBy: { createdAt: 'asc' }, take: 2_000,
      }),
    ]);
    const orderIdOf = (r: TxRow) => (r.metadata as { orderId?: unknown } | null)?.orderId;
    const ids = cryptos.map((r) => orderIdOf(r as TxRow)).filter((v): v is string => typeof v === 'string' && !seenFills.has(clean(`crypto:${v}`)));
    const statuses = ids.length
      ? await prisma.cryptoOrder.findMany({ where: { id: { in: ids } }, select: { id: true, status: true } })
      : [];
    const statusOf = new Map(statuses.map((s) => [s.id, String(s.status)]));
    let usdRef: Decimal | null = null;
    try { usdRef = (await referenceFor('USD')).rate; } catch { usdRef = null; }
    let added = 0;
    for (const row of swaps as TxRow[]) {
      if (seenFills.has(clean(`swap:${row.reference ?? row.id}`))) continue;
      const f = fillFromSwapRow(row, usdRef);
      if (f && (await recordLydFill(f))) added += 1;
    }
    for (const row of cryptos as TxRow[]) {
      const orderId = orderIdOf(row);
      if (typeof orderId !== 'string' || seenFills.has(clean(`crypto:${orderId}`))) continue;
      const f = fillFromCryptoRow(row, statusOf.get(orderId), usdRef);
      if (f && (await recordLydFill(f))) added += 1;
    }
    return added;
  })().catch((err) => {
    logger.warn('[fx-mm] fill ingestion failed', { err: (err as Error).message });
    return 0;
  });
  try { return await ingesting; } finally { ingesting = null; }
}

/** Start ingestion on this process (the scheduler worker calls it via startLydSampler). */
export function startLydFillIngestion(): void {
  if (ingestStarted) return;
  ingestStarted = true;
  setInterval(() => { void ingestLydFills(); }, INGEST_INTERVAL_MS).unref?.();
  setTimeout(() => { void ingestLydFills(); }, 2_000).unref?.();
}

/** A fill just committed in this process: ingest soon instead of waiting for the next poll. */
export function requestLydFillIngest(): void {
  if (!ingestStarted || ingestSoon) return;
  ingestSoon = setTimeout(() => { ingestSoon = null; void ingestLydFills(); }, 1_000);
  ingestSoon.unref?.();
}

// ── Cache control ────────────────────────────────────────────────────

export function invalidateLydMarketMaker(): void {
  configCache = null;
  stateCache = null;
}

export function __resetLydMarketMakerForTests(): void {
  configCache = null; lastVerified = null; lastRejectedValue = '';
  stateCache = null; statePending = null; lastState = null; lastConfig = { ...DEFAULT_MARKET_MAKER_CONFIG };
  local.events.clear(); local.unsynced.clear(); local.shared = []; local.skew = null;
  seenFills.clear(); pendingVolumeUsd = 0; lastUsdReference = null; controls = null;
}
