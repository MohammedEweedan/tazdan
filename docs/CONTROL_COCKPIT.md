# Control Cockpit

The staff operating console, on the website at `/admin` (`client/src/app/admin`), served by `/api/cockpit` (70 endpoints) and the permission-gated `/api/admin` routes (88). It complements, and does not replace, the existing mobile admin screens. Interface strings in English and Arabic; light and dark themes; `robots.txt` disallows `/admin` and every page is `noindex`.

## Access

Staff sign in with their staff account. Every route checks a specific permission; navigation shows only pages that exist and that the person may use. An ADMIN account without explicit roles is treated as SUPER_ADMIN for compatibility and the cockpit shows a banner asking for least-privilege roles to be assigned. Tokens are held in `sessionStorage` and the cockpit calls the API origin directly so staff IPs reach the audit trail.

## Roles

| Role | Permissions | Intended for |
|---|---|---|
| SUPER_ADMIN | 49 (all) | Break-glass, staff management |
| EXECUTIVE | 18 | Read-only oversight, finance, forecasts |
| OPERATIONS | 23 | Queues, remittance operations, providers, controls |
| FINANCE | 17 | Finance, reconciliation, ledger, adjustments |
| TREASURY | 12 | Pools, movements, FX |
| COMPLIANCE | 22 | Cases, decisions, rules, watchlists, KYB |
| AML_ANALYST | 10 | Cases and screening review |
| FRAUD_ANALYST | 9 | Fraud views, cases, disputes |
| SUPPORT | 8 | Escalations, replies, customer context |
| SECURITY | 9 | Security events, sessions, controls |
| TECH_OPS | 5 | System health, providers |
| AUDITOR | 19 | Read-only audit, ledger, approvals |

## Pages (32 routes)

| Group | Page | What it does |
|---|---|---|
| Command | Overview | Live KPIs, queues, alerts, 30-day series |
| | Assistant | AI questions over live data; AI activity log |
| | Search | Customers, transactions, references, addresses |
| Customers & money | Customers, Customer 360 | Profile, wallets, ledger, activity, sessions, devices, risk, cases; freeze/unfreeze, revoke sessions, limits, KYC |
| | Businesses, Business detail | KYB decisions, team, keys, webhooks, batches (compliance release/reject), payouts, audit |
| | Transactions, Transaction detail | Every money object with lifecycle, ledger groups and audit |
| | Remittance, Transfer detail | Review queue, corridors (status, pricing), providers, transfers; approve/reject, retry, refund (goodwill via approval) |
| | FX | Effective vs live rates, overrides with history, activity |
| | Treasury | Pools, alerts, movements (record), settlements, ledger positions |
| | Ledger | Accounts by type and fund class, journals |
| Operations | Deposits, Withdrawals, KYC | Approval queues (withdrawals show risk notes) |
| | Approvals | Maker-checker queue; request and decide |
| | Reconciliation | Runs, exceptions, resolution |
| | Providers | Registry, mode, health, circuit breaker, call log, status |
| | Controls | Kill switches by feature, currency, corridor, provider, user |
| Risk | Compliance, Case detail | Cases, screening review, rules, watchlists; AI case summary draft |
| | Fraud | Signals, linked-account graph, risky withdrawals, failed logins |
| Service & finance | Support | Escalations with customer context; reply, assign, resolve; AI reply draft |
| | Finance | Volume, revenue, estimated provider costs, margin, take rate |
| | Forecasts | Projections with 80% ranges (shown only with enough history); treasury cover |
| Platform | System health | Latency percentiles, error rates, workers |
| | Security | Security events, access denials |
| | Audit | Every privileged action with actor, reason, before/after |
| | Staff & roles | Assign roles |

## Operating principles built in

- Every action that changes state asks for a reason, which is written to the audit log with the actor, IP and before/after values.
- Sensitive actions are dual-controlled: the requester cannot approve their own request.
- No page edits a balance directly: corrections are ledger adjustments through approvals.
- Sandbox and mock status is always visible (corridor and provider badges, transfer banners).
- Customer contact details are masked for staff without `customers.pii`.

## Verification

`cockpit.test.ts` (RBAC, kill switches, maker-checker, freeze, PII masking, search/overview); remittance, reconciliation, business and AI suites cover the operations behind the money pages. Every page was rendered against live API data and screenshotted at 1440 px (dark), selected pages in light mode and at 390 px; the Next.js production build compiles all 32 routes.
