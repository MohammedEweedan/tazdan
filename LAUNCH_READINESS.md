# Tazdan — Launch Readiness Analysis (v2)

**Date:** 2026-05-31
**Branch reviewed:** `master`
**Reviewer:** full-stack + security + financial-controls pass over the *current* codebase
**Supersedes:** the 2026-05-23 "Fortuni" version (now stale — KYC, rate limiting, FX engine, and much else have since shipped).

This is an honest, current-state readiness map. It reflects what is **actually in the code today**, not the older roadmap. Grouped into:

1. **Hard blockers** — cannot launch without these.
2. **Risk reducers** — can launch without, shouldn't.
3. **Polish.**

---

## 0. What's actually built (so we stop re-listing it as "todo")

This is a real platform, not an MVP scaffold. Verified present and wired:

- **Server** — Express + Prisma/Postgres, **51 models**, 33 controllers, Redis, Socket.IO. ~21k LOC.
- **Mobile** — Expo/React Native, **71 screens**, ~49k LOC. Three themes incl. monochrome.
- **Web** — Next.js marketing site + **web admin console** + legal pages (privacy, risk, compliance). ~32k LOC.
- **Exchange engine** — live Binance pricing, quote→execute with **single-use 30s quotes**, **idempotency keys**, Decimal-safe money math, configurable spread (admin-set), live network-fee floor (gas oracle).
- **FX / LYD rail** — live multi-provider FX (OpenExchangeRates → Frankfurter → open.er-api → static floor), **scraped LYD parallel-market rate** + **adaptive demand-skew order book** flooring at the street rate, FX tick history + admin chart.
- **KYC** — **real Sumsub integration** (HMAC, applicant creation, webhook signature verification), gated provider selection. **KYB** for business accounts with volume-based tiers.
- **On-ramp** — Stripe + Checkout.com providers (real), mock fallback for dev.
- **Custody** — encrypted master-seed (AES-256-GCM, per-encrypt IV, auth tag), HD derivation, on-chain settlement service, withdrawal address whitelist.
- **Fee ledger** — every fee flows through `collectFee()` → `PlatformFee` ledger + credits a `platform` wallet. Auditable.
- **Security middleware** — helmet, CORS allow-list, 5 tiered rate limiters (global/auth/register/withdrawal/webhook), bcrypt(12), timing-safe login, **2FA enforced on trades**.
- **Feature breadth** — P2P (812-line controller w/ escrow + disputes + reputation), cards (issuing, limits, freeze, cashback), group chats, **liquidity pools** (shared wallets / goal-based savings), **claim links** (send-by-link/email/phone + PIN), recurring buys (real scheduled execution w/ idempotency), referrals, transfers, DEX swap (1inch), WhatsApp, push, CSV export.
- **Prod infra** — `docker-compose.prod.yml` with Redis (auth'd), nginx, **certbot/Let's Encrypt** auto-TLS, managed Postgres.

The gap to launch is now **financial-controls + custody + compliance**, not feature engineering.

---

## 1. Hard blockers

### 1.1 No double-entry ledger / money-conservation invariant  ⬅ #1 ENGINEERING RISK
Balances are mutated directly inside `$transaction` blocks. There is a `PlatformFee` ledger but **no global invariant** asserting that money is conserved. This session alone surfaced multiple money-correctness bugs in the core buy/sell path (a stablecoin was credited to the wrong ledger; settlement currency was conflated; a sell produced phantom balance). Those are now fixed — but the *class* of bug recurs until there's a structural guard.

**Action:**
- Introduce an append-only **`LedgerEntry`** table (every debit/credit, signed, with a `refType`/`refId`), and make all balance changes go through one `postLedger()` that writes paired entries inside the same tx.
- Add a **reconciliation job**: `Σ user balances + platform float == Σ deposits − withdrawals` per currency, run on a schedule; **halt trading on drift** and alert.
- Add **invariant tests**: for every order type, assert debits == credits and total supply unchanged.

### 1.2 Custody key management
Master seed is encrypted with a **single env-var key** (`MASTER_SEED_ENC_KEY`). Crypto hygiene is correct, but if the server env leaks, all custody is compromised → insolvency + liability. The code documents a KMS path and the DB row has `kmsKeyId` — it's not wired.

**Action (pick one before holding real crypto):**
- Move the key to **AWS/GCP KMS** (envelope encryption), OR
- Adopt **custody-as-a-service** (Fireblocks / BitGo / Cobo) and stop self-custodying hot keys.
- Either way: **withdrawals require 2-of-N approval**, not a single admin token.

### 1.3 Licensing / regulatory registration  ⬅ #1 BUSINESS RISK, longest lead time
A MENA crypto-fiat exchange touching LYD needs registration (UAE → **VARA** if Dubai-based; the Libya angle needs a real legal opinion). App stores **pull** unlicensed crypto-exchange listings within weeks. This is existential and slow — start now, in parallel with everything else.

### 1.4 Production secrets + provider flip
- Flip on-ramp from mock → live: `ONRAMP_PROVIDER`, Stripe/Checkout live keys + webhook secrets, register webhook URLs, test with CLI.
- `SUMSUB_APP_TOKEN`/`SUMSUB_SECRET` live; gate **first withdrawal + deposits over threshold** behind verified KYC.
- Rotate `JWT_SECRET`/`JWT_REFRESH_SECRET`/`MASTER_SEED_ENC_KEY`, distinct per environment.
- Apple Pay merchant cert in Stripe; EAS native build with the Stripe plugin applied.

### 1.5 Legal documents live + linked
Privacy / ToS / AML / risk disclosure pages exist on the web client — confirm they're **final, lawyer-reviewed, jurisdiction-correct**, hosted at stable URLs, and linked in-app (Profile → Legal). Crypto disclosures are jurisdiction-specific.

### 1.6 Store compliance
App Store privacy nutrition labels + `PrivacyInfo.xcprivacy` for third-party SDKs (Stripe, Sentry, Expo). Play data-safety form + 24h-resolvable crypto contact email. Publish licensing info or listings get pulled.

---

## 2. Risk reducers

### 2.1 Test coverage
**6 test files for a money platform is the scariest non-blocker.** The integrity bugs existed because nothing asserted balance conservation. Add invariant + property tests on every balance mutation, plus E2E on the quote→execute→settle path. Target the money paths first, not coverage %.

### 2.2 Observability
Wire **Sentry** on mobile (`_layout.tsx`) and server. Structured logging is partly there (`logger`); add request IDs to correlate webhooks ↔ orders. `/healthz` + `/readyz` for the LB. A dashboard for webhook success-rate, quote→execute latency, and **reconciliation status**.

### 2.3 Single-process state that won't survive scale
The LYD order-book skew accumulator and some caches are **in-process**. Fine for one instance; on horizontal scale the demand signal fragments. Move to Redis before running >1 server.

### 2.4 FX scrape fragility
The LYD parallel rate is scraped from one site (`blackmarketlive.org`). If its HTML changes, you fall back to admin/static. Good that it degrades — but add a **monitor/alert** when the scrape returns nothing, and surface staleness in admin (the `/admin/fx-status` panel already shows the raw value — wire an alert).

### 2.5 Push credentials
Confirm APNs/FCM keys in EAS (`eas credentials`) or server-triggered notifications silently no-op.

### 2.6 Abuse / fraud
Rate limiters exist. Add per-IP CAPTCHA on register/login, velocity checks on deposits→withdrawals (classic cash-out fraud), and device fingerprinting on P2P.

### 2.7 Accessibility
SlideToConfirm needs a non-gesture fallback + `accessibilityActions`. Icon-only Pressables need labels. Audit 11px label contrast (now monochrome — re-check the grey-on-black tiers).

### 2.8 i18n / RTL
Confirm every onboarding/KYC/error string is translated (Arabic especially) and RTL flips correctly across Buy/Sell/P2P.

---

## 3. Polish

- Consolidate duplicated `serverAsset()`/`defaultNetwork()`/coin-metadata maps across Buy/Sell into one `cryptoMeta.ts`.
- Auto-validate destination addresses against per-asset regex before enabling slide-to-confirm.
- Prune `FxRateTick` history (retention sweep) — ~288 rows/day is fine, but cap it.
- Onboarding permission slide: inline "Allow X" tiles instead of three stacked OS dialogs.
- First-run tooltip for the home long-press action sheet.

---

## 4. Critical path to launch (realistic)

| Phase | Work | Calendar |
|---|---|---|
| **A. Integrity** | Double-entry ledger + reconciliation + invariant tests | 2–4 weeks |
| **B. Custody** | KMS or custody-as-a-service + 2-of-N withdrawals | 1–3 weeks (parallel) |
| **C. Compliance** | License/legal opinion, final legal docs, store affidavits | **6–12+ weeks (start NOW, longest pole)** |
| **D. Go-live wiring** | Live keys, certs, EAS build, Sentry, webhooks | 1 week |
| **E. Closed beta** | One market, capped limits, daily manual reconciliation | 2–4 weeks |

**Do not run A→E sequentially.** B and C run in parallel with A. The license is the gating item; the engineering can be ready before it is.

---

**Bottom line:** the product is genuinely impressive in breadth and mostly sound in architecture. It is **not** held back by missing features — it's held back by the three things that decide whether a money app lives or dies: **provable financial integrity, hardened custody, and a license.** Close those and you have a launchable, differentiated MENA fintech. Skip any one and the first reconciliation gap, key leak, or regulator letter ends it.
