# Working features

Features verified to work end to end in this codebase on 2026-10-07, by automated tests against a real PostgreSQL database unless stated. "Verified by" names the test; where it says "type-check and review", the feature works by inspection but has no dedicated test (listed in [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md)).

| Feature | Verified by |
|---|---|
| Login, refresh-token rotation, session list, sign out other devices, reuse detection | `integration.auth.test.ts` |
| Wallet list; withdrawal request reserves funds once, writes one history row, releases on cancel | `integration.wallet.test.ts` |
| Withdrawals refused while the withdrawals kill switch is on | `integration.wallet.test.ts` |
| Withdrawal to a watchlisted wallet address flagged for the approver, with a compliance case | `integration.wallet.test.ts` |
| Parallel withdrawals never reserve more than the balance | `concurrency.money.test.ts` |
| Deposit confirmed concurrently is credited once; admin confirmation credits wallet and ledger | `concurrency.money.test.ts`, `balanceMutations.test.ts` |
| Claim link pays once under concurrent claims; cannot be both claimed and cancelled; redemption posts the ledger | `concurrency.money.test.ts`, `balanceMutations.test.ts` |
| Chat payments: non-positive amounts move nothing; parallel payments never overspend | `concurrency.money.test.ts` |
| P2P trade refunded once when cancelled concurrently (single-debit escrow) | `concurrency.money.test.ts` |
| Manual credit posts a controlled adjustment journal; large ones need a second approver | `balanceMutations.test.ts`, `cockpit.test.ts` |
| Staff RBAC: customers refused; each role limited to its permissions | `cockpit.test.ts` |
| Kill-switch changes record actor, reason and previous state | `cockpit.test.ts` |
| Maker-checker: requester cannot approve; approval executes exactly once | `cockpit.test.ts` |
| Freezing a customer keeps wallet reservations and blocks their money movement | `cockpit.test.ts` |
| Contact details masked for staff without `customers.pii` | `cockpit.test.ts` |
| Cockpit search and live overview | `cockpit.test.ts` |
| Remittance Tripoli → London (£1,000): quote, review, routing, treasury, payout, ledger, reconciliation, completion, full lifecycle | `remittance.golden.test.ts` |
| Remittance London → Tripoli into a Tazdan wallet | `remittance.golden.test.ts` |
| Failed payout refunded in full, fee included | `remittance.golden.test.ts` |
| Remittance idempotency; a quote is spent once under concurrency | `remittance.golden.test.ts` |
| Ledger balanced; clearing equals transfers in flight; integrity exceptions opened once and cleared after repair | `remittance.golden.test.ts` |
| Review decision closes the review case | `remittance.golden.test.ts` |
| Customer remittance HTTP flow used by the app; idempotent retry; step-up on an unknown device; cancellation refunded in full; no internal fields exposed | `remittance.api.test.ts` |
| Ledger reconciliation reports no false drift under concurrent postings | `ledger.reconcile.test.ts` |
| Business payouts: KYB gate, preview validation, reservation, balanced journals, idempotent retry | `business.payouts.test.ts` |
| Business maker-checker (maker cannot approve), compliance release, cancellation and rejection release funds; stale review case closed | `business.payouts.test.ts` |
| Single-signatory large batch requires step-up | `business.payouts.test.ts` |
| Screening hit holds a batch; compliance release executes it and closes the case | `business.payouts.test.ts` |
| API keys scoped and bound to the creator's role; revoked keys refused; `/api/v1` payouts require an Idempotency-Key | `business.payouts.test.ts` |
| Webhooks delivered with a verifiable signature | `business.payouts.test.ts` |
| AI assistant: only permitted tools offered; denied tools never run; every call logged; drafts need the right person to accept, once; OFF switch | `ai.assistant.test.ts` |
| Swap priced from live feeds with a slippage guard; Convert screen performs the real swap | type-check and review |
| Mobile Send abroad flow | type-check; HTTP contract tested; not yet run on a device |
