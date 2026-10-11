# Current state — after the 2026-10 programme

Measured on 2026-10-07 on branch `hardening/p0-stop-the-bleeding` (uncommitted working tree). Baseline figures are from [BASELINE.md](BASELINE.md), measured the same way at commit `01de005`. What changed and why is in [CHANGE_LEDGER.md](CHANGE_LEDGER.md).

## One-paragraph summary

Tazdan is a three-application platform: an Express/Prisma/PostgreSQL API, an Expo mobile app for consumers, businesses and administrators, and a Next.js website that now also hosts the staff Control Cockpit. The programme fixed the money and security defects found at baseline, added database-level controls, and built the operating layer a regulated money business needs: remittance lifecycle, routing, treasury, reconciliation, risk and compliance, provider abstraction with production guards, staff RBAC, kill switches, maker-checker, a business platform with a public API, and an audited AI assistant. External rails — payout partners, card issuer, card acquiring, KYC vendor, sanctions-list subscription — are **not** connected; every corridor runs against sandbox rails and is labelled as such. See [LAUNCH_BLOCKERS.md](LAUNCH_BLOCKERS.md).

## Measured counts

| Item | Baseline | Now | Method |
|---|---|---|---|
| Prisma models | 62 | **96** | `grep -c '^model ' server/prisma/schema.prisma` |
| Prisma enums | 43 | **51** | `grep -c '^enum '` |
| Migrations (directories) | 50 | **53** | `ls -d server/prisma/migrations/*/` |
| API endpoints | 287 | **405** | `server/scripts/route-inventory.ts` (static parse) |
| — customer (authenticated) | 162 | 196 | same |
| — staff, permission-gated | 0 (89 admin-role only) | **163** (88 `/api/admin`, 70 `/api/cockpit`, 5 others) | same |
| — staff, role-only (no permission) | 89 | **0** | same |
| — public | 34 | 44 (12 provider webhooks/callbacks, 9 `/api/v1` API-key routes) | same |
| — optional auth | 2 | 2 | same |
| Mobile screens (non-layout route files) | 79 | **82** | `find mobile/app -name '*.tsx' ! -name '_layout.tsx'` |
| — admin / business | 25 / 5 | 25 / 5 | same, per folder |
| Website pages | 19 | **51** (19 public, 32 Control Cockpit) | `find client/src/app -name page.tsx` |
| Server source | 150 files, 29,701 lines | 208 files, 39,220 lines | `server/src/**/*.ts` |
| Mobile source | 210 files, 56,799 lines | 214 files, 57,727 lines | `mobile/app` + `mobile/src` |
| Website source | 78 files, 18,243 lines | 122 files, 22,811 lines | `client/src` (includes the owner's own in-progress marketing changes) |
| Server test files | 14 | **20** | `server/src/__tests__/*.test.ts` |
| Tests executed and passing (with database) | 112 (2 suites failed to load) | **150 of 150** | `RUN_DB_TESTS=1 jest` on a disposable database |
| Tests executed without a database | 102 pass, 10 skipped | 103 pass, 47 skipped | `jest` |

## Build and verification results (2026-10-07)

| Check | Result |
|---|---|
| `server` `tsc --noEmit` | clean |
| `mobile` `tsc --noEmit` | clean |
| `client` `tsc --noEmit` | clean |
| `client` `next build` (production) | succeeds; 32 `/admin` routes compiled |
| Migrations vs schema (`prisma migrate diff` against a shadow database) | no difference |
| Server tests with database | 20 suites, 150 tests, all pass; three consecutive full runs green |
| Control Cockpit visual check | every page screenshotted at 1440 px dark, selected pages light and 390 px; layout issues found were fixed |
| Mobile screens | type-checked only — **not exercised on a device build in this programme** |

## What is production-capable today (subject to [LAUNCH_BLOCKERS.md](LAUNCH_BLOCKERS.md))

- Wallets, internal transfers, chat payments, claim links, deposits (bank transfer with manual confirmation), withdrawals, P2P with escrow, swaps priced from live feeds, budgets.
- Double-entry ledger with database-enforced balance and immutability; continuous reconciliation.
- Staff operations from the web Control Cockpit with least-privilege roles, kill switches, maker-checker and a complete audit trail.
- Business accounts paying other Tazdan customers, with a public API and signed webhooks.

## What is built but runs only against sandboxes

- All 12 remittance corridors (`SANDBOX_ONLY`). Going `LIVE` is refused until an enabled production payout partner serves the corridor.
- Card issuing, card gateway deposits (on-ramp) and off-ramp: refused in production until a real provider is configured.
- Sanctions screening: works against lists imported by compliance; no list is bundled, so screening reports "no coverage" until one is loaded.
- AI assistant: off in production by default (`AI_LEVEL`); needs an Anthropic key and a data-processing agreement.

## Open structural risks

See [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md) and [../TAZDAN_TECHNICAL_DUE_DILIGENCE.md](../../TAZDAN_TECHNICAL_DUE_DILIGENCE.md). The material ones: crypto orders fill against the platform when the hedge venue is unreachable (the platform is the unhedged counterparty); the new database triggers must be rehearsed against a copy of production data before deployment; several money paths still lack dedicated tests; the mobile changes need device testing.
