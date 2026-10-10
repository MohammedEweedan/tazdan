# 03 — IP inventory

## First-party code

| Component | Location | Notes |
|---|---|---|
| API server | `server/src` (208 files) | Ledger, remittance, treasury, reconciliation, risk, compliance, business, cockpit API, AI layer |
| Database schema and migrations | `server/prisma` (96 models, 53 migrations) | Includes hand-written database controls |
| Mobile app | `mobile/app`, `mobile/src` (214 files) | Consumer, business and admin screens; i18n dictionary in 9 locales |
| Website and Control Cockpit | `client/src` (122 files) | Marketing site and staff console |
| Documentation | `docs/` and root reports | This programme's audit and technical documentation |

The repository contains no LICENSE file; the code is unlicensed to third parties (all rights reserved by default). Authorship and ownership assignments for all contributors should be confirmed contractually — not verifiable from the code.

## Third-party dependencies (direct)

| App | Runtime deps | Licences (from installed packages) |
|---|---|---|
| Server | 40 | MIT 33, Apache-2.0 3, ISC 1, BSD-2-Clause 1, MIT-0 1, FSL-1.1-Apache-2.0 1 (`@sentry/node` — Functional Source License, permits use as an SDK; converts to Apache-2.0 after two years) |
| Mobile | 61 | MIT 58, MIT AND OFL-1.1 3 (icon/font packages) |
| Website | 41 | MIT 32, OFL-1.1 4 (fonts), Apache-2.0 2, BSD-3-Clause 1, BSD-2-Clause 1, MIT-0 1 |

No copyleft (GPL/AGPL) licence appears among direct dependencies. Transitive dependencies were not audited for licences in this programme.

## Data and content

No third-party data sets are bundled (sanctions lists are imported by the operator). Brand assets and marketing copy are the owner's.

## External services (contractual, not IP)

Resend, Fulus, open.er-api, Coinbase/CryptoCompare, Binance, blockchain RPC providers, DigitalOcean, Vercel, Expo/EAS, Anthropic (optional), AWS KMS (custody).
