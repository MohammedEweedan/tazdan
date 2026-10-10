# Payout provider integration guide

How to connect a licensed payout partner so a remittance corridor can go `LIVE`. Status: **internal implementation complete; external provider activation required.** No live partner is connected.

## What Tazdan already does

Quotes, compliance, risk, routing, treasury reservation, payout orchestration, callbacks, polling, refunds, reconciliation and operator tooling all exist and are exercised end to end against sandbox rails (`remittance.golden.test.ts`, `remittance.api.test.ts`). A partner adapter replaces a sandbox rail; nothing else changes.

## The interface (`server/src/services/providers/types.ts`)

```ts
interface PayoutProvider {
  descriptor: ProviderDescriptor;           // code, name, category 'PAYOUT', mode 'PRODUCTION', countries, currencies, payoutMethods, terms
  health(): Promise<{ ok: boolean; latencyMs: number; detail?: string }>;
  quoteFee(amount: string, currency): Promise<{ fee: string; currency }>;
  execute(req: PayoutRequest): Promise<{ providerRef: string; status: 'SUBMITTED'|'PAID'|'FAILED'|'RETURNED'; failureReason?: string; raw?: unknown }>;
  status(providerRef: string): Promise<PayoutResult>;
  cancel(providerRef: string): Promise<{ cancelled: boolean; reason?: string }>;
  statement(from: Date, to: Date): Promise<Array<{ providerRef, reference, amount, currency, status, fee, at }>>;
  parseCallback?(headers, rawBody): Promise<{ providerRef, reference?, status, failureReason?, raw }>;
}
```

`PayoutRequest.reference` is Tazdan's idempotency key at the partner — the partner must treat a repeated reference as the same payout.

## Requirements of the partner API

| Need | Why |
|---|---|
| Idempotent create keyed by our reference | Retries after timeouts must never pay twice |
| Status query by our reference or their id | Polling fallback when callbacks are lost |
| Signed callbacks (HMAC or similar over the raw body) | `parseCallback` must verify before any state change |
| Statement / transaction report API or file | Daily reconciliation |
| Cancel while not yet paid (best effort) | Customer cancellation |
| Return notifications after payment | Reversal and refund handling |
| Sandbox environment | Run the golden tests before activation |

## Steps

1. Contract, KYB with the partner, settlement terms (prefunded or post-funded), cut-offs, limits.
2. Implement the adapter in `services/providers/adapters/<partner>.ts` with mode `PRODUCTION`; secrets only from environment variables.
3. Register it in `services/providers/registry.ts` with accurate `terms` (fees, limits, SLA, cut-off, settlement model) — the route engine uses them.
4. Point `parseCallback` at `POST /api/remittance/webhooks/<CODE>`; the raw body is preserved for signature checks.
5. Run the golden and API suites against the partner's sandbox (temporarily registering the adapter as `SANDBOX`).
6. In production: enable the provider (Cockpit → Providers), record the prefund (Treasury) for prefunded partners, set target and minimum, then set the corridor `LIVE` (refused unless an enabled production rail serves it).
7. Watch the first days: provider call log, reconciliation exceptions, delivery times.

## Do not

- Report `PAID` from `execute` unless the partner confirms final credit.
- Retry `execute` blindly after an unknown outcome — leave it `SUBMITTED` and resolve by status or statement.
