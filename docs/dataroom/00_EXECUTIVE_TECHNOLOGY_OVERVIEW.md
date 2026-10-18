# 00 — Executive technology overview

> **Historical snapshot: 7 October 2026.** Counts and behaviour below are not the current baseline. The 17 October hardening work records 48 passing server suites and 370 passing tests and disables legacy real-money crypto execution. Use the [current validation](../audit/FINANCIAL_HARDENING_VALIDATION_2026_10_17.md), [financial launch assessment](../../deliverables/TAZDAN_FINANCIAL_HARDENING_AND_LAUNCH_2026_10_17.md) and [current buyer brief](../../deliverables/TAZDAN_BUYER_BRIEF_2026_10_17.md) for new diligence or sales material.

All figures were measured on 2026-10-07 from the repository (branch `hardening/p0-stop-the-bleeding`, uncommitted working tree). No production traffic, revenue or customer figures are stated anywhere in this data room because none were measured.

**What it is.** Tazdan is a Libya-focused digital money platform: multi-currency wallets, internal and chat payments, bank and crypto deposits and withdrawals, P2P trading with escrow, crypto buy/sell, swaps, budgets, a remittance engine for Libya corridors, a business payouts platform with a public API, and a staff Control Cockpit. Three applications — API (Express/Prisma/PostgreSQL), mobile (Expo), website and cockpit (Next.js).

**State of the technology.** A double-entry ledger enforced by the database, conditional state machines, append-only evidence, continuous reconciliation, least-privilege staff roles with dual control, emergency kill switches, a risk engine with 17 rules, sanctions screening against imported lists, and a provider abstraction that refuses mock or sandbox adapters in production. 150+ automated server tests pass against a real database.

**What is not there.** Licences; live payout partners (all 12 corridors run on sandbox rails); a card issuer and PSP; bundled sanctions data; a reachable crypto hedge venue (crypto orders fill against the platform when Binance is unreachable); external penetration testing; device-level testing of the latest mobile changes.

**Readiness statement.** Not launch ready by the brief's own criteria. Accurate statement: [22_LAUNCH_READINESS.md](22_LAUNCH_READINESS.md).

| Measure | Value |
|---|---|
| Database models / migrations | 96 / 53 |
| API endpoints | 405 |
| Mobile screens / web pages (cockpit) | 82 / 51 (32) |
| Server tests (with database) | 151 passing of 151 |
| Source lines (server / mobile / website) | 39,220 / 57,727 / 22,811 |
