/**
 * Risk engine — transaction monitoring, fraud and sanctions controls in one
 * explainable rule set.
 *
 * Each rule reads facts from the database, decides whether it fires, and
 * contributes a score and an action. The decision's outcome is the most
 * severe action among fired rules (REJECT > FREEZE > REVIEW >
 * REQUEST_INFORMATION > CHALLENGE > DELAY > APPROVE); the score is the capped
 * sum. Every evaluation is persisted as a RiskDecision with the fired rules,
 * the signals they saw, and a plain-language explanation; each fired rule
 * also writes a RiskEvent for the fraud and AML views.
 *
 * Rules are rows in RiskRule (seeded with the defaults below) so compliance
 * can tune thresholds or disable a rule without a deploy; the code defines
 * what a rule MEANS, the row defines its parameters and whether it is on.
 * Fuzzy or behavioural signals never auto-reject on their own — they send
 * the case to a human (REVIEW). Only hard policy (restricted jurisdiction)
 * rejects automatically.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

export const ENGINE_VERSION = 'risk-engine/2026-10.1';

export type RiskAction = 'APPROVE' | 'REVIEW' | 'REJECT' | 'FREEZE' | 'REQUEST_INFORMATION' | 'CHALLENGE' | 'DELAY' | 'BLOCK';
const SEVERITY: RiskAction[] = ['APPROVE', 'DELAY', 'CHALLENGE', 'REQUEST_INFORMATION', 'REVIEW', 'FREEZE', 'BLOCK', 'REJECT'];

export interface RiskContext {
  subjectType: 'REMITTANCE' | 'WITHDRAWAL' | 'TRANSFER' | 'BUSINESS_PAYOUT' | 'BENEFICIARY';
  subjectId: string;
  userId: string;
  amountUsd: number;
  sourceCountry?: string | null;
  destCountry?: string | null;
  beneficiaryId?: string | null;
  sourceOfFunds?: string | null;
  sourceOfFundsThresholdUsd?: number | null;
  knownDevice?: boolean;
  deviceFingerprint?: string | null;
  screening?: { sender?: string; beneficiary?: string; coverage?: 'LISTS_LOADED' | 'NO_LISTS_LOADED' };
}

interface RuleDef {
  code: string;
  name: string;
  category: 'AML' | 'FRAUD' | 'SANCTIONS' | 'GEOGRAPHY' | 'LIMITS';
  description: string;
  action: RiskAction;
  score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  params: Record<string, unknown>;
  appliesTo: RiskContext['subjectType'][];
  evaluate: (ctx: RiskContext, params: any) => Promise<{ fired: boolean; signal?: Record<string, unknown>; why?: string }>;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);

async function outflowsUsd(userId: string, since: Date): Promise<{ count: number; usd: number; items: number[] }> {
  // Remittances are valued at send time via their USD-equivalent stored on the decision signals; use
  // sendAmount × current rate as an approximation for velocity purposes.
  const { usdRate } = await import('../../utils/kycLimits');
  const [rem, wd] = await Promise.all([
    prisma.remittanceTransfer.findMany({ where: { userId, createdAt: { gte: since }, state: { notIn: ['REJECTED', 'CANCELLED', 'EXPIRED'] } }, select: { sendAmount: true, sourceCurrency: true } }),
    prisma.withdrawal.findMany({ where: { userId, createdAt: { gte: since }, status: { notIn: ['REJECTED', 'CANCELLED'] } }, select: { amount: true, currency: true } }),
  ]);
  const items: number[] = [];
  for (const r of rem) items.push(Number(r.sendAmount) * (await usdRate(r.sourceCurrency)));
  for (const w of wd) items.push(Number(w.amount) * (await usdRate(w.currency)));
  return { count: items.length, usd: items.reduce((a, b) => a + b, 0), items };
}

export const DEFAULT_RULES: RuleDef[] = [
  {
    code: 'RESTRICTED_JURISDICTION', name: 'Restricted jurisdiction', category: 'GEOGRAPHY', action: 'REJECT', score: 100, severity: 'CRITICAL',
    description: 'Source or destination country is on the configured restricted list. Default is the FATF call-for-action list as of 2025 — compliance must confirm the current list.',
    params: { countries: ['KP', 'IR', 'MM'] }, appliesTo: ['REMITTANCE', 'BUSINESS_PAYOUT', 'BENEFICIARY'],
    evaluate: async (ctx, p) => {
      const list: string[] = (p.countries ?? []).map((c: string) => c.toUpperCase());
      const hit = [ctx.sourceCountry, ctx.destCountry].find((c) => c && list.includes(c.toUpperCase()));
      return hit ? { fired: true, signal: { country: hit }, why: `${hit} is a restricted jurisdiction` } : { fired: false };
    },
  },
  {
    code: 'SANCTIONS_SCREENING_HIT', name: 'Sanctions / PEP screening hit', category: 'SANCTIONS', action: 'REVIEW', score: 60, severity: 'HIGH',
    description: 'Sender or beneficiary resembles a watchlist entry. A human decides — fuzzy matches never auto-reject.',
    params: {}, appliesTo: ['REMITTANCE', 'BUSINESS_PAYOUT', 'BENEFICIARY', 'WITHDRAWAL'],
    evaluate: async (ctx) => {
      const hits = [ctx.screening?.sender === 'POTENTIAL_MATCH' ? 'sender' : null, ctx.screening?.beneficiary === 'POTENTIAL_MATCH' ? 'beneficiary' : null].filter(Boolean);
      return hits.length ? { fired: true, signal: { parties: hits }, why: `Screening potential match on ${hits.join(' and ')}` } : { fired: false };
    },
  },
  {
    code: 'SCREENING_NO_COVERAGE', name: 'No sanctions lists loaded', category: 'SANCTIONS', action: 'REVIEW', score: 30, severity: 'HIGH',
    description: 'Screening ran with no watchlist loaded. In production this sends the transfer to review instead of treating it as clear.',
    params: { productionOnly: true }, appliesTo: ['REMITTANCE', 'BUSINESS_PAYOUT'],
    evaluate: async (ctx, p) => {
      if (ctx.screening?.coverage !== 'NO_LISTS_LOADED') return { fired: false };
      if (p.productionOnly && process.env.NODE_ENV !== 'production') return { fired: false };
      return { fired: true, signal: { coverage: 'NO_LISTS_LOADED' }, why: 'No sanctions or PEP list is loaded, so the parties could not be screened' };
    },
  },
  {
    code: 'HIGH_VALUE', name: 'High-value transfer', category: 'AML', action: 'REVIEW', score: 35, severity: 'MEDIUM',
    description: 'Single transfer at or above the review threshold.', params: { thresholdUsd: 5000 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL', 'BUSINESS_PAYOUT'],
    evaluate: async (ctx, p) => ctx.amountUsd >= p.thresholdUsd
      ? { fired: true, signal: { amountUsd: Math.round(ctx.amountUsd) }, why: `Amount ≈ $${Math.round(ctx.amountUsd)} is at or above the $${p.thresholdUsd} review threshold` }
      : { fired: false },
  },
  {
    code: 'SOURCE_OF_FUNDS_REQUIRED', name: 'Source of funds required', category: 'AML', action: 'REQUEST_INFORMATION', score: 20, severity: 'MEDIUM',
    description: 'Amount above the corridor source-of-funds threshold without a declared source of funds.', params: {}, appliesTo: ['REMITTANCE'],
    evaluate: async (ctx) => (ctx.sourceOfFundsThresholdUsd && ctx.amountUsd >= ctx.sourceOfFundsThresholdUsd && !ctx.sourceOfFunds?.trim())
      ? { fired: true, signal: { thresholdUsd: ctx.sourceOfFundsThresholdUsd }, why: 'Source of funds was not declared for an amount above the corridor threshold' }
      : { fired: false },
  },
  {
    code: 'VELOCITY_COUNT_24H', name: 'Transfer count velocity (24h)', category: 'AML', action: 'REVIEW', score: 25, severity: 'MEDIUM',
    description: 'More outbound transfers in 24 hours than the configured maximum.', params: { max: 5 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      const o = await outflowsUsd(ctx.userId, hoursAgo(24));
      return o.count + 1 > p.max ? { fired: true, signal: { count24h: o.count + 1 }, why: `${o.count + 1} outbound transfers in 24h (limit ${p.max})` } : { fired: false };
    },
  },
  {
    code: 'VELOCITY_AMOUNT_24H', name: 'Transfer value velocity (24h)', category: 'AML', action: 'REVIEW', score: 25, severity: 'MEDIUM',
    description: 'Outbound value in 24 hours above the configured maximum.', params: { maxUsd: 10000 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      const o = await outflowsUsd(ctx.userId, hoursAgo(24));
      const total = o.usd + ctx.amountUsd;
      return total > p.maxUsd ? { fired: true, signal: { usd24h: Math.round(total) }, why: `≈ $${Math.round(total)} outbound in 24h (limit $${p.maxUsd})` } : { fired: false };
    },
  },
  {
    code: 'STRUCTURING', name: 'Possible structuring', category: 'AML', action: 'REVIEW', score: 45, severity: 'HIGH',
    description: 'Several transfers in 48 hours each just below the review threshold.', params: { thresholdUsd: 5000, band: 0.8, minCount: 3 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      const o = await outflowsUsd(ctx.userId, hoursAgo(48));
      const inBand = (v: number) => v >= p.thresholdUsd * p.band && v < p.thresholdUsd;
      const n = o.items.filter(inBand).length + (inBand(ctx.amountUsd) ? 1 : 0);
      return n >= p.minCount ? { fired: true, signal: { justBelowThreshold48h: n }, why: `${n} transfers in 48h between ${p.band * 100}% and 100% of the $${p.thresholdUsd} threshold` } : { fired: false };
    },
  },
  {
    code: 'NEW_BENEFICIARY_HIGH_VALUE', name: 'New beneficiary, high value', category: 'FRAUD', action: 'REVIEW', score: 30, severity: 'MEDIUM',
    description: 'Sizeable first payment to a beneficiary added within the last 24 hours.', params: { thresholdUsd: 1000, hours: 24 }, appliesTo: ['REMITTANCE'],
    evaluate: async (ctx, p) => {
      if (!ctx.beneficiaryId || ctx.amountUsd < p.thresholdUsd) return { fired: false };
      const b = await prisma.remittanceBeneficiary.findUnique({ where: { id: ctx.beneficiaryId }, select: { createdAt: true } });
      return b && b.createdAt > hoursAgo(p.hours) ? { fired: true, signal: { beneficiaryAgeHours: Math.round((Date.now() - b.createdAt.getTime()) / 3600_000) }, why: 'Beneficiary was added less than a day ago' } : { fired: false };
    },
  },
  {
    code: 'BENEFICIARY_FANOUT_7D', name: 'Many beneficiaries (7 days)', category: 'FRAUD', action: 'REVIEW', score: 20, severity: 'LOW',
    description: 'Sending to more distinct beneficiaries in 7 days than the maximum.', params: { max: 5 }, appliesTo: ['REMITTANCE'],
    evaluate: async (ctx, p) => {
      const rows = await prisma.remittanceTransfer.findMany({ where: { userId: ctx.userId, createdAt: { gte: hoursAgo(168) } }, select: { beneficiaryId: true }, distinct: ['beneficiaryId'] });
      const n = new Set([...rows.map((r) => r.beneficiaryId), ctx.beneficiaryId].filter(Boolean)).size;
      return n > p.max ? { fired: true, signal: { distinctBeneficiaries7d: n }, why: `${n} distinct beneficiaries in 7 days (limit ${p.max})` } : { fired: false };
    },
  },
  {
    code: 'BENEFICIARY_SHARED', name: 'Beneficiary account shared across senders', category: 'FRAUD', action: 'REVIEW', score: 35, severity: 'HIGH',
    description: 'The same payout account is used by more distinct senders than the maximum (possible mule).', params: { maxSenders: 2 }, appliesTo: ['REMITTANCE'],
    evaluate: async (ctx, p) => {
      if (!ctx.beneficiaryId) return { fired: false };
      const b = await prisma.remittanceBeneficiary.findUnique({ where: { id: ctx.beneficiaryId }, select: { accountNumber: true, iban: true, mobileWallet: true } });
      const keys = [b?.iban, b?.accountNumber, b?.mobileWallet].filter(Boolean) as string[];
      if (!keys.length) return { fired: false };
      const owners = await prisma.remittanceBeneficiary.findMany({
        where: { OR: [{ iban: { in: keys } }, { accountNumber: { in: keys } }, { mobileWallet: { in: keys } }] },
        select: { userId: true }, distinct: ['userId'],
      });
      return owners.length > p.maxSenders ? { fired: true, signal: { distinctSenders: owners.length }, why: `Payout account is used by ${owners.length} different senders` } : { fired: false };
    },
  },
  {
    code: 'NEW_DEVICE_HIGH_VALUE', name: 'New device, high value', category: 'FRAUD', action: 'CHALLENGE', score: 20, severity: 'MEDIUM',
    description: 'High-value action from a device not seen before — require step-up.', params: { thresholdUsd: 500 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL', 'TRANSFER'],
    evaluate: async (ctx, p) => (ctx.knownDevice === false && ctx.amountUsd >= p.thresholdUsd)
      ? { fired: true, signal: { knownDevice: false }, why: 'Request came from an unrecognised device' } : { fired: false },
  },
  {
    code: 'SHARED_DEVICE', name: 'Device used by several accounts', category: 'FRAUD', action: 'REVIEW', score: 30, severity: 'MEDIUM',
    description: 'The device fingerprint is registered to more accounts than the maximum.', params: { maxAccounts: 2 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      if (!ctx.deviceFingerprint) return { fired: false };
      const n = await prisma.knownDevice.count({ where: { fingerprint: ctx.deviceFingerprint } });
      return n > p.maxAccounts ? { fired: true, signal: { accountsOnDevice: n }, why: `This device is registered to ${n} accounts` } : { fired: false };
    },
  },
  {
    code: 'RECENT_SECURITY_CHANGE', name: 'Recent security change then outflow', category: 'FRAUD', action: 'REVIEW', score: 35, severity: 'HIGH',
    description: 'Password reset, 2FA change or recovery shortly before money leaves (account-takeover pattern).', params: { hours: 48, minUsd: 200 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      if (ctx.amountUsd < p.minUsd) return { fired: false };
      const ev = await prisma.riskEvent.findFirst({ where: { userId: ctx.userId, type: 'SECURITY_CHANGE', createdAt: { gte: hoursAgo(p.hours) } }, orderBy: { createdAt: 'desc' } });
      return ev ? { fired: true, signal: { change: (ev.data as any)?.change ?? 'security', at: ev.createdAt }, why: `Security settings changed ${Math.round((Date.now() - ev.createdAt.getTime()) / 3600_000)}h ago` } : { fired: false };
    },
  },
  {
    code: 'DEPOSIT_CYCLING', name: 'Deposit quickly sent out', category: 'AML', action: 'REVIEW', score: 30, severity: 'MEDIUM',
    description: 'Most of a recent deposit leaves within 48 hours (pass-through pattern).', params: { hours: 48, ratio: 0.8, minUsd: 1000 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      if (ctx.amountUsd < p.minUsd) return { fired: false };
      const { usdRate } = await import('../../utils/kycLimits');
      const deps = await prisma.deposit.findMany({ where: { userId: ctx.userId, status: 'CONFIRMED', confirmedAt: { gte: hoursAgo(p.hours) } }, select: { amount: true, currency: true } });
      let usd = 0;
      for (const d of deps) usd += Number(d.amount) * (await usdRate(d.currency));
      return usd > 0 && ctx.amountUsd >= usd * p.ratio ? { fired: true, signal: { depositsUsd48h: Math.round(usd) }, why: `≈ ${Math.round((ctx.amountUsd / usd) * 100)}% of deposits from the last ${p.hours}h is leaving` } : { fired: false };
    },
  },
  {
    code: 'YOUNG_ACCOUNT_HIGH_VALUE', name: 'New account, high value', category: 'FRAUD', action: 'REVIEW', score: 20, severity: 'LOW',
    description: 'Account younger than the minimum age moving a large amount.', params: { days: 7, thresholdUsd: 2000 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL'],
    evaluate: async (ctx, p) => {
      if (ctx.amountUsd < p.thresholdUsd) return { fired: false };
      const u = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { createdAt: true } });
      return u && u.createdAt > hoursAgo(p.days * 24) ? { fired: true, signal: { accountAgeDays: Math.floor((Date.now() - u.createdAt.getTime()) / 86400_000) }, why: `Account is less than ${p.days} days old` } : { fired: false };
    },
  },
  {
    code: 'SCORE_THRESHOLD', name: 'Cumulative risk score', category: 'AML', action: 'REVIEW', score: 0, severity: 'MEDIUM',
    description: 'Several smaller signals together reach the review score.', params: { reviewAt: 60 }, appliesTo: ['REMITTANCE', 'WITHDRAWAL', 'BUSINESS_PAYOUT'],
    evaluate: async () => ({ fired: false }), // applied after the other rules, see evaluateRisk
  },
];

let rulesCache: { at: number; rows: Map<string, { enabled: boolean; params: any; action: string; score: number }> } | null = null;

/** Create default rule rows that do not exist yet (never overwrites tuning). */
export async function ensureDefaultRules(): Promise<void> {
  for (const r of DEFAULT_RULES) {
    await prisma.riskRule.upsert({
      where: { code: r.code },
      create: { code: r.code, name: r.name, category: r.category, description: r.description, action: r.action, score: r.score, severity: r.severity, params: r.params as Prisma.InputJsonValue },
      update: {},
    });
  }
  rulesCache = null;
}

async function ruleConfig() {
  if (rulesCache && Date.now() - rulesCache.at < 30_000) return rulesCache.rows;
  const rows = await prisma.riskRule.findMany();
  const map = new Map(rows.map((r) => [r.code, { enabled: r.enabled, params: r.params, action: r.action, score: r.score }]));
  rulesCache = { at: Date.now(), rows: map };
  return map;
}

export function invalidateRuleCache() { rulesCache = null; }

export interface RiskResult {
  decisionId: string;
  outcome: RiskAction;
  score: number;
  triggered: string[];
  explanation: string;
}

export async function evaluateRisk(ctx: RiskContext, client: Prisma.TransactionClient | typeof prisma = prisma): Promise<RiskResult> {
  const cfg = await ruleConfig();
  const fired: Array<{ code: string; action: RiskAction; score: number; severity: string; category: string; signal?: Record<string, unknown>; why?: string }> = [];
  for (const rule of DEFAULT_RULES) {
    if (!rule.appliesTo.includes(ctx.subjectType) || rule.code === 'SCORE_THRESHOLD') continue;
    const row = cfg.get(rule.code);
    if (row && !row.enabled) continue;
    const params = { ...rule.params, ...((row?.params as object) ?? {}) };
    try {
      const r = await rule.evaluate(ctx, params);
      if (r.fired) fired.push({ code: rule.code, action: (row?.action as RiskAction) ?? rule.action, score: row?.score ?? rule.score, severity: rule.severity, category: rule.category, signal: r.signal, why: r.why });
    } catch (err) {
      // A failing rule must not silently approve: record it as a review signal.
      logger.error('[risk] rule failed', { rule: rule.code, err: (err as Error).message });
      fired.push({ code: `${rule.code}_ERROR`, action: 'REVIEW', score: 10, severity: 'MEDIUM', category: rule.category, why: `Rule ${rule.code} could not be evaluated` });
    }
  }
  let score = Math.min(100, fired.reduce((n, f) => n + f.score, 0));
  const thr = cfg.get('SCORE_THRESHOLD');
  const reviewAt = Number((thr?.params as any)?.reviewAt ?? 60);
  if ((thr?.enabled ?? true) && score >= reviewAt && !fired.some((f) => SEVERITY.indexOf(f.action) >= SEVERITY.indexOf('REVIEW'))) {
    fired.push({ code: 'SCORE_THRESHOLD', action: 'REVIEW', score: 0, severity: 'MEDIUM', category: 'AML', why: `Combined score ${score} reached the review level ${reviewAt}` });
  }
  const outcome = fired.reduce<RiskAction>((worst, f) => (SEVERITY.indexOf(f.action) > SEVERITY.indexOf(worst) ? f.action : worst), 'APPROVE');
  score = Math.min(100, score);
  const explanation = fired.length ? fired.map((f) => f.why ?? f.code).join('; ') : 'No risk rules fired';

  const decision = await client.riskDecision.create({
    data: {
      subjectType: ctx.subjectType, subjectId: ctx.subjectId, userId: ctx.userId, outcome, score,
      triggeredRules: fired.map((f) => f.code),
      signals: { context: { amountUsd: Math.round(ctx.amountUsd * 100) / 100, sourceCountry: ctx.sourceCountry, destCountry: ctx.destCountry, knownDevice: ctx.knownDevice, screening: ctx.screening }, fired } as Prisma.InputJsonValue,
      explanation, engineVersion: ENGINE_VERSION,
    },
  });
  if (fired.length) {
    await client.riskEvent.createMany({
      data: fired.map((f) => ({
        userId: ctx.userId, type: f.code, severity: f.severity, score: f.score,
        subjectType: ctx.subjectType, subjectId: ctx.subjectId, data: { category: f.category, signal: f.signal ?? null, why: f.why ?? null, decisionId: decision.id } as Prisma.InputJsonValue,
      })),
    });
  }
  return { decisionId: decision.id, outcome, score, triggered: fired.map((f) => f.code), explanation };
}

/** Record a behavioural signal from elsewhere in the platform (e.g. a security change). */
export async function recordRiskEvent(userId: string, type: string, data: Record<string, unknown> = {}, severity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW') {
  await prisma.riskEvent.create({ data: { userId, type, severity, data: data as Prisma.InputJsonValue } }).catch(() => undefined);
}
