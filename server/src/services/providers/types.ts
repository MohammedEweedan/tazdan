/**
 * Provider-neutral interfaces. Core business logic talks to these; each
 * vendor (or the sandbox) is an adapter behind them. Every adapter declares
 * its mode: PRODUCTION, SANDBOX or MOCK. SANDBOX and MOCK adapters are refused
 * in production by the registry (see guard.ts).
 */
import type { Currency } from '@prisma/client';

export type AdapterMode = 'PRODUCTION' | 'SANDBOX' | 'MOCK';

export interface ProviderHealth {
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface ProviderDescriptor {
  code: string;
  name: string;
  category: 'PAYOUT' | 'REMITTANCE' | 'BANK' | 'PSP' | 'KYC' | 'SANCTIONS' | 'AML' | 'CARD_ISSUER' | 'VASP' | 'CUSTODY' | 'BLOCKCHAIN' | 'FX' | 'NOTIFICATION' | 'ONRAMP' | 'OFFRAMP';
  mode: AdapterMode;
  countries: string[];
  currencies: Currency[];
  payoutMethods?: string[];
  /** Commercial terms used by the route engine (non-secret). */
  terms?: {
    feeFixed: number;          // in payout currency
    feePercent: number;        // fraction of payout amount
    fxMarkupPercent?: number;  // provider FX cost if they convert
    minAmount: number;         // payout currency
    maxAmount: number;
    slaMinutes: number;        // typical time to beneficiary credit
    settlementModel: 'PREFUNDED' | 'POSTFUNDED' | 'INTERNAL';
    cutoff?: { tz: string; weekdaysOnly: boolean; endHourUtc: number } | null;
  };
}

// ── Payout ──────────────────────────────────────────────────────────
export interface PayoutRequest {
  transferId: string;
  reference: string;           // our idempotency key at the provider
  amount: string;              // decimal string, payout currency
  currency: Currency;
  beneficiary: {
    fullName: string;
    country: string;
    payoutMethod: string;
    bankName?: string | null;
    accountNumber?: string | null;
    iban?: string | null;
    sortCode?: string | null;
    swift?: string | null;
    mobileWallet?: string | null;
    tazdanUserId?: string | null;
  };
  purpose: string;
  sender: { fullName: string; country: string | null };
}

export type PayoutStatus = 'SUBMITTED' | 'PAID' | 'FAILED' | 'RETURNED';

export interface PayoutResult {
  providerRef: string;
  status: PayoutStatus;
  failureReason?: string;
  raw?: unknown;
}

export interface PayoutProvider {
  readonly descriptor: ProviderDescriptor;
  health(): Promise<ProviderHealth>;
  quoteFee(amount: string, currency: Currency): Promise<{ fee: string; currency: Currency }>;
  execute(req: PayoutRequest): Promise<PayoutResult>;
  status(providerRef: string): Promise<PayoutResult>;
  cancel(providerRef: string): Promise<{ cancelled: boolean; reason?: string }>;
  /** Provider statement for reconciliation: what the provider says happened. */
  statement(from: Date, to: Date): Promise<Array<{ providerRef: string; reference: string; amount: string; currency: Currency; status: PayoutStatus; fee: string; at: Date }>>;
  /** Verify and parse a provider callback (signature checked by the adapter). */
  parseCallback?(headers: Record<string, string | undefined>, rawBody: string): Promise<{ providerRef: string; reference?: string; status: PayoutStatus; failureReason?: string; raw: unknown }>;
}

// ── Sanctions / PEP screening ───────────────────────────────────────
export interface ScreeningSubject {
  name: string;
  country?: string | null;
  dateOfBirth?: string | null;
  walletAddress?: string | null;
}
export interface ScreeningMatch {
  listName: string;
  entryId: string;
  matchedName: string;
  score: number;      // 0..1
  reason: string;
}
export interface ScreeningProvider {
  readonly descriptor: ProviderDescriptor;
  screen(subject: ScreeningSubject): Promise<{ matches: ScreeningMatch[]; listsChecked: string[] }>;
}
