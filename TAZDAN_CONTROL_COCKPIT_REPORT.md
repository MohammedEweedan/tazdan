# Tazdan — Control Cockpit report

## What was built

A staff operating console on the website at `/admin` — 32 routes — backed by 70 new `/api/cockpit` endpoints and the 88 existing `/api/admin` endpoints, all permission-gated. It sits alongside the 25 existing mobile admin screens, which were kept. Details: [docs/CONTROL_COCKPIT.md](docs/CONTROL_COCKPIT.md).

## Coverage

| Domain | Cockpit pages | Key actions |
|---|---|---|
| Command | Overview, Search, Assistant | Live KPIs and alerts; global search; AI questions |
| Customers | Customers, Customer 360 | Freeze/unfreeze, revoke sessions, limits, KYC |
| Business | Businesses, Business detail | KYB decisions, batch compliance release/reject |
| Money | Transactions (+detail), Ledger, Remittance (+detail), FX, Treasury | Review decisions, retry, refund, corridor status/pricing, FX override request, treasury movements |
| Operations | Deposit/withdrawal/KYC queues, Approvals, Reconciliation, Providers, Controls | Approve/reject, maker-checker decisions, resolve exceptions, provider status, kill switches |
| Risk | Compliance (+case), Fraud | Case workflow, screening review, rule edits, watchlist import, link analysis |
| Service & finance | Support, Finance, Forecasts | Replies, assign/resolve, AI drafts; analytics |
| Platform | System health, Security, Audit, Staff & roles | Monitoring; role assignment |

## Controls built into the console

12 roles and 49 permissions; reason required for every state change; audit with actor, IP, before/after; dual control (requester cannot approve); kill switches with expiry; PII masking by permission; sandbox/mock status always visible; no direct balance edits.

## Verification

`cockpit.test.ts` (6 tests) plus the money-domain suites; Next.js production build (all 32 routes compile); every page rendered against live API data and screenshotted at 1440 px dark, selected pages light and at 390 px; layout issues found in review (clipped tables, colliding axis labels, misleading forecast bands, unscaled rate charts, wrapping headers) were fixed.

## Limits

No external paging/alerting from the console; read-only fraud and finance analytics; English and Arabic interface strings (data shown as stored).
