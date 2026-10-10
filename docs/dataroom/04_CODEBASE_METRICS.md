# 04 — Codebase metrics

Methods are shell commands over the working tree; see [../audit/CURRENT_STATE.md](../audit/CURRENT_STATE.md) for the full table with baseline values.

| Metric | Value | Baseline (2026-10-06) |
|---|---|---|
| Prisma models | 96 | 62 |
| Prisma enums | 51 | 43 |
| Migrations | 53 | 50 |
| API endpoints (static inventory) | 405 | 287 |
| — customer / staff-permission / public / optional | 196 / 163 / 44 / 2 | 162 / 0 (89 role-only) / 34 / 2 |
| Server service files / controller files | 81 / 45 | — |
| Mobile screens (admin / business) | 82 (25 / 5) | 79 (25 / 5) |
| Website pages (Control Cockpit) | 51 (32) | 19 (0) |
| Server source | 208 files, 39,220 lines | 150 files, 29,701 lines |
| Mobile source | 214 files, 57,727 lines | 210 files, 56,799 lines |
| Website source | 122 files, 22,811 lines | 78 files, 18,243 lines |
| Server test files / tests passing | 20 / 151 | 14 / 112 (2 suites unloadable) |
| Risk rules / staff roles / staff permissions | 17 / 12 / 49 | — |
| Payout adapters (sandbox + internal) | 8 + 1 | 0 |
| Remittance corridors | 12 (sandbox) | 0 |
| Ledger reference types used in code | 28 static + treasury movements | — |
| Documentation (Markdown files, excluding dependencies and build output) | 152 (97 under `docs/`) | 62 (15 under `docs/`) |
