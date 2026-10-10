/**
 * Provider registry, health and call recording.
 *
 * - Lists every adapter with its mode and commercial terms.
 * - Refuses SANDBOX/MOCK adapters in production (assertAdapterUsable).
 * - Wraps provider calls: timeout, redacted ProviderCall row, latency, and a
 *   circuit breaker that opens after repeated failures so routing moves away
 *   from a failing rail instead of hammering it.
 * - Mirrors adapters into the Provider table so operators can enable,
 *   disable or put a provider into maintenance from the cockpit.
 */
import type { Prisma, ProviderStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/errorHandler';
import { assertAdapterUsable, isProductionEnv } from './guard';
import type { PayoutProvider, ProviderDescriptor } from './types';
import { SandboxPayoutProvider } from './adapters/sandboxPayout';
import { TazdanWalletPayoutProvider } from './adapters/tazdanWallet';

const cutoffWeekday = (endHourUtc: number) => ({ tz: 'UTC', weekdaysOnly: true, endHourUtc });

/** Sandbox rails per target corridor. Terms are illustrative sandbox values, not partner quotes. */
const SANDBOX_DESCRIPTORS: ProviderDescriptor[] = [
  { code: 'SANDBOX_GB_FPS', name: 'Sandbox UK Faster Payments', category: 'PAYOUT', mode: 'SANDBOX', countries: ['GB'], currencies: ['GBP'], payoutMethods: ['BANK_ACCOUNT'],
    terms: { feeFixed: 0.5, feePercent: 0, minAmount: 1, maxAmount: 50_000, slaMinutes: 15, settlementModel: 'PREFUNDED', cutoff: null } },
  { code: 'SANDBOX_EU_SEPA', name: 'Sandbox SEPA Instant', category: 'PAYOUT', mode: 'SANDBOX', countries: ['DE', 'FR', 'IT', 'ES', 'NL', 'MT', 'IE', 'BE', 'AT'], currencies: ['EUR'], payoutMethods: ['BANK_ACCOUNT'],
    terms: { feeFixed: 0.4, feePercent: 0, minAmount: 1, maxAmount: 100_000, slaMinutes: 30, settlementModel: 'PREFUNDED', cutoff: null } },
  { code: 'SANDBOX_EG_BANK', name: 'Sandbox Egypt bank payout', category: 'PAYOUT', mode: 'SANDBOX', countries: ['EG'], currencies: ['EGP'], payoutMethods: ['BANK_ACCOUNT', 'MOBILE_WALLET'],
    terms: { feeFixed: 15, feePercent: 0.003, minAmount: 50, maxAmount: 2_000_000, slaMinutes: 120, settlementModel: 'PREFUNDED', cutoff: cutoffWeekday(13) } },
  { code: 'SANDBOX_TR_FAST', name: 'Sandbox Turkey FAST', category: 'PAYOUT', mode: 'SANDBOX', countries: ['TR'], currencies: ['TRY'], payoutMethods: ['BANK_ACCOUNT'],
    terms: { feeFixed: 10, feePercent: 0.002, minAmount: 50, maxAmount: 1_500_000, slaMinutes: 20, settlementModel: 'PREFUNDED', cutoff: null } },
  { code: 'SANDBOX_AE_IPP', name: 'Sandbox UAE IPP', category: 'PAYOUT', mode: 'SANDBOX', countries: ['AE'], currencies: ['AED'], payoutMethods: ['BANK_ACCOUNT'],
    terms: { feeFixed: 2, feePercent: 0, minAmount: 5, maxAmount: 200_000, slaMinutes: 30, settlementModel: 'PREFUNDED', cutoff: null } },
  { code: 'SANDBOX_TN_BANK', name: 'Sandbox Tunisia bank payout', category: 'PAYOUT', mode: 'SANDBOX', countries: ['TN'], currencies: ['TND'], payoutMethods: ['BANK_ACCOUNT'],
    terms: { feeFixed: 3, feePercent: 0.002, minAmount: 10, maxAmount: 200_000, slaMinutes: 240, settlementModel: 'PREFUNDED', cutoff: cutoffWeekday(12) } },
  { code: 'SANDBOX_LY_BANK', name: 'Sandbox Libya bank payout', category: 'PAYOUT', mode: 'SANDBOX', countries: ['LY'], currencies: ['LYD'], payoutMethods: ['BANK_ACCOUNT', 'CASH_PICKUP'],
    terms: { feeFixed: 5, feePercent: 0.002, minAmount: 10, maxAmount: 500_000, slaMinutes: 240, settlementModel: 'PREFUNDED', cutoff: cutoffWeekday(11) } },
  { code: 'SANDBOX_SWIFT', name: 'Sandbox SWIFT correspondent', category: 'PAYOUT', mode: 'SANDBOX', countries: ['*'], currencies: ['GBP', 'EUR', 'USD', 'AED', 'TRY', 'EGP', 'TND'], payoutMethods: ['BANK_ACCOUNT'],
    terms: { feeFixed: 18, feePercent: 0.001, minAmount: 100, maxAmount: 5_000_000, slaMinutes: 1440, settlementModel: 'POSTFUNDED', cutoff: cutoffWeekday(15) } },
];

const payoutAdapters = new Map<string, PayoutProvider>();
for (const d of SANDBOX_DESCRIPTORS) payoutAdapters.set(d.code, new SandboxPayoutProvider(d));
payoutAdapters.set('TAZDAN_WALLET', new TazdanWalletPayoutProvider());

export function listPayoutAdapters(): PayoutProvider[] {
  return [...payoutAdapters.values()];
}

/** The adapter for a code, refusing sandbox/mock rails in production. */
export function getPayoutProvider(code: string): PayoutProvider {
  const p = payoutAdapters.get(code);
  if (!p) throw new AppError(`Unknown payout provider ${code}`, 400);
  assertAdapterUsable(`Payout rail ${p.descriptor.name}`, p.descriptor.mode === 'PRODUCTION' ? code : `SANDBOX_${code}`);
  return p;
}

export function adapterUsable(p: PayoutProvider): boolean {
  return p.descriptor.mode === 'PRODUCTION' || !isProductionEnv();
}

// ── Circuit breaker ──────────────────────────────────────────────────
const failures = new Map<string, number[]>();
const openUntil = new Map<string, number>();
const FAIL_WINDOW_MS = 2 * 60_000;
const FAIL_THRESHOLD = 5;
const OPEN_MS = 60_000;

export function circuitOpen(code: string): boolean {
  return (openUntil.get(code) ?? 0) > Date.now();
}

function noteFailure(code: string) {
  const now = Date.now();
  const list = (failures.get(code) ?? []).filter((t) => now - t < FAIL_WINDOW_MS);
  list.push(now);
  failures.set(code, list);
  if (list.length >= FAIL_THRESHOLD) {
    openUntil.set(code, now + OPEN_MS);
    logger.warn('[providers] circuit opened', { code, failures: list.length });
  }
}

const REDACT = /(account|iban|sort|swift|wallet|name|phone|email|address)/i;
function redact(v: unknown, depth = 0): unknown {
  if (depth > 4 || v === null || v === undefined) return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => redact(x, depth + 1));
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = REDACT.test(k) && typeof val === 'string' ? `${val.slice(0, 2)}***` : redact(val, depth + 1);
    }
    return out;
  }
  return v;
}

/**
 * Run one provider operation with a timeout, a ProviderCall record and the
 * circuit breaker. Throws PROVIDER_UNAVAILABLE when the circuit is open.
 */
export async function callProvider<T>(
  code: string,
  operation: string,
  fn: () => Promise<T>,
  ctx: { entityType?: string; entityId?: string; correlationId?: string; request?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  if (circuitOpen(code)) throw new AppError(`Provider ${code} is temporarily unavailable (circuit open)`, 503, 'PROVIDER_UNAVAILABLE');
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout after ${ctx.timeoutMs ?? 15_000}ms`)), ctx.timeoutMs ?? 15_000); }),
    ]);
    void prisma.providerCall.create({
      data: {
        providerCode: code, operation, entityType: ctx.entityType ?? null, entityId: ctx.entityId ?? null,
        correlationId: ctx.correlationId ?? null, success: true, latencyMs: Date.now() - started,
        request: redact(ctx.request) as Prisma.InputJsonValue | undefined, response: redact(result) as Prisma.InputJsonValue | undefined,
      },
    }).catch(() => undefined);
    return result;
  } catch (err) {
    noteFailure(code);
    void prisma.providerCall.create({
      data: {
        providerCode: code, operation, entityType: ctx.entityType ?? null, entityId: ctx.entityId ?? null,
        correlationId: ctx.correlationId ?? null, success: false, latencyMs: Date.now() - started,
        errorCode: (err as Error).message.slice(0, 200), request: redact(ctx.request) as Prisma.InputJsonValue | undefined,
      },
    }).catch(() => undefined);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Mirror adapters into the Provider table; operator-set status is preserved. */
export async function syncProviders(): Promise<void> {
  const descriptors: ProviderDescriptor[] = listPayoutAdapters().map((a) => a.descriptor);
  descriptors.push(
    { code: 'FULUS', name: 'Fulus LYD parallel-rate feed', category: 'FX', mode: process.env.FULUS_API_TOKEN ? 'PRODUCTION' : 'SANDBOX', countries: ['LY'], currencies: ['LYD'] },
    { code: 'RESEND', name: 'Resend email', category: 'NOTIFICATION', mode: process.env.RESEND_API_KEY ? 'PRODUCTION' : 'MOCK', countries: ['*'], currencies: [] },
    { code: 'TWILIO', name: 'Twilio SMS / WhatsApp', category: 'NOTIFICATION', mode: process.env.TWILIO_ACCOUNT_SID ? 'PRODUCTION' : 'MOCK', countries: ['*'], currencies: [] },
    { code: 'KYC_MANUAL', name: 'Manual KYC review (in-house)', category: 'KYC', mode: 'PRODUCTION', countries: ['*'], currencies: [] },
    { code: 'WATCHLIST_INTERNAL', name: 'Internal watchlist screening', category: 'SANCTIONS', mode: 'PRODUCTION', countries: ['*'], currencies: [] },
    { code: 'CARD_ISSUER', name: `Card issuer (${(process.env.CARD_ISSUER || 'MOCK').toUpperCase()})`, category: 'CARD_ISSUER', mode: (process.env.CARD_ISSUER || 'MOCK').toUpperCase() === 'MOCK' ? 'MOCK' : 'PRODUCTION', countries: ['*'], currencies: [] },
    { code: 'ONRAMP', name: `Card on-ramp (${(process.env.ONRAMP_PROVIDER || 'MOCK').toUpperCase()})`, category: 'ONRAMP', mode: (process.env.ONRAMP_PROVIDER || 'MOCK').toUpperCase() === 'MOCK' ? 'MOCK' : 'PRODUCTION', countries: ['*'], currencies: [] },
    { code: 'EVM_RPC', name: 'Ethereum RPC', category: 'BLOCKCHAIN', mode: process.env.ETH_RPC_URL ? 'PRODUCTION' : 'MOCK', countries: ['*'], currencies: ['ETH', 'USDT'] },
  );
  for (const d of descriptors) {
    const defaultStatus: ProviderStatus = d.mode === 'PRODUCTION' ? 'ENABLED' : isProductionEnv() ? 'NOT_ACTIVATED' : 'ENABLED';
    await prisma.provider.upsert({
      where: { code: d.code },
      create: {
        code: d.code, name: d.name, category: d.category as any, mode: d.mode, status: defaultStatus,
        countries: d.countries, currencies: d.currencies as string[], config: (d.terms ?? {}) as Prisma.InputJsonValue,
      },
      update: {
        name: d.name, category: d.category as any, mode: d.mode, countries: d.countries, currencies: d.currencies as string[],
        config: (d.terms ?? {}) as Prisma.InputJsonValue,
        // A sandbox rail can never be ENABLED in production, whatever was stored.
        ...(isProductionEnv() && d.mode !== 'PRODUCTION' ? { status: 'NOT_ACTIVATED' as ProviderStatus } : {}),
      },
    });
  }
}

/** Run health checks for payout adapters and record the result on Provider. */
export async function checkProviderHealth(): Promise<void> {
  for (const a of listPayoutAdapters()) {
    const t = Date.now();
    let ok = false;
    try { ok = (await a.health()).ok; } catch { ok = false; }
    await prisma.provider.update({
      where: { code: a.descriptor.code },
      data: { lastHealthAt: new Date(), lastHealthOk: ok && !circuitOpen(a.descriptor.code), lastLatencyMs: Date.now() - t },
    }).catch(() => undefined);
  }
}
