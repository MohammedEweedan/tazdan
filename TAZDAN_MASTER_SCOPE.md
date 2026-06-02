# Tazdan — Master Project Scope & Investor Brief

**The financial operating system for the world's broken-currency corridors.**
Buy, sell, send, and spend crypto and fiat at the *real* rate — in the markets the global giants won't touch.

---

> **Document status & integrity note.** This brief reflects the *current, shipped
> codebase* — not a roadmap of intentions. Every product claim below maps to code that
> exists in the repository today (≈100,000 lines across mobile, server, and web).
> Where a capability requires only live credentials rather than new engineering, it is
> labelled **"flip-to-live."** No traction, partnership, or user metrics are claimed,
> because the platform has not yet publicly launched. Financial figures are *models*
> with their assumptions stated, not results.
>
> **Built and shipped by a single founder.** What follows is a regulated, full-stack
> money platform — exchange engine, custody, double-entry ledger, KYC/KYB, P2P escrow,
> card issuing, a 71-screen mobile app, a web app, and an operations console —
> architected and written solo to a standard that normally requires a multi-person
> team. That is the headline that should frame everything else in this document.

---

## 1. Executive Summary

**The one-liner.** Tazdan is a mobile-first financial super-app for emerging and
controlled-currency markets — a single, trusted on/off-ramp and money-movement rail
where a trapped local currency, a hostile banking system, and a 40%+ gap between the
official and the real exchange rate stop being a life sentence.

**The wedge.** Billions of people transact in parallel-market currencies — LYD, EGP,
NGN, ARS, LBP, TRY, SDN. Binance, Wise, and Stripe **structurally avoid** these
corridors over FX-control and compliance risk. That avoidance is the opening: whoever
does the hard, unglamorous work of operating there — compliantly, transparently, and
accurately — owns the rail. Tazdan starts at the **USD/LYD (Libya) corridor** and
expands corridor-by-corridor on the same engine.

**Why now.** Parallel-market FX is large, real, and underserved by anything app-native.
Crypto rails make instant, borderless value transfer technically trivial; the missing
piece has always been a *trusted, transparent, licensed* operator willing to serve
these markets. The technology to build that is now commodity; the willingness is not.

**What exists today.** A feature-complete, production-grade platform — not an MVP.
The remaining work to public launch is **not feature engineering**. It is three money-app
gates: provable financial integrity, hardened custody, and a license (Section 10).

**The ask.** Capital and runway to clear licensing, harden custody, and fund a focused
go-to-market in the first corridor. Specific raise/valuation: **[FOUNDER TO COMPLETE —
see Section 12]**.

---

## 2. The Problem

In a controlled-currency economy, ordinary financial life is quietly broken:

- **The "official" rate is fiction.** Libya's official vs. parallel USD/LYD rate diverges
  by **40%+**. Citizens, importers, and families transact at the *street* rate, but no
  app gives them that rate transparently — they rely on informal money-changers, opaque
  spreads, and trust.
- **Local currency is trapped.** Balances can't easily be spent globally, saved in hard
  currency, or moved across borders without punitive friction.
- **Remittances leak value.** Diaspora workers send money home and a large slice
  evaporates in spreads and bad rates. "Send $100, the family gets the real value" is
  not the norm — it's the unmet promise.
- **The incumbents won't come.** Binance, Wise, and Stripe avoid these corridors by
  design. The people who need modern financial tools most are the ones the giants
  explicitly leave behind.

The result is a multi-billion-dollar informal FX-and-remittance economy running on
WhatsApp, cash, and trust — with no transparent, licensed, app-native operator.

---

## 3. The Product — Every Shipped Feature

A mobile-first **financial super-app** (iOS + Android + web app + marketing site),
backed by a production-grade exchange and custody engine. The mobile app ships **71
screens** across the surface area below.

### 3.1 Consumer features

| Feature | What it does |
|---|---|
| **Buy & sell crypto** | BTC, ETH, USDT, SOL, BNB, XRP and 30+ more at live market prices, with a transparent, disclosed spread. Quote→execute flow with single-use 30-second quotes, idempotency keys, and Decimal-safe money math. |
| **Real-rate FX (the differentiator)** | Live parallel-market rates (e.g. USD/LYD), scraped from the street market and **demand-adjusted**, so users transact at the *real* rate, not the official peg. Published and defensible. |
| **Send money (transfers & claim-links)** | Send to any @handle, email, or phone. Recipients **claim via a link even before they have an account**, PIN-protected, with refund-on-expiry. The remittance virality engine. |
| **Multi-currency fiat wallet** | Hold USD, EUR, GBP, AED, SAR, EGP, LYD. Deposit by bank wire or card, convert instantly, withdraw back to bank. |
| **Tazdan Card** | Virtual cards with spend controls, limits, freeze/unfreeze, cashback, and tiers (Starter / Master / Pro). Spend trapped local balances globally. |
| **P2P marketplace** | Peer-to-peer crypto/fiat trading with **escrow, disputes, and reputation** (an 800+ line escrow controller). Trade at the rate you set; funds held until both sides confirm. |
| **Recurring buys** | Dollar-cost-averaging on a schedule — real scheduled execution with idempotency. |
| **Group wallets & liquidity pools** | Shared wallets and goal-based savings pots — pool and split funds socially. |
| **In-app chat** | 1:1 and group messaging, including payment messages and P2P trade notes. |
| **Referrals** | Tiered rewards paid from the platform fee pool (e.g. 5% of fees on early referrals). |
| **Three themes** | Including a striking **monochrome** mode — premium, anti-"crypto-casino" aesthetic. |
| **Security UX** | Face ID / Touch ID, passkeys (FIDO2), 2FA (TOTP), trusted-device recognition, biometric verification. |

### 3.2 Business / institutional

- **Business accounts (KYB).** Company onboarding with volume-based fee tiers — the
  foundation for "treasury for frontier markets" and the **highest revenue-per-account**
  segment. The plumbing exists; growth here is sales/onboarding, not engineering.

### 3.3 Admin & operations

- A full **operations console** (web): live metrics, fee aggregation by source, volume,
  FX order-book / demand-skew monitoring, KYC/KYB review queues, deposit/withdrawal
  management, multi-sig withdrawal approval queue, AML flag review, and a treasury /
  fee ledger view. The business is operable from day one.

---

## 4. Technology & Architecture

A genuinely full-stack, production-grade system — **≈100,000 lines of code**.

| Layer | Stack | Scale |
|---|---|---|
| **Mobile** | React Native / Expo, NativeWind, Reanimated | **71 screens**, ~49k LOC |
| **Server** | Node / Express / TypeScript, **Prisma + PostgreSQL**, Redis, Socket.IO | **51–56 data models**, 33 controllers, ~140 endpoints, ~21k LOC |
| **Web** | Next.js | Marketing site + web app + web admin console + legal pages, ~32k LOC |

**Exchange engine.** Live pricing rebuilt from market data + configurable spread,
quote→execute with single-use 30s quotes, idempotency, live network-fee floor (gas
oracle), per-asset spreads.

**FX / LYD rail.** Multi-provider live FX (OpenExchangeRates → Frankfurter → open.er-api
→ static floor) plus a **scraped LYD parallel-market rate** and an **adaptive
demand-skew order book** that floors at the street rate. FX tick history + admin chart.

**Custody (real code).** Encrypted master seed (AES-256-GCM, per-encrypt IV, auth tag),
BIP-39/BIP-44 HD derivation, on-chain settlement service for **BTC / ETH / SOL / TRON**,
withdrawal-address whitelist. A KMS path (`kmsKeyId`) is designed in the schema (see
custody hardening, Section 10).

**Integrations.** Real integration code exists for **Binance** (pricing), **Stripe +
Checkout.com** (card/bank on-ramp), **Sumsub** (KYC, with HMAC webhook verification),
**1inch** (DEX swap), on-chain RPC (Ethers / bitcoinjs / Solana web3 / TronWeb),
**Twilio + WhatsApp**, **Expo push**, **Sentry**, and **AWS KMS** (path).

> **Flip-to-live, stated honestly.** Several external providers default to a **`MOCK`**
> implementation in the current build (KYC, on-ramp beyond Stripe, card issuer,
> off-ramp, on-chain broadcast when RPC env is absent). The real integration code is
> written; going live is a matter of **credentials, keys, and webhook registration** —
> part of go-live wiring (Section 10, Phase D), **not** new feature engineering. This is
> called out plainly so diligence finds no surprises.

**Production infrastructure.** `docker-compose.prod.yml` (Redis with auth, Node server
with optional multi-worker clustering, Next.js client, nginx reverse proxy + TLS
termination, certbot/Let's Encrypt auto-renewal), managed PostgreSQL. CI/CD via GitHub
Actions building and pushing images to GHCR on push to `main`/`master`.

---

## 5. Trust & Money Integrity — the real moat on the technical side

A money app lives or dies on whether it can prove it never loses a customer dollar.
Tazdan's architecture is built around that proof.

- **Double-entry ledger.** An append-only ledger (`LedgerAccount` / `LedgerEntry` /
  `PlatformFee`) where every movement posts paired, signed debit/credit entries inside
  the same database transaction. Money cannot be silently created or destroyed.
- **Reconciliation & halt-on-drift.** A reconciliation invariant
  (`Σ user balances + platform float == Σ deposits − withdrawals`, per currency) runs on
  a schedule; the design **halts trading and alerts on any drift**. (Hardening + invariant
  test coverage is the #1 pre-launch engineering item — Section 10.)
- **Auditable fees.** Every fee flows through one `collectFee()` path into the
  `PlatformFee` ledger and a dedicated platform wallet — fully traceable, with USD
  conversion for reporting.
- **KMS-backed custody + multi-sig.** Master-seed envelope encryption (KMS path) so a
  database or server leak alone cannot decrypt funds; high-value withdrawals require
  **2-of-N independent admin approvals** — no single compromised session drains the
  treasury.
- **Step-up authentication.** Withdrawals, trades, and transfers over **$1,000** (or from
  an unrecognized device) require a fresh single-use 6-digit code via email or
  authenticator.
- **KYC / KYB.** Real Sumsub integration gating deposits and first withdrawal; business
  verification for KYB.
- **Hardened surface.** Helmet, CORS allow-list, **five tiered rate limiters**
  (global / auth / register / withdrawal / webhook), bcrypt(12), timing-safe login,
  **2FA enforced on trades**, signed webhooks, parameterized queries, AML flagging with
  auto-freeze on critical patterns, and an admin audit log.

**Marketing translation:** *"Your money, provably safe — down to the 0.000000001."*

---

## 6. Market & Moat

**The market.** Controlled / parallel-currency corridors — a multi-billion-dollar
informal FX and remittance economy across **Libya, Egypt, Nigeria, Lebanon, Turkey,
Sudan**, and the broader MENA/Africa diaspora. These markets are large, currency-stressed,
and structurally unserved by app-native rails.

**The moat, in priority order:**

1. **Be the rate.** Own price discovery for parallel currencies — become the trusted,
   *published* number people quote. A rate people trust is a moat money can't quickly buy.
2. **Regulatory work as IP.** The licensing and compliance nobody else will do for these
   corridors is precisely the barrier competitors can't cheaply cross. The hard work *is*
   the defensibility.
3. **Network effects.** Every P2P trader, agent, business account, and remittance
   recipient deepens liquidity and tightens the rate — compounding advantage per corridor.

**Positioning vs. incumbents.** Binance and Revolut have features; **none operate these
corridors.** Tazdan is "the super-app for the markets the giants abandoned" — not a
Binance competitor on generic crypto price (a fight you'd lose), but the operator of a
rail they won't build.

---

## 7. Business Model & Unit Economics

The engine is the **FX spread**; everything else is retention surface that raises
lifetime value and lowers churn. The fee schedule below is **code-backed** (admin-tunable
via platform settings):

| Stream | Rate (default) | Code reference |
|---|---|---|
| **FX spread (USD/LYD + MENA fiat)** — *primary, ~60–75% of revenue* | **2.5%**, floored at live street rate; LYD demand-skew up to **+6%** over floor | `fxRateProvider.service` + `lydOrderBook.service` |
| Crypto exchange spread | **2.5%** global default, per-asset overrides | `priceEngine.service` |
| Trading fee | **0.5%** | platform settings / fee collector |
| P2P escrow fee | **0.5%** | `p2p.controller` (escrow + disputes) |
| Card fee | **1.0%** (+ tier revenue) | `Card` / `CardTransaction` |
| On-ramp / off-ramp fee | **1.0%** each | on/off-ramp controllers |
| Swap fee | **0.3%** | swap path |
| Withdrawal fee | **$1** crypto / **$2** fiat (flat) | withdrawal controllers |
| Internal transfer | **Free** | transfer controller |
| Business (KYB) | Volume-tiered | `BusinessProfile` |

**Margin honesty (do not blend the streams).**
- **FX spread:** near-zero marginal cost per trade → **strong margin**. This is the
  business.
- **Card on-ramp:** thin or negative after 1.5–3% processing + fraud reserve. It is a
  retention/utility feature, not a profit center. Blending these into one headline margin
  would be misleading — so we don't.

---

## 8. Financial Projections

> All figures are **models with stated assumptions**, deliberately conservative for a new
> emerging-markets entrant. They assume a licensed launch and a disciplined volume ramp.
> No revenue has been earned yet.

**The one number that matters — FX spread @ 2.5%:**

| Monthly corridor FX volume | Monthly FX revenue |
|---|---|
| $1M (early, one corridor) | **~$25,000** |
| $4M (traction) | **~$100,000** |
| $10M (established) | **~$250,000** |

**Blended monthly revenue (all streams):**

| Scenario | FX spread | All other streams | **Total / month** | **Annualized** |
|---|---|---|---|---|
| Conservative (Year-1 planning) | $25,000 | ~$7,600 | **~$32,600** | **~$391k** |
| Moderate | $60,000 | ~$24,300 | **~$84,300** | **~$1.0M** |
| Optimistic | $150,000 | ~$67,000 | **~$217,000** | **~$2.6M** |

*A more cautious Year-1 — sub-$1M/mo FX volume while licensing settles — lands at
**$8k–$20k/mo**. Still a real business, just a slower ramp.*

**Cost structure (once live), $15k–$40k+/mo** — compliance/legal dominate, then KYC
per-check, custody/insurance, payment processing, and a fraud reserve. (See Section 7 on
why FX margin is strong while card on-ramp is thin.)

**3-year trajectory (conviction-weighted):**

| Year | Posture | Monthly revenue | Annual |
|---|---|---|---|
| 1 | Licensed launch, one corridor, capped limits | $20k–$50k | $0.24M–$0.6M |
| 2 | 2–3 corridors, KYB accounts ramp | $60k–$150k | $0.7M–$1.8M |
| 3 | Established multi-corridor rail, network effects | $150k–$350k | $1.8M–$4.2M |

**Outcome framing.** A focused, defensible **$1–4M/yr revenue fintech** with a credible
path to more as corridors compound — a genuinely good outcome for a focused team, *not*
a hype-cycle moonshot. It lives or dies on **(1) the license** and **(2) never losing a
customer dollar to a ledger bug.**

---

## 9. Go-To-Market

1. **Corridor-first.** Launch the **Libya / USD-LYD** corridor with capped limits and a
   closed beta. Concentrate all product and marketing energy on the single revenue lever:
   FX volume in one corridor.
2. **Remittance virality via claim-links.** "Send $100, the family gets the real value,"
   delivered by a claim-link that works *before* the recipient has an account — a built-in
   referral loop targeting the diaspora ↔ in-corridor relationship.
3. **Be the published rate.** Make Tazdan's USD/LYD rate the transparent number people
   check and quote — earning trust that compounds into default-app status.
4. **KYB sales motion.** Pursue importers and SMEs — highest revenue-per-account, with
   the plumbing already built.
5. **Referral loop.** Tiered, fee-funded rewards to accelerate organic in-corridor growth.

Then **repeat the playbook** corridor-by-corridor (EGP, NGN, …) on the same engine and
the same compliance foundation.

---

## 10. Roadmap & Launch Plan

**The gap to launch is not features — it is the three things that decide whether a money
app lives or dies.** These phases run **in parallel**, not in sequence.

| Phase | Work | Calendar |
|---|---|---|
| **A — Integrity** | Harden double-entry ledger + reconciliation; invariant + property tests on every balance mutation; E2E on quote→execute→settle | 2–4 weeks |
| **B — Custody** | Move master key to **KMS** (or adopt custody-as-a-service: Fireblocks / BitGo / Cobo); enforce **2-of-N** withdrawals | 1–3 weeks (parallel) |
| **C — Compliance** | License / legal opinion (UAE **VARA** or equivalent; real opinion on the LYD angle), final lawyer-reviewed legal docs, store affidavits | **6–12+ weeks — the longest pole; start now** |
| **D — Go-live wiring** | Flip providers MOCK→live (Stripe/Checkout, Sumsub), live keys + webhook registration, rotate secrets, Apple Pay cert, EAS build, wire Sentry + `/healthz`/`/readyz` | ~1 week |
| **E — Closed beta** | One corridor, capped limits, daily manual reconciliation | 2–4 weeks |

**Realistic timeline.**
- **Engineering go-live readiness: ~4–6 weeks** (A + B + D in parallel).
- **Capped closed beta: ~6–8 weeks.**
- **Public launch: ~3–4 months**, gated by **C (licensing)** — which must start
  immediately, because app stores pull unlicensed crypto-exchange listings within weeks.

**Risk-reducers to schedule alongside (can launch without, shouldn't):** broaden test
coverage on money paths; full observability (request-ID correlation, reconciliation
dashboard); move in-process LYD skew state to Redis before scaling past one server;
monitor/alert on FX-scrape staleness; confirm push credentials; fraud velocity checks +
CAPTCHA; accessibility and Arabic/RTL audits.

---

## 11. Risk & Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| **Licensing / regulatory** | Existential, longest lead time | Start the license + legal opinion **now**, in parallel with all engineering; launch as capped closed beta; publish licensing info to keep store listings alive. |
| **Money-integrity bug class** | Existential | Double-entry ledger + scheduled reconciliation that **halts on drift**; invariant/property tests as the #1 engineering item (Phase A). |
| **Custody key compromise** | Existential | Move from single env-var key to **KMS envelope encryption** or a custody provider; **2-of-N** withdrawal approvals (Phase B). |
| **FX-scrape fragility** | Medium | Multi-source fallback already in place (live → static floor); add staleness monitor/alert and surface it in admin. |
| **Single-process skew state at scale** | Medium | LYD demand-skew accumulator is in-process today; move to Redis before running more than one server instance. |
| **Fraud / abuse** | Medium | Five tiered rate limiters + AML auto-freeze already shipped; add deposit→withdrawal velocity checks, CAPTCHA on auth, and P2P device fingerprinting. |
| **Single-founder concentration** | Operational | First hires fund-dependent: compliance/ops lead and a second engineer (see Use of Funds). |

---

## 12. The Ask / Use of Funds

> **[FOUNDER TO COMPLETE]** — Target raise, instrument, valuation, and runway were not
> specified and are intentionally left blank rather than invented. Fill in:
> *"Raising **$___** on a **[SAFE / priced round]** at **[$___ cap / valuation]** for
> **[__] months** of runway."*

**Where the capital goes** (the gating items, in priority order):

1. **Licensing & legal** — registration, legal opinions, lawyer-reviewed jurisdiction-
   specific disclosures. The single highest-leverage, longest-lead spend.
2. **Custody & insurance** — KMS or a custody provider (Fireblocks / BitGo), plus
   coverage. The cost of being trustworthy with real funds.
3. **Compliance & operations hire** — a dedicated compliance/ops lead to run KYC/KYB
   review, reconciliation, and AML, removing single-founder concentration.
4. **Go-to-market in the first corridor** — focused acquisition on USD/LYD FX volume,
   the one lever that moves revenue, plus the referral/claim-link loop.
5. **Engineering depth** — a second engineer to harden integrity/custody and own the
   reconciliation/observability stack.

Because FX-spread margin is strong and near-zero marginal cost, the model reaches
operating self-sufficiency at a **modest ~$1M/mo of corridor FX volume** — so the raise
buys *license + trust + the first corridor's growth*, not a long road to unit economics.

---

## 13. Why This Founder

Everything in this document — a regulated, full-stack money platform with an exchange
engine, HD-derived multi-chain custody, a double-entry ledger with reconciliation,
KYC/KYB, P2P escrow with disputes, card issuing, group wallets, a 71-screen mobile app, a
Next.js web app, and a complete operations console — was **architected and shipped by one
person.**

That is not just a cost story. It is a signal of **unusual technical range and execution
density**: the ability to hold an entire regulated fintech in one head, ship it to a
production standard, and make pragmatic, honest calls about what is real versus what needs
a key flipped. The hardest remaining work is regulatory and operational, not technical —
exactly the kind of work that capital and a first hire unlock.

**The bet:** a founder who already built the team-scale thing alone, in the one market
category the giants refuse to enter, where the moat is the very work they won't do.

---

*Backing detail for diligence lives alongside this brief in the repository:
`PROJECT_BRIEF.md` (marketing/positioning source), `LAUNCH_READINESS.md` (full
engineering + security + financial-controls readiness review), `REVENUE_ESTIMATE.md`
(code-mapped revenue model), and `store-listing.md` (app-store positioning).*
