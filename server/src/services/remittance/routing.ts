/**
 * Route engine.
 *
 * For a payout (destination country, currency, method, amount) every
 * registered rail is evaluated. Ineligible rails are kept with the reason so
 * operators can see why a route was not used. Eligible rails are scored:
 *   35% cost       (provider fee, relative to the cheapest)
 *   25% speed      (SLA, pushed to the next business day after a cut-off)
 *   25% reliability(paid / (paid + failed + returned) over 30 days)
 *   15% liquidity  (prefunded headroom vs. this payout)
 * minus 0.2 when the provider's last health check failed. The best becomes
 * the route, the next the fallback. The full ranking is persisted.
 */
import type { Currency, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../utils/prisma';
import { adapterUsable, circuitOpen, listPayoutAdapters } from '../providers/registry';
import { isBlocked } from '../platform/controls.service';
import { currentLaunchReadiness } from '../ops/launchReadiness.service';
import { availableIn } from '../treasury/pools.service';

export interface RouteInput {
  destCountry: string;
  destCurrency: Currency;
  payoutMethod: string;
  receiveAmount: Decimal;
  customerRate: Decimal; // dest per 1 source — to express cost in source currency
}

export interface RouteCandidate {
  providerCode: string;
  providerName: string;
  mode: string;
  eligible: boolean;
  reason: string;
  score: number;
  rank: number;
  estimatedCostDest: number;
  estimatedCostSource: number;
  estimatedDeliveryMins: number;
  requiredLiquidity: number;
  liquidityAvailable: number | null;
  successRate: number;
  successSamples: number;
  settlementModel: string;
  factors: Record<string, number | string | null>;
}

function minutesUntilCutoffAdjusted(slaMinutes: number, cutoff: { weekdaysOnly: boolean; endHourUtc: number } | null | undefined): number {
  if (!cutoff) return slaMinutes;
  const now = new Date();
  const day = now.getUTCDay();
  const weekend = day === 0 || day === 6 || day === 5; // Fri–Sat/Sun treated as non-business for MENA rails
  const pastCutoff = now.getUTCHours() >= cutoff.endHourUtc;
  if (!weekend && !pastCutoff) return slaMinutes;
  // Next business morning (08:00 UTC) + SLA.
  const next = new Date(now);
  do { next.setUTCDate(next.getUTCDate() + 1); } while (cutoff.weekdaysOnly && [5, 6].includes(next.getUTCDay()));
  next.setUTCHours(8, 0, 0, 0);
  return Math.round((next.getTime() - now.getTime()) / 60_000) + slaMinutes;
}

async function successRate(code: string): Promise<{ rate: number; samples: number }> {
  const since = new Date(Date.now() - 30 * 86400_000);
  const rows = await prisma.remittancePayout.groupBy({ by: ['status'], where: { providerCode: code, createdAt: { gte: since } }, _count: true });
  const n = (s: string) => rows.find((r) => r.status === s)?._count ?? 0;
  const paid = n('PAID'); const bad = n('FAILED') + n('RETURNED');
  const samples = paid + bad;
  // Below 10 outcomes there is no meaningful history: assume 95% and say so.
  return samples < 10 ? { rate: 0.95, samples } : { rate: paid / samples, samples };
}

export async function rankRoutes(input: RouteInput): Promise<RouteCandidate[]> {
  const adapters = listPayoutAdapters();
  const providerRows = await prisma.provider.findMany({ where: { code: { in: adapters.map((a) => a.descriptor.code) } } });
  const amount = input.receiveAmount.toNumber();
  const candidates: RouteCandidate[] = [];

  for (const a of adapters) {
    const d = a.descriptor;
    const t = d.terms!;
    const row = providerRows.find((p) => p.code === d.code);
    const base: Omit<RouteCandidate, 'eligible' | 'reason' | 'score' | 'rank'> = {
      providerCode: d.code, providerName: d.name, mode: d.mode,
      estimatedCostDest: Math.round((t.feeFixed + amount * t.feePercent) * 100) / 100,
      estimatedCostSource: 0,
      estimatedDeliveryMins: minutesUntilCutoffAdjusted(t.slaMinutes, t.cutoff),
      requiredLiquidity: amount, liquidityAvailable: null, successRate: 0, successSamples: 0,
      settlementModel: t.settlementModel, factors: {},
    };
    base.estimatedCostSource = input.customerRate.gt(0) ? Math.round((base.estimatedCostDest / input.customerRate.toNumber()) * 1000) / 1000 : 0;
    const reject = (reason: string) => candidates.push({ ...base, eligible: false, reason, score: 0, rank: 0 });

    if (!d.currencies.includes(input.destCurrency)) continue; // not a rail for this currency at all
    if (!(d.countries.includes('*') || d.countries.includes(input.destCountry))) continue;
    if (!(d.payoutMethods ?? []).includes(input.payoutMethod)) { reject(`Does not support ${input.payoutMethod}`); continue; }
    if (process.env.NODE_ENV === 'production' && !currentLaunchReadiness().evidence?.scope.providers.includes(d.code)) { reject('Provider is outside the reviewed launch scope'); continue; }
    if (!adapterUsable(a)) { reject('Sandbox rail — not available in production'); continue; }
    if (!row || row.status !== 'ENABLED') { reject(`Provider is ${row?.status ?? 'not registered'}`); continue; }
    if (await isBlocked('PROVIDER', d.code)) { reject('Provider paused by kill switch'); continue; }
    if (circuitOpen(d.code)) { reject('Circuit breaker open after repeated failures'); continue; }
    if (amount < t.minAmount || amount > t.maxAmount) { reject(`Amount outside provider limits ${t.minAmount}–${t.maxAmount}`); continue; }

    const sr = await successRate(d.code);
    base.successRate = Math.round(sr.rate * 1000) / 1000;
    base.successSamples = sr.samples;

    if (t.settlementModel === 'PREFUNDED' || t.settlementModel === 'INTERNAL') {
      const avail = await availableIn(d.code, input.destCurrency);
      base.liquidityAvailable = avail ? avail.toNumber() : 0;
      if (!avail || avail.lt(input.receiveAmount)) { reject(`Insufficient prefunded ${input.destCurrency} liquidity (${avail?.toFixed(2) ?? 'no pool'})`); continue; }
    }
    candidates.push({ ...base, eligible: true, reason: 'Eligible', score: 0, rank: 0 });
  }

  const eligible = candidates.filter((c) => c.eligible);
  const maxCost = Math.max(...eligible.map((c) => c.estimatedCostDest), 0.0001);
  const maxMins = Math.max(...eligible.map((c) => c.estimatedDeliveryMins), 1);
  for (const c of eligible) {
    const cost = 1 - c.estimatedCostDest / maxCost;
    const speed = 1 - c.estimatedDeliveryMins / maxMins;
    const liquidity = c.liquidityAvailable === null ? 1 : Math.min(1, c.liquidityAvailable / (c.requiredLiquidity * 5));
    const row = providerRows.find((p) => p.code === c.providerCode);
    const healthPenalty = row?.lastHealthOk === false ? 0.2 : 0;
    const score = 0.35 * cost + 0.25 * speed + 0.25 * c.successRate + 0.15 * liquidity - healthPenalty;
    c.score = Math.round(score * 10000) / 10000;
    c.factors = {
      cost: Math.round(cost * 1000) / 1000, speed: Math.round(speed * 1000) / 1000, reliability: c.successRate,
      liquidity: Math.round(liquidity * 1000) / 1000, healthPenalty,
      historyNote: c.successSamples < 10 ? `only ${c.successSamples} outcomes in 30 days — reliability assumed 95%` : null,
    };
    // Single eligible rail: its absolute merits matter more than relative normalisation.
    if (eligible.length === 1) c.score = Math.round((0.25 * c.successRate + 0.15 * liquidity + 0.6 - healthPenalty) * 10000) / 10000;
    c.reason = `Score ${c.score}: cost ${c.estimatedCostDest} ${'' /* currency in UI */}, ~${c.estimatedDeliveryMins} min, reliability ${(c.successRate * 100).toFixed(1)}%`;
  }
  eligible.sort((a, b) => b.score - a.score);
  eligible.forEach((c, i) => { c.rank = i + 1; });
  return [...eligible, ...candidates.filter((c) => !c.eligible)];
}

export async function persistRoutes(client: Prisma.TransactionClient | typeof prisma, routes: RouteCandidate[], ref: { quoteId?: string; transferId?: string }, destCurrency: Currency, selectedCode?: string | null) {
  if (!routes.length) return;
  await client.remittanceRoute.createMany({
    data: routes.map((r) => ({
      quoteId: ref.quoteId ?? null, transferId: ref.transferId ?? null, providerCode: r.providerCode,
      score: r.score, rank: r.rank, selected: Boolean(selectedCode && r.providerCode === selectedCode && r.eligible),
      eligible: r.eligible, reason: r.reason, estimatedCost: r.estimatedCostSource, estimatedDeliveryMins: r.estimatedDeliveryMins,
      requiredLiquidity: r.requiredLiquidity, liquidityCurrency: destCurrency,
      factors: { ...r.factors, mode: r.mode, settlementModel: r.settlementModel, costDest: r.estimatedCostDest, successSamples: r.successSamples, liquidityAvailable: r.liquidityAvailable } as Prisma.InputJsonValue,
    })),
  });
}
