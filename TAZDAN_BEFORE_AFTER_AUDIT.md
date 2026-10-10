# Tazdan — before and after audit

Programme: 2026-10-06 → 2026-10-07, branch `hardening/p0-stop-the-bleeding` (uncommitted), starting at commit `01de005`. Baseline: [docs/audit/BASELINE.md](docs/audit/BASELINE.md). Every change, with problem, root cause, files, tests, risk and UI impact: [docs/audit/CHANGE_LEDGER.md](docs/audit/CHANGE_LEDGER.md) (46 entries). All numbers below were measured.

## Headline

Before: a feature-rich app whose money paths contained defects that could release reserved funds, create money, skip security checks or show customers things that were not true — and no remittance capability, no staff web console, no business backend. After: those defects fixed and tested, the ledger enforced by the database, and an operating platform (remittance, routing, treasury, reconciliation, risk and compliance, providers, business payouts and API, Control Cockpit, audited AI) built around the existing product without redesigning it. External partners and licences are still required; nothing here claims otherwise.

## Measured before / after

| Measure | Before | After |
|---|---|---|
| Database models / enums / migrations | 62 / 43 / 50 | 96 / 51 / 53 |
| API endpoints | 287 | 405 |
| Staff endpoints with a specific permission | 0 (89 role-only) | 163 (0 role-only) |
| Mobile screens | 79 | 82 |
| Website pages (staff console) | 19 (0) | 51 (32) |
| Server tests passing (with database) | 112 (2 suites could not load) | 151 of 151 |
| Remittance corridors | 0 | 12 (sandbox) |
| Risk rules wired to money flows | 0 | 17 rules; remittances, business payouts, withdrawals |

## Final feature table

| Capability | Original state | Final state | Tests | Production readiness | External dependency | UI changed? | Reason |
|---|---|---|---|---|---|---|---|
| Admin freeze/unfreeze | Rewrote wallet reservations | Status + user kill switch; reservations untouched | `cockpit.test.ts` | Ready | — | No | Money creation path |
| Admin transaction hold | Unconditional status edits | Conditional transitions, audited | gap | Ready | — | No | Records could contradict balances |
| `/transfers/send` (USDT) | Failed (invalid enum query) | Works | gap | Ready | — | No | Broken default currency |
| Transfers, chat payments step-up | Skipped; client claims stored | Risk-based step-up; mobile prompts for code | partial | Ready | Email/TOTP | Yes (existing modal shown) | Account-takeover loss |
| Sessions / sign out others | Read unused table; revoked nothing | Real sessions, instant revocation | `integration.auth` | Ready | Redis (optional) | No | Stolen sessions could not be ended |
| P2P escrow | Double reservation; money creation for long-tail assets | Single escrow module | `concurrency.money` | Ready | — | No | Money creation |
| P2P disputes | Could not move escrow | Buyer/seller outcome moves escrow | gap | Ready | — | Yes (two buttons) | Disputes unresolvable |
| Referral claims | Race → double pay | Locked claim | gap | Ready | — | No | Double payout |
| Swap / Convert | Receipt with invented hash; Convert screen used a random rate and faked success | Live executable prices, quote endpoint, slippage guard; real swap | gap | Ready | Price feeds | Same layout, real data | Customers told money moved when it did not |
| Deposit bank accounts | 7 fabricated accounts seeded and hardcoded; fake IBAN on Receive | None seeded; admin-entered only; migration deactivates placeholders | migration applied | Ready once accounts entered | Real bank accounts | Yes (honest empty states) | Money could be wired to strangers |
| Ledger reconciliation | False drift could halt trading | Single-snapshot check | `ledger.reconcile` | Ready | — | No | Spurious platform halt |
| Database controls | None | Append-only evidence, balanced groups at commit, immutable quotes, positive/non-negative checks | full suite | Ready after rehearsal | — | No | Defence in depth |
| Staff RBAC | Admin role only | 12 roles, 49 permissions, all staff routes gated | `cockpit.test.ts` | Ready | — | No | Least privilege |
| Kill switches | None | 9 features + currency/corridor/provider/user scopes, incl. on-chain withdrawals | `cockpit`, `integration.wallet` | Ready | — | Cockpit | Emergency control |
| Maker-checker | None | Adjustments, goodwill refunds, FX overrides; business batches | `cockpit`, `business.payouts` | Ready | — | Cockpit, mobile | Dual control |
| Remittance | None | 12 corridors, quotes, lifecycle, routing, payouts, refunds, reconciliation, mobile flow | `remittance.golden`, `remittance.api` | Sandbox | Licensed payout partners | Yes (new Send abroad screens) | Core product |
| Treasury | None | Pools, movements, reservations, alerts | `remittance.golden` | Ready | Partner prefunding | Cockpit | Liquidity control |
| Reconciliation | Ledger check only | Statements + 6 integrity checks + workflow | `remittance.golden`, `ledger.reconcile` | Ready | Partner statements | Cockpit | Financial control |
| Risk & compliance | AML flags only | Risk engine, screening (incl. crypto addresses), cases; withdrawals screened | several | Ready (needs list data) | Watchlist data | Cockpit | AML/CFT controls |
| Production mocks | Card, on-ramp, off-ramp mocks ran in production | Refused in production | gap | Ready | Issuer, PSP | No | No fake success |
| Business portal | 26 endpoints missing | Business API, public API, webhooks, approvals, invitations, KYB submit | `business.payouts` | Ready | — | Yes (additions) | Portal non-functional |
| Staff web console | None | Control Cockpit, 32 pages | `cockpit.test.ts` + build + screenshots | Ready | — | New surface | Operability |
| AI | None | Permission-scoped read-only assistant and human-accepted drafts, audited | `ai.assistant` | Off in production | Anthropic + DPA | Cockpit | Assistance with accountability |
| CI / deploy | Deploy did not wait for CI; 2 suites unloadable | Deploy after CI; drift, inventory, secret gates | CI | Ready | — | No | Prevent broken releases |
| Default admin password | Present | Removed | — | Ready | — | No | Admin takeover |

## Required measured counts

| Count | Value | How measured |
|---|---|---|
| Total database models | **96** | `grep -c '^model '` |
| Total API endpoints | **405** | static route inventory |
| Total mobile screens | **82** | non-layout route files in `mobile/app` |
| Total web screens | **51** | `page.tsx` files in `client/src/app` |
| Total business screens | **5** | `mobile/app/business` |
| Total Control Cockpit screens | **32** | `page.tsx` files in `client/src/app/admin` |
| Total admin capabilities | **163** staff endpoints (+25 mobile admin screens) | route inventory, `staff-permission` |
| Total business capabilities | **35** endpoints (26 `/api/business`, 9 `/api/v1`) | route inventory |
| Total financial flows | **38** ledger journal types in code (34 used in production paths) | literal and dynamic `refType` values |
| Total provider adapters | **17** in the provider registry (9 payout: 8 sandbox + 1 internal) | `Provider` table after bootstrap |
| Total tests | **151** passing of 151 (20 suites) | `RUN_DB_TESTS=1 jest` |
| Total security controls | **34** (enumerated in [TAZDAN_TECHNICAL_DUE_DILIGENCE.md](TAZDAN_TECHNICAL_DUE_DILIGENCE.md)) | enumerated list |
| Total fraud rules | **7** fraud rules of 17 risk rules | `DEFAULT_RULES` |
| Total AI automations | **3** AI functions (assistant, case summary, support draft), **0** autonomous actions, 13 read-only tools | code |
| Total documentation files | **152** Markdown files (97 under `docs/`, 8 `TAZDAN_*` reports); baseline 62 | `find . -name '*.md'` excluding dependencies and build output |
