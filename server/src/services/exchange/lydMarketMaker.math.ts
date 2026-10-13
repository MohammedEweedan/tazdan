/**
 * LYD market maker: the pure pricing maths, with no I/O. State, Redis,
 * configuration and wiring live in lydMarketMaker.service.ts.
 *
 * Units. The pair is USD/LYD (LYD per 1 USD). One PIP is `pipSize` LYD,
 * 0.0001 by default, and USD/LYD is quoted to `quoteDecimals` (4). The
 * parallel rate sits near 10 LYD, so one pip is about 0.001% of the price.
 * That is fine enough to step the skew smoothly and coarse enough to read.
 * Every spread and skew setting is a whole number of pips.
 *
 * Quote, for reference R (the Fulus rate), skew σ and widening W:
 *   h      = baseHalfSpreadPips + W
 *   ask    = R + (h + σ) pips   what we charge when we SELL USD
 *   bid    = R − (h − σ) pips   what we pay when we BUY USD
 * then the clamps (the owner's rules):
 *   ask ≥ R + (askFloorOffsetPips + W) pips   floor: seller pressure moves the
 *                                             price down at most to Fulus
 *   ask ≤ R + (h + maxUpSkewPips) pips        capped upside
 *   bid ≤ R − (minHalfSpreadPips + W) pips    buying USD always earns
 * The ask is rounded up and the bid down, so rounding always favours us.
 *
 * Skew σ comes from customer flow. Executed LYD trades (USD notional) feed
 * an imbalance I in [−1, 1]:
 *   per customer: FIFO-match opposite trades (a round trip counts for
 *                 nothing), decay what is left (half-life), then cap it at
 *                 perUserCapUsd
 *   N = Σ capped nets, G = Σ |capped nets|, I = N / max(G, depthUsd)
 *   target = sign(I) × round(|I| × maxSkew / step) × step
 * maxSkew is maxUpSkewPips when customers net-buy USD (prices step up) and
 * maxDownSkewPips when they net-sell USD (prices step down). Below
 * minVolumeUsd or minTraders the target is 0. A token bucket then moves the
 * applied skew toward the target by at most maxSkewChangePipsPerMin.
 *
 * Other X/LYD pairs (EUR, GBP, …) take the same pip offsets as fractions of
 * the USD/LYD reference, applied to X's own Fulus rate:
 *   unit_X = pipSize × R_X / R_USD
 * Each currency's floor therefore stays its own Fulus rate.
 */
import Decimal from 'decimal.js';

Decimal.set({ precision: 40 });

/** ASK = we sell the foreign currency (the customer buys it). BID = we buy it. */
export type LydSide = 'ASK' | 'BID';
/** The customer's side against the foreign currency: BUY = pays LYD for USD. */
export type FlowSide = 'BUY' | 'SELL';

export interface MarketMakerConfig {
  /** LYD per pip on USD/LYD. */
  pipSize: string;
  /** Decimal places USD/LYD is quoted to. */
  quoteDecimals: number;
  baseHalfSpreadPips: number;
  minHalfSpreadPips: number;
  /** The ask never goes below Fulus + this many pips. The owner's default is 0. */
  askFloorOffsetPips: number;
  maxUpSkewPips: number;
  /** At most baseHalfSpreadPips − askFloorOffsetPips, so full seller pressure puts the ask exactly on the floor. */
  maxDownSkewPips: number;
  skewStepPips: number;
  maxSkewChangePipsPerMin: number;
  flowHalfLifeSec: number;
  flowWindowSec: number;
  /** Decayed gross flow (USD) at which the imbalance becomes a pure ratio. */
  depthUsd: number;
  minVolumeUsd: number;
  /** Distinct customers with directional flow, so one customer splitting orders cannot unlock skew. */
  minTraders: number;
  perUserCapUsd: number;
  /** Reference older than this (since Fulus last confirmed it) widens the quote. */
  refFreshSec: number;
  /** Reference older than this stops quoting. */
  refMaxAgeSec: number;
  staleWidenPips: number;
  /** Added while shared state (Redis) is unavailable and a process-local copy is used. */
  degradedWidenPips: number;
  /** Added while a jump guard holds the reference (non-Fulus sources only). */
  heldWidenPips: number;
}

/**
 * Defaults. A 500-pip half-spread (0.05 LYD, about 0.51% at 9.8) matches the
 * 1% two-way `fx_spread_pct` default it replaces, so neutral flow earns what
 * LYD pairs earned before.
 */
export const DEFAULT_MARKET_MAKER_CONFIG: Readonly<MarketMakerConfig> = Object.freeze({
  pipSize: '0.0001',
  quoteDecimals: 4,
  baseHalfSpreadPips: 500,
  minHalfSpreadPips: 100,
  askFloorOffsetPips: 0,
  maxUpSkewPips: 300,
  maxDownSkewPips: 500,
  skewStepPips: 25,
  maxSkewChangePipsPerMin: 50,
  flowHalfLifeSec: 3600,
  flowWindowSec: 6 * 3600,
  depthUsd: 50_000,
  minVolumeUsd: 5_000,
  minTraders: 3,
  perUserCapUsd: 5_000,
  refFreshSec: 15 * 60,
  refMaxAgeSec: 60 * 60,
  staleWidenPips: 200,
  degradedWidenPips: 200,
  heldWidenPips: 300,
});

export const MARKET_MAKER_CONFIG_KEYS = Object.keys(DEFAULT_MARKET_MAKER_CONFIG) as Array<keyof MarketMakerConfig>;

export class MarketMakerConfigError extends Error {}

const ALLOWED_PIPS = ['0.01', '0.001', '0.0001', '0.00001', '0.000001'];

function intIn(name: string, v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new MarketMakerConfigError(`${name} must be a whole number between ${min} and ${max}`);
  }
  return v;
}

/** Validate a complete configuration. Bounds are server-side and cross-checked. */
export function validateMarketMakerConfig(input: unknown): MarketMakerConfig {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MarketMakerConfigError('Configuration must be an object');
  const src = input as Record<string, unknown>;
  const unknown = Object.keys(src).filter((k) => !(MARKET_MAKER_CONFIG_KEYS as string[]).includes(k));
  if (unknown.length) throw new MarketMakerConfigError(`Unknown setting(s): ${unknown.join(', ')}`);
  const missing = MARKET_MAKER_CONFIG_KEYS.filter((k) => src[k] === undefined);
  if (missing.length) throw new MarketMakerConfigError(`Missing setting(s): ${missing.join(', ')}`);

  let pip: Decimal;
  try { pip = new Decimal(String(src.pipSize)); } catch { throw new MarketMakerConfigError('pipSize must be a decimal string'); }
  const pipSize = ALLOWED_PIPS.find((p) => new Decimal(p).eq(pip));
  if (!pipSize) throw new MarketMakerConfigError(`pipSize must be one of ${ALLOWED_PIPS.join(', ')}`);
  const pipDecimals = pip.decimalPlaces();
  // Any half-spread, skew or widening is limited to 0.5 LYD (about 5% of the price).
  const maxPips = new Decimal('0.5').div(pip).toNumber();

  const c: MarketMakerConfig = {
    pipSize,
    quoteDecimals: intIn('quoteDecimals', src.quoteDecimals, pipDecimals, 8),
    baseHalfSpreadPips: intIn('baseHalfSpreadPips', src.baseHalfSpreadPips, 1, maxPips),
    minHalfSpreadPips: intIn('minHalfSpreadPips', src.minHalfSpreadPips, 1, maxPips),
    askFloorOffsetPips: intIn('askFloorOffsetPips', src.askFloorOffsetPips, 0, maxPips),
    maxUpSkewPips: intIn('maxUpSkewPips', src.maxUpSkewPips, 0, maxPips),
    maxDownSkewPips: intIn('maxDownSkewPips', src.maxDownSkewPips, 0, maxPips),
    skewStepPips: intIn('skewStepPips', src.skewStepPips, 1, maxPips),
    maxSkewChangePipsPerMin: intIn('maxSkewChangePipsPerMin', src.maxSkewChangePipsPerMin, 1, maxPips),
    flowHalfLifeSec: intIn('flowHalfLifeSec', src.flowHalfLifeSec, 60, 86_400),
    flowWindowSec: intIn('flowWindowSec', src.flowWindowSec, 60, 7 * 86_400),
    depthUsd: intIn('depthUsd', src.depthUsd, 1_000, 10_000_000),
    minVolumeUsd: intIn('minVolumeUsd', src.minVolumeUsd, 0, 10_000_000),
    minTraders: intIn('minTraders', src.minTraders, 1, 1_000),
    perUserCapUsd: intIn('perUserCapUsd', src.perUserCapUsd, 1, 10_000_000),
    refFreshSec: intIn('refFreshSec', src.refFreshSec, 30, 3_600),
    refMaxAgeSec: intIn('refMaxAgeSec', src.refMaxAgeSec, 30, 86_400),
    staleWidenPips: intIn('staleWidenPips', src.staleWidenPips, 0, maxPips),
    degradedWidenPips: intIn('degradedWidenPips', src.degradedWidenPips, 0, maxPips),
    heldWidenPips: intIn('heldWidenPips', src.heldWidenPips, 0, maxPips),
  };

  const rule = (ok: boolean, msg: string) => { if (!ok) throw new MarketMakerConfigError(msg); };
  rule(c.minHalfSpreadPips <= c.baseHalfSpreadPips, 'minHalfSpreadPips cannot exceed baseHalfSpreadPips');
  rule(c.askFloorOffsetPips <= c.baseHalfSpreadPips, 'askFloorOffsetPips cannot exceed baseHalfSpreadPips');
  rule(c.maxDownSkewPips <= c.baseHalfSpreadPips - c.askFloorOffsetPips,
    'maxDownSkewPips cannot exceed baseHalfSpreadPips − askFloorOffsetPips (seller pressure may take the ask down to the Fulus floor, never through it)');
  rule(c.maxUpSkewPips % c.skewStepPips === 0 && c.maxDownSkewPips % c.skewStepPips === 0,
    'maxUpSkewPips and maxDownSkewPips must be multiples of skewStepPips');
  rule(c.maxSkewChangePipsPerMin >= c.skewStepPips, 'maxSkewChangePipsPerMin must be at least one skew step');
  rule(c.flowWindowSec >= c.flowHalfLifeSec, 'flowWindowSec must be at least flowHalfLifeSec');
  rule(c.minVolumeUsd <= c.depthUsd, 'minVolumeUsd cannot exceed depthUsd');
  rule(c.perUserCapUsd <= c.depthUsd, 'perUserCapUsd cannot exceed depthUsd');
  rule(c.refMaxAgeSec >= c.refFreshSec, 'refMaxAgeSec must be at least refFreshSec');
  return c;
}

/** Apply a partial change to a configuration and validate the result. */
export function mergeMarketMakerConfig(base: MarketMakerConfig, changes: unknown): MarketMakerConfig {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new MarketMakerConfigError('changes must be an object');
  const keys = Object.keys(changes as object);
  if (!keys.length) throw new MarketMakerConfigError('No changes given');
  return validateMarketMakerConfig({ ...base, ...(changes as object) });
}

/** Canonical JSON (sorted keys), the input to configuration digests. */
export function canonicalConfigJson(c: MarketMakerConfig): string {
  const sorted: Record<string, unknown> = {};
  for (const k of [...MARKET_MAKER_CONFIG_KEYS].sort()) sorted[k] = c[k];
  return JSON.stringify(sorted);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── Pips ──────────────────────────────────────────────────────────────

/** LYD value of one pip on this pair: pipSize on USD/LYD, scaled for other currencies. */
export function pipUnit(cfg: MarketMakerConfig, reference: Decimal, usdReference: Decimal, isUsd: boolean): Decimal {
  const pip = new Decimal(cfg.pipSize);
  return isUsd ? pip : pip.mul(reference).div(usdReference);
}

/** Quote precision: USD/LYD uses quoteDecimals, and cheaper currencies get extra places so one pip stays representable. */
export function pairDecimals(cfg: MarketMakerConfig, reference: Decimal, usdReference: Decimal, isUsd: boolean): number {
  if (isUsd) return cfg.quoteDecimals;
  const ratio = usdReference.div(reference).toNumber();
  const extra = ratio > 1 ? Math.ceil(Math.log10(ratio) - 1e-12) : 0;
  return Math.min(8, cfg.quoteDecimals + extra);
}

/** Price distance → pips on USD/LYD (for display). */
export function toPips(diff: Decimal, unit: Decimal): number {
  return diff.div(unit).toDecimalPlaces(2).toNumber();
}

// ── Flow → imbalance → target skew ───────────────────────────────────

/** One executed LYD trade. `usd` is signed: + the customer bought USD (paid LYD), − sold USD. */
export interface FlowEvent { id: string; userId: string; usd: number; at: number; marginLyd?: number }

export interface FlowSummary {
  netUsd: number;
  grossUsd: number;
  traders: number;
  imbalance: number;
  gated: boolean;
  events: number;
  /** Volume removed as customers' own round trips. */
  roundTripUsd: number;
}

export function summarizeFlow(events: FlowEvent[], cfg: MarketMakerConfig, now: number): FlowSummary {
  const halfLifeMs = cfg.flowHalfLifeSec * 1000;
  const from = now - cfg.flowWindowSec * 1000;
  const live = events
    .filter((e) => Number.isFinite(e.usd) && e.usd !== 0 && Number.isFinite(e.at) && e.at >= from && e.at <= now + 60_000)
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const seen = new Set<string>();
  const byUser = new Map<string, FlowEvent[]>();
  for (const e of live) {
    if (seen.has(e.id)) continue; // the same fill recorded twice counts once
    seen.add(e.id);
    const list = byUser.get(e.userId) ?? [];
    list.push(e);
    byUser.set(e.userId, list);
  }

  let net = 0; let gross = 0; let traders = 0; let roundTrip = 0;
  for (const list of byUser.values()) {
    // FIFO: a sale closes the customer's earliest open purchases first (and
    // vice versa). What is left is their directional flow, kept with its own
    // timestamps so it decays from when it happened.
    const lots: Array<{ usd: number; at: number }> = [];
    for (const e of list) {
      let rem = e.usd;
      while (rem !== 0 && lots.length && Math.sign(lots[0].usd) !== Math.sign(rem)) {
        const m = Math.min(Math.abs(lots[0].usd), Math.abs(rem));
        lots[0].usd -= Math.sign(lots[0].usd) * m;
        rem -= Math.sign(rem) * m;
        roundTrip += m;
        if (Math.abs(lots[0].usd) < 1e-9) lots.shift();
        if (Math.abs(rem) < 1e-9) rem = 0;
      }
      if (rem !== 0) lots.push({ usd: rem, at: e.at });
    }
    let userNet = 0;
    for (const l of lots) userNet += l.usd * Math.pow(0.5, Math.max(0, now - l.at) / halfLifeMs);
    const capped = clamp(userNet, -cfg.perUserCapUsd, cfg.perUserCapUsd);
    if (Math.abs(capped) >= 0.01) {
      traders += 1;
      net += capped;
      gross += Math.abs(capped);
    }
  }
  const imbalance = gross > 0 ? clamp(net / Math.max(gross, cfg.depthUsd), -1, 1) : 0;
  return {
    netUsd: Math.round(net * 100) / 100,
    grossUsd: Math.round(gross * 100) / 100,
    traders,
    imbalance,
    gated: gross < cfg.minVolumeUsd || traders < cfg.minTraders,
    events: seen.size,
    roundTripUsd: Math.round(roundTrip * 100) / 100,
  };
}

/** Target skew in whole steps: positive (prices up) when customers net-buy USD. */
export function targetSkewPips(flow: Pick<FlowSummary, 'imbalance' | 'gated'>, cfg: MarketMakerConfig): number {
  if (flow.gated || !Number.isFinite(flow.imbalance) || flow.imbalance === 0) return 0;
  const up = flow.imbalance > 0;
  const max = up ? cfg.maxUpSkewPips : cfg.maxDownSkewPips;
  const steps = Math.round((Math.abs(flow.imbalance) * max) / cfg.skewStepPips);
  const pips = Math.min(steps * cfg.skewStepPips, max);
  if (pips === 0) return 0;
  return up ? pips : -pips;
}

// ── Rate of change: token bucket ─────────────────────────────────────

/** The applied skew and its movement budget. Shared through Redis (see the Lua twin in the service). */
export interface SkewState { skewPips: number; budgetPips: number; at: number }

/**
 * Move the applied skew toward the target. The bucket refills at
 * maxSkewChangePipsPerMin and holds at most one minute's worth, so a quiet
 * period cannot be saved up for a jump. Moves are whole steps, except the
 * final move onto the target.
 */
export function advanceSkew(state: SkewState | null, target: number, cfg: MarketMakerConfig, now: number): SkewState {
  const rate = cfg.maxSkewChangePipsPerMin;
  const step = cfg.skewStepPips;
  let skew = clamp(state?.skewPips ?? 0, -cfg.maxDownSkewPips, cfg.maxUpSkewPips);
  let budget = state?.budgetPips ?? rate;
  let at = state?.at ?? now;
  if (now > at) {
    budget += (rate * (now - at)) / 60_000;
    at = now;
  }
  budget = Math.min(rate, Math.max(0, budget));
  const goal = clamp(target, -cfg.maxDownSkewPips, cfg.maxUpSkewPips);
  const diff = goal - skew;
  const allowed = Math.floor(budget / step + 1e-9) * step;
  const move = Math.min(Math.abs(diff), allowed);
  skew += diff < 0 ? -move : move;
  budget -= move;
  return { skewPips: skew, budgetPips: budget, at };
}

// ── Widening ─────────────────────────────────────────────────────────

export interface ReferenceHealth { refAgeMs: number; held: boolean; degraded: boolean }

export function widenPips(h: ReferenceHealth, cfg: MarketMakerConfig): number {
  let w = 0;
  if (h.refAgeMs > cfg.refFreshSec * 1000) w += cfg.staleWidenPips;
  if (h.held) w += cfg.heldWidenPips;
  if (h.degraded) w += cfg.degradedWidenPips;
  return w;
}

export function referenceTooOld(refAgeMs: number, cfg: MarketMakerConfig): boolean {
  return refAgeMs > cfg.refMaxAgeSec * 1000;
}

// ── The quote ────────────────────────────────────────────────────────

export interface PriceInput {
  /** LYD per 1 unit of the currency (Fulus). */
  reference: Decimal;
  /** USD/LYD reference: converts pips into fractions for other currencies. */
  usdReference: Decimal;
  isUsd: boolean;
  decimals: number;
  skewPips: number;
  widenPips: number;
  cfg: MarketMakerConfig;
}

export interface PairQuote {
  reference: Decimal;
  bid: Decimal;
  ask: Decimal;
  askFloor: Decimal;
  askCap: Decimal;
  bidCap: Decimal;
  unit: Decimal;
  halfSpreadPips: number;
  skewPips: number;
  widenPips: number;
  decimals: number;
}

export class QuoteInvariantError extends Error {}

/** Every check that must hold before any price is published or filled. */
export function quoteInvariantViolations(q: { reference: Decimal; bid: Decimal; ask: Decimal }, cfg: MarketMakerConfig, unit: Decimal): string[] {
  const out: string[] = [];
  if (q.ask.lt(q.reference.plus(unit.mul(cfg.askFloorOffsetPips)))) out.push('ask is below the Fulus floor');
  if (q.bid.gt(q.reference.minus(unit.mul(cfg.minHalfSpreadPips)))) out.push('bid is less than minHalfSpread below the reference');
  if (!q.bid.gt(0)) out.push('bid is not positive');
  if (!q.ask.gt(q.bid)) out.push('quote is crossed');
  return out;
}

export function priceLydPair(p: PriceInput): PairQuote {
  const { cfg } = p;
  if (!p.reference.isFinite() || !p.reference.gt(0) || !p.usdReference.isFinite() || !p.usdReference.gt(0)) {
    throw new QuoteInvariantError('Reference rate must be a positive number');
  }
  const R = p.reference;
  const unit = pipUnit(cfg, R, p.usdReference, p.isUsd);
  const W = Math.max(0, Math.round(p.widenPips));
  // State written under an older configuration is pulled into today's range.
  const sigma = clamp(Math.round(p.skewPips), -cfg.maxDownSkewPips, cfg.maxUpSkewPips);
  const h = cfg.baseHalfSpreadPips + W;

  const askFloor = R.plus(unit.mul(cfg.askFloorOffsetPips + W));
  const askCap = R.plus(unit.mul(h + cfg.maxUpSkewPips));
  const bidCap = R.minus(unit.mul(cfg.minHalfSpreadPips + W));

  const rawAsk = R.plus(unit.mul(h + sigma));
  const rawBid = R.minus(unit.mul(h - sigma));
  const ask = Decimal.min(Decimal.max(rawAsk, askFloor), askCap).toDecimalPlaces(p.decimals, Decimal.ROUND_UP);
  const bid = Decimal.min(rawBid, bidCap).toDecimalPlaces(p.decimals, Decimal.ROUND_DOWN);

  const violations = quoteInvariantViolations({ reference: R, bid, ask }, cfg, unit);
  if (violations.length) throw new QuoteInvariantError(`Refusing to quote: ${violations.join('; ')}`);
  return { reference: R, bid, ask, askFloor, askCap, bidCap, unit, halfSpreadPips: h, skewPips: sigma, widenPips: W, decimals: p.decimals };
}

// ── Execution re-check and margin ────────────────────────────────────

/**
 * A locked price must still be on the profitable side of the reference at
 * the moment it fills. ASK: price ≥ R + askFloorOffset (never sell below the
 * street). BID: price ≤ R − minHalfSpread.
 */
export function checkFillAgainstReference(p: {
  side: LydSide; price: Decimal; reference: Decimal; usdReference: Decimal; isUsd: boolean; cfg: MarketMakerConfig;
}): { ok: boolean; limit: Decimal } {
  const unit = pipUnit(p.cfg, p.reference, p.usdReference, p.isUsd);
  if (p.side === 'ASK') {
    const limit = p.reference.plus(unit.mul(p.cfg.askFloorOffsetPips));
    return { ok: p.price.gte(limit), limit };
  }
  const limit = p.reference.minus(unit.mul(p.cfg.minHalfSpreadPips));
  return { ok: p.price.lte(limit) && p.price.gt(0), limit };
}

/** LYD captured against the reference on `units` of foreign currency. Never negative. */
export function fillMarginLyd(side: LydSide, price: Decimal, reference: Decimal, units: Decimal): Decimal {
  const perUnit = side === 'ASK' ? price.minus(reference) : reference.minus(price);
  return Decimal.max(0, perUnit.mul(units));
}
