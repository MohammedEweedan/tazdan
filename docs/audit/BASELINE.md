# Baseline — state before the 2026-10 hardening programme

Recorded 2026-10-06 at commit `01de005` on branch `hardening/p0-stop-the-bleeding`, before any change in this programme. Every number here was measured; how each was measured is listed with it.

## Repository shape

| Application | Stack | Location | Size |
|---|---|---|---|
| API server | Node 24 / Express 4 / TypeScript / Prisma 5 / PostgreSQL / Redis / Socket.IO | `server/` | 150 TS files, 29,701 lines in `server/src` |
| Mobile app (consumer, business, admin) | Expo SDK 54 / React Native / expo-router / NativeWind | `mobile/` | 210 TS/TSX files, 56,799 lines (`app/` + `src/`) |
| Marketing website | Next.js 14 / Chakra UI / Tolgee i18n | `client/` | 78 TS/TSX files, 18,243 lines |

Hosting (from `docker-compose.prod.yml` and memory of the deployment): the API runs in Docker on one DigitalOcean droplet behind host nginx at `api.promrkts.com`; the website is on Vercel.

## Measured counts

| Item | Count | Method |
|---|---|---|
| Prisma models | 62 | `grep -c '^model ' server/prisma/schema.prisma` |
| Prisma enums | 43 | `grep -c '^enum '` |
| Migrations | 51 | `ls server/prisma/migrations` |
| Mounted API endpoints | 287 | `server/scripts/route-inventory.ts` (static parse of mounts + routers) |
| — authenticated user | 162 | same |
| — admin | 89 | same |
| — public (incl. 7 webhooks) | 34 | same |
| — optional auth | 2 | same |
| Mobile screens (non-layout route files) | 79 | `find mobile/app -name '*.tsx' ! -name '_layout.tsx'` |
| — of which admin | 25 | `mobile/app/admin` |
| — of which business | 5 | `mobile/app/business` |
| Website pages | 19 | `find client/src/app -name page.tsx` (all public/marketing) |
| Web admin pages | 0 | — |
| Server test files | 14 | `server/src/__tests__` |
| Server test cases | 113 | `it(`/`test(` declarations |
| Mobile / website tests | 0 | — |
| Markdown documents (excluding generated output) | 62 | repo-wide, 15 under `docs/` |

## Build and test results

| Check | Result |
|---|---|
| `server`: `tsc --noEmit` | clean |
| `mobile`: `tsc --noEmit` | clean |
| `client`: `tsc --noEmit` | clean |
| `server`: `jest` (default config, DB tests skipped) | 10 suites pass, 2 skipped; 102 tests pass, 10 skipped |
| `server`: `jest` with `RUN_DB_TESTS=1` against a disposable `tazdan_test` database | 112 tests pass; `integration.auth.test.ts` and `integration.wallet.test.ts` **fail to load** (Jest cannot parse the ESM build of `ed25519-hd-key`) |
| Migrations vs schema (`prisma migrate diff`) | one cosmetic drift: `AssetLedgerAccount.updatedAt` default |
| CI (`.github/workflows/ci.yml`) | lint-free type-check + tests + fast build + `npm audit` gate for server prod deps |
| Deploy (`.github/workflows/deploy.yml`) | builds and pushes images on `master` **without waiting for CI** |

## Provider integrations at baseline

| Domain | Selected by | Default | Production behaviour at baseline |
|---|---|---|---|
| KYC | `KYC_PROVIDER` | `MOCK` | Boot refuses `MOCK` in production; unset = manual admin review. The provider abstraction itself is not called by any route — KYC is document upload + admin review. |
| Card issuing | `CARD_ISSUER` | `MOCK` | `MOCK` runs in production (card creation hidden behind `FEATURE_CARDS`, default off in production). |
| On-ramp | `ONRAMP_PROVIDER` | `MOCK` | `MOCK` runs in production and marks gateway deposits `COMPLETED` without crediting anything. |
| Off-ramp | `OFFRAMP_PROVIDER` | `MOCK` | `MOCK` runs in production. |
| LYD parallel rate | Fulus API + scraper fallback | — | Real feed when `FULUS_API_TOKEN` is set. |
| Crypto prices | Coinbase / CryptoCompare fallback (Binance geo-blocked) | — | Real market data. |
| Crypto order hedging | Binance | — | Simulated fill when credentials are missing or Binance is unreachable; the platform is the unhedged counterparty. |
| On-chain broadcast | ethers / bitcoinjs / solana web3 | — | ETH, USDT-ERC20, BTC and SOL paths exist; TRON live broadcast not implemented; simulated broadcast refused in production. |
| Email | Resend HTTP API | — | Working (verified previously). |
| Phone OTP / WhatsApp | Twilio / Meta | — | Simulation refused in production. |
| Remittance / payout / bank rails | — | — | **None exist.** |

## Verified defects found during baseline (fixed later — see CHANGE_LEDGER.md)

See [BROKEN_FEATURES.md](BROKEN_FEATURES.md) and [LAUNCH_BLOCKERS.md](LAUNCH_BLOCKERS.md) for the full list with file references. The most material:

1. Admin "freeze user" overwrote every wallet's `frozen` amount and "unfreeze" set it to zero, destroying reservations held for pending withdrawals, budgets, claim links and P2P escrow.
2. Admin "freeze transaction" edited status unconditionally — it could mark a completed withdrawal cancelled or a confirmed deposit rejected after money had moved.
3. `POST /api/transfers/send` failed for USDT (its default currency) because it queried currency values that are not in the database enum.
4. The transfer endpoint the mobile app uses (`POST /api/transactions/transfer`) skipped step-up authentication.
5. Security → sessions read a table nothing writes; "sign out other devices" revoked nothing.
6. P2P escrow reserved the seller's funds twice and, for long-tail assets, never debited the seller — a money-creation path.
7. Admin dispute resolution could not move escrow and rejected its own default status value.
8. Referral reward claiming could pay twice under concurrent requests.
9. The swap endpoint fabricated an on-chain transaction hash for its receipt.
10. The business portal in the mobile app called 20 `/api/business/*` endpoints that did not exist.
