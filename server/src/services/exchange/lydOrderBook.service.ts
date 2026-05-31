/**
 * USD/LYD adaptive pricing ("soft order book").
 *
 * The scraped parallel-market rate (blackmarketlive) is our reference FLOOR —
 * we never sell USD for fewer LYD than the street rate, so low platform demand
 * can't drag our price below the real market.
 *
 * On top of that floor we apply a demand skew driven by recent net flow:
 *   - Users BUYING USD (paying LYD) drain our USD inventory → upward pressure,
 *     so our USD/LYD rate rises above the market floor.
 *   - Users SELLING USD (receiving LYD) replenish inventory → the skew relaxes
 *     back toward the floor (but never below it).
 *
 * Net flow is an in-memory accumulator with exponential time decay, so the
 * skew naturally returns to neutral when trading goes quiet. It's intentionally
 * lightweight (single-process) — good enough to make pricing demand-responsive
 * without standing up a real matching engine. Tunables via env:
 *   LYD_SKEW_MAX_PCT   max upward skew over the floor (default 0.06 = 6%)
 *   LYD_SKEW_HALFLIFE_S  net-flow half-life in seconds (default 3600 = 1h)
 *   LYD_SKEW_REF_USD   net USD flow that maps to the full max skew (default 50000)
 */
import Decimal from 'decimal.js';
import { prisma } from '../../utils/prisma';

const MAX_SKEW_PCT   = Number(process.env.LYD_SKEW_MAX_PCT ?? '0.06');
const HALFLIFE_MS    = Number(process.env.LYD_SKEW_HALFLIFE_S ?? '3600') * 1000;
const REF_USD        = Number(process.env.LYD_SKEW_REF_USD ?? '50000');

const PAIR = 'USD/LYD';
// Latest effective USD/LYD price (floor × skew), updated whenever getRate
// prices the pair. Lets the sampler and trade ticks record a real number.
let lastPrice = 0;
// USD volume traded since the last persisted tick (flushed by the sampler).
let pendingVolumeUsd = 0;

// Signed net USD flow: positive = net buying (USD leaving us), negative = net
// selling. Decays toward 0 over time so a quiet market drifts back to neutral.
let netUsd = 0;
let lastDecayAt = Date.now();

function decay(now = Date.now()): void {
  if (HALFLIFE_MS <= 0) { lastDecayAt = now; return; }
  const dt = now - lastDecayAt;
  if (dt <= 0) return;
  netUsd *= Math.pow(0.5, dt / HALFLIFE_MS);
  if (Math.abs(netUsd) < 1e-6) netUsd = 0;
  lastDecayAt = now;
}

/**
 * Record a USD/LYD trade's effect on our inventory.
 * @param side  'BUY'  = user buys USD (pays LYD)  → upward pressure
 *              'SELL' = user sells USD (gets LYD)  → downward pressure
 * @param usdAmount  size of the trade in USD (absolute)
 */
export function recordLydFlow(side: 'BUY' | 'SELL', usdAmount: number): void {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return;
  decay();
  netUsd += side === 'BUY' ? usdAmount : -usdAmount;
  // Accumulate traded volume for the next history tick.
  pendingVolumeUsd += usdAmount;
}

/** Called by getRate when it prices USD/LYD, so history reflects the live rate. */
export function noteLydPrice(price: number): void {
  if (Number.isFinite(price) && price > 0) lastPrice = price;
}

/**
 * Current upward skew as a fraction in [0, MAX_SKEW_PCT]. Only net BUY pressure
 * skews the price up; net sell pressure yields 0 (the floor governs the bottom).
 */
export function currentLydSkewPct(): number {
  decay();
  if (netUsd <= 0 || REF_USD <= 0) return 0;
  const frac = Math.min(1, netUsd / REF_USD);
  return frac * MAX_SKEW_PCT;
}

/**
 * Apply the demand skew to a floor USD/LYD rate. Returns a rate >= floor.
 * Buy/sell sides are derived by the caller's spread; this only lifts the mid.
 */
export function applyLydDemandSkew(floorMid: Decimal | number): Decimal {
  const floor = new Decimal(floorMid);
  const skew = currentLydSkewPct();
  return floor.mul(new Decimal(1).plus(skew));
}

/** Snapshot for admin/debug surfaces. */
export function lydOrderBookState() {
  decay();
  return { netUsd, skewPct: currentLydSkewPct(), maxSkewPct: MAX_SKEW_PCT, refUsd: REF_USD };
}

// ── History sampling ─────────────────────────────────────────────────────────
// Persist a tick on an interval so the admin chart has a continuous price line
// (even with no trades) plus the volume traded in each bucket. One write per
// interval keeps DB load trivial. Disabled until we have a price.
const SAMPLE_INTERVAL_MS = Number(process.env.LYD_SAMPLE_INTERVAL_MS ?? 5 * 60_000);

async function sampleTick(): Promise<void> {
  // Refresh the price so the chart stays continuous even with no user traffic.
  try {
    const { getRate } = await import('./fxRateProvider.service');
    const r = await getRate('USD', 'LYD');
    // Use the mid of buy/sell as the recorded price.
    const mid = (Number(r.buyPrice) + Number(r.sellPrice)) / 2;
    if (Number.isFinite(mid) && mid > 0) lastPrice = mid;
  } catch { /* keep last known price */ }

  if (lastPrice <= 0) return; // nothing priced yet
  const volume = pendingVolumeUsd;
  pendingVolumeUsd = 0;
  try {
    await prisma.fxRateTick.create({
      data: {
        pair: PAIR,
        price: lastPrice.toFixed(8),
        volumeUsd: volume.toFixed(2),
        skewPct: currentLydSkewPct().toFixed(6),
      },
    });
  } catch {
    // On failure, don't lose the volume — roll it back into the accumulator.
    pendingVolumeUsd += volume;
  }
}

let samplerStarted = false;
export function startLydSampler(): void {
  if (samplerStarted) return;
  samplerStarted = true;
  setInterval(() => { void sampleTick(); }, SAMPLE_INTERVAL_MS).unref?.();
}

/**
 * Price + volume history for the USD/LYD admin chart.
 * @param hours lookback window (default 24h)
 */
export async function getLydHistory(hours = 24): Promise<
  Array<{ t: number; price: number; volumeUsd: number; skewPct: number }>
> {
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await prisma.fxRateTick.findMany({
    where: { pair: PAIR, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  return rows.map((r) => ({
    t: r.createdAt.getTime(),
    price: Number(r.price),
    volumeUsd: Number(r.volumeUsd),
    skewPct: Number(r.skewPct),
  }));
}
