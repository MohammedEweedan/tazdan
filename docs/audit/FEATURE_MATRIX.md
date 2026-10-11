# Feature matrix

State as of 2026-10-07. **Ready** = works end to end in this codebase, guarded and tested, no external activation needed. **Ready (test gap)** = works and is guarded, but lacks a dedicated automated test. **Sandbox** = complete internally, runs only against simulated rails until a partner is activated. **Off in production** = refuses to run in production until configured. Test file names are under `server/src/__tests__/`.

## Customer (mobile app)

| Capability | Surfaces | State | Tests | External dependency |
|---|---|---|---|---|
| Registration, login, sessions, sign out other devices | mobile, API | Ready | `integration.auth.test.ts` | Email (Resend) for codes |
| Email verification, password reset (6-digit code), 2FA (TOTP) with recovery | mobile, API | Ready (test gap) | — | Email |
| Phone OTP | mobile, API | Off in production until configured | — | Twilio or Meta |
| KYC document upload, manual review | mobile, cockpit | Ready | — | None for manual review; KYC vendor optional |
| Wallets and balances | mobile, API | Ready | `integration.wallet.test.ts` | — |
| Internal transfer (`/transactions/transfer`) with risk-based step-up | mobile | Ready (test gap for step-up) | `concurrency.money.test.ts` | — |
| Chat payments | mobile | Ready (test gap for step-up) | `concurrency.money.test.ts` | — |
| Claim links (with PIN) | mobile | Ready (test gap for PIN cap) | `concurrency.money.test.ts`, `balanceMutations.test.ts` | — |
| Bank deposit (customer transfers to a Tazdan account, staff confirm) | mobile, cockpit | Ready once real accounts are entered | `balanceMutations.test.ts`, `concurrency.money.test.ts` | Real Tazdan bank accounts (see CL-20) |
| Card / gateway deposit (on-ramp) | mobile | Off in production | — | PSP (Stripe or similar) |
| Withdrawal to bank / crypto, with screening and risk engine | mobile, cockpit | Ready (bank: manual payout by staff; crypto: on-chain broadcast for supported networks, refused on risk review) | `integration.wallet.test.ts`, `concurrency.money.test.ts` | Bank payout process; RPC providers and KMS for crypto; watchlist data |
| Swap / convert between own wallets | mobile | Ready (test gap) | — | Live price feeds |
| Buy / sell crypto | mobile | Ready with a known risk: simulated fill when the hedge venue is unreachable | — | Binance (geo-blocked from production host) |
| P2P trading with escrow, disputes | mobile, admin | Ready (test gap for dispute outcome) | `concurrency.money.test.ts` | — |
| Send abroad (remittance) | mobile, API | Sandbox | `remittance.golden.test.ts`, `remittance.api.test.ts` | Licensed payout partner per corridor |
| Budgets / savings goals | mobile | Ready (existing) | — | — |
| Cards (virtual/physical) | mobile | Off in production | — | Card issuer |
| Referrals | mobile | Ready (test gap) | — | — |
| Recurring buy | mobile | Ready (existing; depends on buy) | — | As buy |

## Business

| Capability | Surfaces | State | Tests | External dependency |
|---|---|---|---|---|
| Business profile, KYB submission and review | mobile, cockpit | Ready | `business.payouts.test.ts` (KYB gate) | KYB vendor optional |
| Team with roles and invitations | mobile (list, invite, role, remove, accept) | Ready (test gap) | — | — |
| Bulk pay to Tazdan customers: preview, reservation, maker-checker (approve/reject in the app), compliance hold, execution | mobile, API, cockpit | Ready | `business.payouts.test.ts` | — |
| API keys (scoped, hashed, expiring, role-bound) | mobile, API | Ready | `business.payouts.test.ts` | — |
| Public API `/api/v1` (balances, rates, payouts, webhooks) with idempotency | API | Ready | `business.payouts.test.ts` | — |
| Signed webhooks with retries and SSRF guard | API | Ready | `business.payouts.test.ts` | — |
| Payouts to external bank accounts | — | Not built (use remittance) | — | Payout partner |

## Operations (Control Cockpit, web)

| Capability | State | Tests |
|---|---|---|
| Staff login, 12 roles, 49 permissions, per-route permission checks | Ready | `cockpit.test.ts` |
| Global search, customer 360, freeze/unfreeze, session revocation, PII masking by permission | Ready | `cockpit.test.ts` |
| Transactions, ledger journals and accounts | Ready | — |
| Deposit, withdrawal and KYC queues | Ready | — |
| Maker-checker approvals (ledger adjustment, goodwill refund, FX override) | Ready | `cockpit.test.ts` |
| Kill switches (9 features + currency, corridor, provider, user scopes) | Ready | `cockpit.test.ts`, `integration.wallet.test.ts` |
| Remittance centre: queue, review decisions, retry, refunds, corridor status and pricing | Ready (sandbox rails) | `remittance.golden.test.ts` |
| FX rates, override workflow | Ready (test gap) | — |
| Treasury pools, movements, thresholds, alerts | Ready | `remittance.golden.test.ts` |
| Providers: mode, health, circuit breaker, call log, status control | Ready | — |
| Reconciliation: provider statements, integrity checks, resolution | Ready | `remittance.golden.test.ts`, `ledger.reconcile.test.ts` |
| Compliance: cases, screening review, rule editing, watchlist import | Ready | `remittance.golden.test.ts`, `business.payouts.test.ts` |
| Fraud: signals, linked-account graph, risky pending withdrawals | Ready (read-only views) | — |
| Support: escalations with customer context, reply, assign, resolve | Ready | — |
| Finance and forecasts | Ready (analytics) | — |
| Businesses: KYB decisions, batch compliance release/reject | Ready | `business.payouts.test.ts` |
| System health, security events, audit log, staff roles | Ready | — |
| AI assistant and drafts | Off in production by default | `ai.assistant.test.ts` |

## Platform controls

| Control | State | Tests |
|---|---|---|
| Balanced double-entry ledger, enforced at commit by the database | Ready | `remittance.golden.test.ts`, `ledger.reconcile.test.ts` |
| Append-only evidence tables (ledger, audit, transitions, security events, treasury movements…) | Ready — **rehearse on production data before deploy** | full suite runs with triggers |
| Conditional state transitions and lifecycle log | Ready | `concurrency.money.test.ts` |
| Idempotency keys (remittance, business batches, public API) | Ready | `remittance.golden.test.ts`, `remittance.api.test.ts`, `business.payouts.test.ts` |
| Mock/sandbox adapters refused in production | Ready (test gap) | — |
| Trading halt on ledger drift | Ready | `ledger.reconcile.test.ts` |
| CI gating of deploys, migration drift check, route inventory, secret scan | Ready | CI |
