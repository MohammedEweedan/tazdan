# Tazdan — buy vs build

## What exists (measured)

| Item | Count |
|---|---|
| Applications | 3 (API, mobile, website + Control Cockpit) |
| Screens | 82 mobile (25 admin, 5 business), 51 web (32 cockpit) |
| Database models | 96 (53 migrations) |
| Endpoints | 405 |
| Service files | 81 |
| Financial workflows (ledger journal types) | 38 in code, 34 in production paths |
| Tests | 151 passing (20 suites) |
| Provider adapters | 17 registered (9 payout: 8 sandbox + 1 internal) |
| Admin workflows | 163 permission-gated staff endpoints; 32 cockpit pages; 25 mobile admin screens |
| Business workflows | 35 endpoints (26 business, 9 public API) |
| Blockchain networks | 3 with live withdrawal broadcast (Ethereum incl. USDT-ERC20, Bitcoin, Solana); 4 with deposits (adds TRON) |
| Documentation | 152 Markdown files (97 under `docs/`) |

## Estimate to reproduce

72–122 engineer-months; at an assumed 12,000–20,000 USD per engineer-month, roughly 0.9–2.4 million USD and 12–18 months for a team of six to eight. Method, assumptions and exclusions: [docs/dataroom/21_REPLACEMENT_COST.md](docs/dataroom/21_REPLACEMENT_COST.md). This is an estimate, not a valuation.

## Component view

[docs/dataroom/23_BUY_VS_BUILD.md](docs/dataroom/23_BUY_VS_BUILD.md). In short: ledger, orchestration, treasury, reconciliation, risk rules and the back office are built and integrated; licences, payout partners, card issuing, sanctions data and (optionally) KYC vendors must be bought or contracted whether one builds or acquires.
