# Testing

## Server (Jest, `server/src/__tests__`)

**20 suites, 151 tests — all pass** against a disposable PostgreSQL database (`RUN_DB_TESTS=1`; CI always runs them). Without a database, 103 pass and the database suites are skipped.

| Suite | Covers |
|---|---|
| `integration.auth.test.ts` | Login, refresh rotation, reuse detection, session list, sign out other devices |
| `integration.wallet.test.ts` | Wallets, withdrawal reservation/cancel, kill switch, withdrawal screening and risk |
| `concurrency.money.test.ts` | Claim links, P2P cancellation, deposit confirmation, withdrawals, chat payments under concurrent requests |
| `balanceMutations.test.ts` | Deposit confirmation, manual adjustments, claim-link ledger |
| `cockpit.test.ts` | RBAC, kill-switch audit, maker-checker, freeze, PII masking, search/overview |
| `remittance.golden.test.ts` | Tripoli→London and London→Tripoli end to end; failed payout refund; idempotency and single-use quotes; ledger balance and clearing; integrity exceptions |
| `remittance.api.test.ts` | Customer HTTP flow used by the app; step-up on unknown device; cancellation refund; no internal fields exposed |
| `ledger.reconcile.test.ts` | No false drift under concurrent postings |
| `business.payouts.test.ts` | KYB gate, preview, reservation, journals, idempotency, maker-checker, compliance hold, step-up, API keys, `/api/v1`, signed webhooks, HTTP shape |
| `ai.assistant.test.ts` | Tool scoping, denied tools never run, audit trail, draft acceptance rules, OFF switch (client mocked) |
| `ledger.test.ts`, `financialFlows.ledger.test.ts` | Ledger posting rules and financial flow journals |
| `aml.test.ts`, `hardening.test.ts`, `auth.test.ts` | AML helpers, earlier hardening checks, auth helpers |
| `decimal.test.ts`, `priceEngine.test.ts`, `fulus.test.ts`, `geo.test.ts`, `depositVerification.test.ts` | Decimal handling, price engine, Fulus feed, geo data, on-chain deposit verification |

### Running

```bash
# disposable databases only — never a shared or production database
createdb tazdan_test
cd server
DATABASE_URL=postgresql://…/tazdan_test npx prisma migrate deploy
RUN_DB_TESTS=1 DATABASE_URL=postgresql://…/tazdan_test npx jest --forceExit
```

Tests create their own uniquely marked data and pin FX rates; sandbox SLAs are compressed with `SANDBOX_TIME_SCALE`.

### Conventions

- Money tests assert the ledger: every journal sums to zero; wallet and ledger agree.
- Concurrency tests fire requests in parallel and assert money moves exactly once.
- A bug fix comes with a test that fails on the old code where practical (example: `ledger.reconcile.test.ts` failed 3 of 3 runs against the old reconciliation).

### Known gaps

Listed in [audit/TECHNICAL_DEBT.md](audit/TECHNICAL_DEBT.md): `/transfers/send`, step-up decision unit tests, claim-link PIN cap, dispute outcome, referral claim, swap and swap quote, FX override, production adapter refusal, admin transaction freeze, business invitations, the instant on-chain withdrawal refusal.

## CI gates

Migration drift (migrations rebuilt on a shadow database must equal the schema), type-checks for all three apps, server tests, route-inventory floor, client production build, `npm audit` (server production dependencies blocking at high), committed-secret scan. Deploys run only after CI passes on `master`.

## Mobile and website

No automated UI tests. Verification in this programme: type-checks for both; Next.js production build; the Control Cockpit rendered against live API data and screenshotted at 1440 px (dark), selected pages in light mode and at 390 px. **Mobile changes have not been run on a device** — a device test pass is a release requirement ([audit/LAUNCH_BLOCKERS.md](audit/LAUNCH_BLOCKERS.md)).
