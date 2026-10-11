# 21 — Replacement cost (estimate)

**This is a judgement-based effort estimate, not a valuation and not a measurement.** The inputs that *are* measured (size of what exists) are listed first; the effort and cost figures are estimates from explicit assumptions so a reader can substitute their own.

## Measured scope

96 models, 53 migrations, 405 endpoints, 82 mobile screens, 51 web pages (32 cockpit), 39,220 server lines, 57,727 mobile lines, 22,811 website lines, 151 passing server tests, 17 risk rules, 12 corridors, 9 payout adapters (8 sandbox), 12 staff roles / 49 permissions.

## Effort by component (engineer-months, estimate)

| Component | Low | High | Basis |
|---|---|---|---|
| Core consumer money platform (auth, sessions, wallets, transfers, deposits, withdrawals, P2P, claim links, budgets, messaging, notifications) | 18 | 30 | baseline server scope |
| Ledger, database controls, reconciliation | 4 | 7 | |
| Remittance engine (corridors, pricing, routing, lifecycle, payouts, refunds, sandbox rails) | 6 | 10 | |
| Treasury | 2 | 3 | |
| Risk engine, screening, cases | 4 | 6 | |
| Business platform, public API, webhooks | 3 | 5 | |
| Control Cockpit (32 pages, 70 endpoints) | 6 | 10 | |
| AI control layer | 1 | 2 | |
| Mobile app (82 screens) | 18 | 30 | |
| Website (19 public pages) | 2 | 4 | |
| Blockchain custody and on-chain flows | 4 | 7 | |
| Tests, CI, documentation | 4 | 8 | |
| **Total** | **72** | **122** | |

## Cost under stated assumptions

At an assumed fully loaded cost of **12,000–20,000 USD per engineer-month** (senior fintech engineers; adjust for location), 72–122 engineer-months correspond to roughly **0.9–2.4 million USD**, or about 12–18 months elapsed for a team of six to eight.

## Excluded

Licences and legal work, partner contracts and integration with real partners, compliance staff and programme, security assessments, infrastructure costs, product discovery and design iterations, and the cost of time-to-market.
