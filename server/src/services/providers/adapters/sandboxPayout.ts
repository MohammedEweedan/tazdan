/**
 * SANDBOX payout rails.
 *
 * INTERNAL IMPLEMENTATION COMPLETE — EXTERNAL PROVIDER ACTIVATION REQUIRED.
 * These adapters stand in for real payout partners so the whole remittance
 * lifecycle (submit → callback → settle → reconcile) can be exercised end to
 * end. They are labelled SANDBOX everywhere, and the registry refuses them in
 * production. They move no real money.
 *
 * Determinism: the outcome is decided at submission and encoded in the
 * provider reference, so status survives restarts. Time is compressed:
 * SANDBOX_TIME_SCALE (default 60) means one SLA minute passes in one second.
 *
 * Magic payout amounts (the cents of the payout amount):
 *   .13 → FAILED   (BENEFICIARY_ACCOUNT_CLOSED)
 *   .31 → RETURNED after being paid (BENEFICIARY_BANK_RETURN)
 *   .77 → statement fee differs from the quoted fee (reconciliation FEE_MISMATCH)
 *   .88 → statement amount differs by 0.01 (reconciliation AMOUNT_MISMATCH)
 */
import crypto from 'crypto';
import type { Currency } from '@prisma/client';
import { prisma } from '../../../utils/prisma';
import type { PayoutProvider, PayoutRequest, PayoutResult, PayoutStatus, ProviderDescriptor, ProviderHealth } from '../types';

const timeScale = () => Math.max(1, Number(process.env.SANDBOX_TIME_SCALE ?? 60));

export function sandboxCallbackSecret(): string {
  return process.env.SANDBOX_CALLBACK_SECRET || 'tazdan-sandbox-callback-secret-not-for-production';
}

function cents(amount: string): string {
  const [, frac = '00'] = amount.split('.');
  return (frac + '00').slice(0, 2);
}

interface DecodedRef { code: string; submittedAt: number; outcome: 'P' | 'F' | 'R'; reference: string }

function encodeRef(code: string, outcome: 'P' | 'F' | 'R', reference: string): string {
  return `SBX-${code}-${Date.now().toString(36)}-${outcome}-${reference}`;
}

function decodeRef(ref: string): DecodedRef | null {
  const m = ref.match(/^SBX-([A-Z0-9_]+)-([a-z0-9]+)-([PFR])-(.+)$/);
  if (!m) return null;
  return { code: m[1], submittedAt: parseInt(m[2], 36), outcome: m[3] as 'P' | 'F' | 'R', reference: m[4] };
}

export class SandboxPayoutProvider implements PayoutProvider {
  constructor(readonly descriptor: ProviderDescriptor) {}

  async health(): Promise<ProviderHealth> {
    return { ok: true, latencyMs: 5, detail: 'Sandbox rail — simulated, no real payout' };
  }

  async quoteFee(amount: string, currency: Currency) {
    const t = this.descriptor.terms!;
    const fee = t.feeFixed + Number(amount) * t.feePercent;
    return { fee: fee.toFixed(2), currency };
  }

  async execute(req: PayoutRequest): Promise<PayoutResult> {
    const c = cents(req.amount);
    const outcome: 'P' | 'F' | 'R' = c === '13' ? 'F' : c === '31' ? 'R' : 'P';
    const providerRef = encodeRef(this.descriptor.code, outcome, req.reference);
    if (outcome === 'F') {
      return { providerRef, status: 'FAILED', failureReason: 'BENEFICIARY_ACCOUNT_CLOSED (sandbox magic amount .13)', raw: { sandbox: true } };
    }
    return { providerRef, status: 'SUBMITTED', raw: { sandbox: true, sla: this.descriptor.terms?.slaMinutes } };
  }

  async status(providerRef: string): Promise<PayoutResult> {
    const d = decodeRef(providerRef);
    if (!d) return { providerRef, status: 'FAILED', failureReason: 'Unknown sandbox reference' };
    if (d.outcome === 'F') return { providerRef, status: 'FAILED', failureReason: 'BENEFICIARY_ACCOUNT_CLOSED' };
    const slaMs = ((this.descriptor.terms?.slaMinutes ?? 5) * 60_000) / timeScale();
    const elapsed = Date.now() - d.submittedAt;
    if (elapsed < slaMs) return { providerRef, status: 'SUBMITTED' };
    if (d.outcome === 'R' && elapsed >= slaMs * 2) return { providerRef, status: 'RETURNED', failureReason: 'BENEFICIARY_BANK_RETURN' };
    return { providerRef, status: 'PAID' };
  }

  async cancel(providerRef: string) {
    const s = await this.status(providerRef);
    return s.status === 'SUBMITTED' ? { cancelled: true } : { cancelled: false, reason: `Payout is ${s.status}` };
  }

  /**
   * The sandbox "provider statement": what this rail would report for the
   * window. Built from payouts submitted to it, with the documented magic
   * discrepancies applied so reconciliation has something real to catch.
   */
  async statement(from: Date, to: Date) {
    const payouts = await prisma.remittancePayout.findMany({
      where: { providerCode: this.descriptor.code, submittedAt: { gte: from, lt: to }, providerRef: { not: null } },
      include: { transfer: { select: { reference: true } } },
    });
    const out: Array<{ providerRef: string; reference: string; amount: string; currency: Currency; status: PayoutStatus; fee: string; at: Date }> = [];
    for (const p of payouts) {
      const s = await this.status(p.providerRef!);
      const amount = p.amount.toString();
      const c = cents(Number(amount).toFixed(2));
      const { fee } = await this.quoteFee(amount, p.currency);
      out.push({
        providerRef: p.providerRef!,
        reference: p.transfer.reference,
        amount: c === '88' ? (Number(amount) + 0.01).toFixed(2) : Number(amount).toFixed(2),
        currency: p.currency,
        status: s.status,
        fee: c === '77' ? (Number(fee) + 0.5).toFixed(2) : fee,
        at: p.submittedAt ?? p.createdAt,
      });
    }
    return out;
  }

  async parseCallback(headers: Record<string, string | undefined>, rawBody: string) {
    const sig = headers['x-sandbox-signature'] ?? '';
    const expected = crypto.createHmac('sha256', sandboxCallbackSecret()).update(rawBody).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Invalid sandbox callback signature');
    const body = JSON.parse(rawBody) as { providerRef: string; status: PayoutStatus; failureReason?: string };
    return { providerRef: body.providerRef, status: body.status, failureReason: body.failureReason, raw: body };
  }
}

/** Sign a sandbox callback body (used by the sandbox worker and tests). */
export function signSandboxCallback(body: string): string {
  return crypto.createHmac('sha256', sandboxCallbackSecret()).update(body).digest('hex');
}
