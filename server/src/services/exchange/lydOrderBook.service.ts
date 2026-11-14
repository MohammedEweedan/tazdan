/**
 * USD/LYD price history, plus the legacy order-book accessors.
 *
 * Demand-driven pricing moved to the LYD market maker
 * (lydMarketMaker.service.ts): pip-based two-sided quotes around the Fulus
 * reference, with flow shared through Redis. The old in-memory, upward-only
 * percentage skew is gone; Fulus pairs never used it anyway. This module
 * keeps the FxRateTick history for the admin charts and the two entry
 * points other code calls:
 *   recordLydFlow  - a crypto order in LYD just committed; prompts the
 *                    market maker to ingest it (the database row is the
 *                    source of truth, with user attribution)
 *   lydOrderBookState - sync snapshot for the admin LYD panel
 */
import { prisma } from '../../utils/prisma';
import { lastMarketMakerSnapshot, lastSkewFraction, requestLydFillIngest, restorePendingVolumeUsd, startLydFillIngestion, takePendingVolumeUsd } from './lydMarketMaker.service';

const PAIR = 'USD/LYD';
// Latest effective USD/LYD mid, updated whenever getRate prices the pair.
let lastPrice = 0;

/**
 * A LYD trade committed. The market maker reads committed trades (with user
 * attribution) from the database, so this only asks it to ingest now rather
 * than at the next poll. The arguments are kept for compatibility.
 */
export function recordLydFlow(_side: 'BUY' | 'SELL', _usdAmount: number): void {
  requestLydFillIngest();
}

/** Called by getRate when it prices USD/LYD, so history reflects the live rate. */
export function noteLydPrice(price: number): void {
  if (Number.isFinite(price) && price > 0) lastPrice = price;
}

/** Snapshot for admin/debug surfaces (legacy shape plus the market-maker state). */
export function lydOrderBookState() {
  const { state, config, usdReference } = lastMarketMakerSnapshot();
  const ref = Number(usdReference);
  const toFrac = (pips: number) => (ref > 0 ? (pips * Number(config.pipSize)) / ref : 0);
  return {
    netUsd: state?.flow.netUsd ?? 0,
    skewPct: toFrac(state?.skewPips ?? 0),
    maxSkewPct: toFrac(config.maxUpSkewPips),
    refUsd: config.depthUsd,
    marketMaker: state ? {
      mode: state.mode, skewPips: state.skewPips, targetSkewPips: state.targetSkewPips, flow: state.flow,
      capturedLydInWindow: state.capturedLyd, at: state.at,
    } : null,
  };
}

// ── History sampling ─────────────────────────────────────────────────────────
// Persist a tick on an interval so the admin chart has a continuous price line
// (even with no trades) plus the volume traded in each bucket. One write per
// interval keeps DB load trivial. Disabled until we have a price.
const SAMPLE_INTERVAL_MS = Number(process.env.LYD_SAMPLE_INTERVAL_MS ?? 5 * 60_000);

// Every currency Fulus carries vs LYD. We record a tick per pair each interval
// so each currency has its own continuous price line for the admin charts. Only
// USD/LYD carries volume + skew (the pair that actually trades); the rest are
// pure price history.
const LYD_TICK_CODES = ['USD', 'EUR', 'GBP', 'TRY', 'EGP', 'TND', 'SAR', 'AED'] as const;

async function sampleTick(): Promise<void> {
  const { getRate } = await import('./fxRateProvider.service');

  // USD/LYD first — it drives lastPrice (used by trade ticks) and carries volume.
  try {
    const r = await getRate('USD', 'LYD');
    const mid = (Number(r.buyPrice) + Number(r.sellPrice)) / 2;
    if (Number.isFinite(mid) && mid > 0) lastPrice = mid;
  } catch { /* keep last known price */ }

  if (lastPrice > 0) {
    const volume = takePendingVolumeUsd();
    try {
      await prisma.fxRateTick.create({
        data: {
          pair: PAIR,
          price: lastPrice.toFixed(8),
          volumeUsd: volume.toFixed(2),
          // Applied market-maker skew as a fraction of the reference (signed).
          skewPct: lastSkewFraction().toFixed(6),
        },
      });
    } catch {
      // On failure, don't lose the volume; roll it back for the next tick.
      restorePendingVolumeUsd(volume);
    }
  }

  // Remaining currencies — price-only ticks. Best-effort and independent: one
  // pair failing must not stop the others.
  await Promise.all(
    LYD_TICK_CODES.filter((c) => c !== 'USD').map(async (code) => {
      try {
        const r = await getRate(code, 'LYD');
        const mid = (Number(r.buyPrice) + Number(r.sellPrice)) / 2;
        if (!Number.isFinite(mid) || mid <= 0) return;
        await prisma.fxRateTick.create({
          data: { pair: `${code}/LYD`, price: mid.toFixed(8), volumeUsd: '0', skewPct: '0' },
        });
      } catch { /* skip this pair this interval */ }
    }),
  );
}

let samplerStarted = false;
export function startLydSampler(): void {
  if (samplerStarted) return;
  samplerStarted = true;
  setInterval(() => { void sampleTick(); }, SAMPLE_INTERVAL_MS).unref?.();
  // The scheduler worker also feeds executed LYD trades to the market maker.
  startLydFillIngestion();
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

/**
 * Price history for an arbitrary pair (e.g. "EUR/LYD"). Used by the admin
 * per-currency sparklines. Same shape as getLydHistory; volume/skew are 0 for
 * non-USD pairs since only USD/LYD carries them.
 */
export async function getPairHistory(pair: string, hours = 24): Promise<
  Array<{ t: number; price: number; volumeUsd: number; skewPct: number }>
> {
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await prisma.fxRateTick.findMany({
    where: { pair, createdAt: { gte: since } },
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

/** Number of recorded ticks for a pair within the window — used to decide whether to backfill. */
export async function countPairTicks(pair: string, hours = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 3_600_000);
  return prisma.fxRateTick.count({ where: { pair, createdAt: { gte: since } } }).catch(() => 0);
}
