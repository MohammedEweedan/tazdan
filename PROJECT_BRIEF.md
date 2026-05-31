# Tazdan — Project Brief for Marketing & Investor Materials

**Audience:** Claude Design (marketing material + investor pitch decks)
**Date:** 2026-05-31 · reflects the *current* shipped codebase, not earlier drafts.
**One-liner:** The financial operating system for the world's broken-currency corridors — buy, sell, send, and spend crypto and fiat at the *real* rate, in markets the global giants won't touch.

---

## 1. Vision & Mission

**Vision.** A world where someone in Tripoli, Cairo, or Lagos has the same financial superpowers as someone in London — where a trapped local currency, a hostile banking system, and a 40% gap between the official and real exchange rate are no longer a life sentence.

**Mission.** Build the most trusted on/off-ramp and money-movement rail for emerging and controlled-currency markets: transparent pricing pinned to the real street rate, instant crypto↔fiat conversion, remittances that deliver the true value, and a full financial app (wallets, cards, P2P, business accounts) on top — all with bank-grade money integrity.

**Why now.** Billions of people live with parallel-market currencies (LYD, EGP, NGN, ARS, LBP, TRY…). Binance, Wise, and Stripe structurally avoid these corridors over compliance/FX-control risk. That avoidance is the opening: whoever does the hard work of operating there — compliantly, transparently, and accurately — owns the rail.

---

## 2. What Tazdan Is (the product)

A mobile-first **financial super-app** (iOS + Android, plus a web app and marketing site), backed by a production-grade exchange and custody engine.

### Core consumer features (all shipped)
- **Buy & sell crypto** — BTC, ETH, USDT, SOL, BNB, XRP and more, at live market prices with a transparent, disclosed spread. Pay from any wallet — fiat (USD/GBP/EUR/AED/LYD…), stablecoin, or card.
- **Real-rate FX** — the headline differentiator. Live parallel-market rates (e.g. USD/LYD) scraped + demand-adjusted, so users transact at the *real* street rate, not the fictional official peg. Published, transparent, defensible.
- **Send money (transfers & claim links)** — send to any @handle, email, or phone; recipients claim via a link, even before they have an account. The remittance killer feature: "send $100, your family gets the real value."
- **Tazdan Card** — issue virtual cards with spend controls, limits, freeze, and cashback. Spend trapped local balances globally.
- **P2P marketplace** — peer-to-peer crypto/fiat trading with escrow, disputes, and reputation.
- **Recurring buys** — dollar-cost-averaging on a schedule.
- **In-app chat & group wallets** — social money: chat, split, and pool funds (shared wallets / goal-based savings pots).
- **Three themes** including a striking monochrome mode.

### Business / institutional (shipped)
- **Business accounts (KYB)** — company onboarding with volume-based fee tiers; the foundation of a "treasury for frontier markets" — multi-currency accounts, supplier payouts, the high-value, sticky segment.

### Admin & operations (shipped)
- Full ops console: live metrics, exposure/holdings analytics, FX order-book monitoring, KYC/KYB review, deposits/withdrawals, fee ledger, AML flags, treasury-integrity dashboard.

---

## 3. Trust & Security (the part that wins a regulated-market pitch)

Money apps live or die on integrity. Tazdan's engine is built like a bank's:
- **Double-entry ledger** — every movement is a balanced, conservation-checked transaction. Money cannot be created or destroyed; a continuous reconciliation halts trading on any drift.
- **The ledger is the source of truth** — spending is gated by the ledger's own balance check, not a mutable cache.
- **KMS-backed custody** — the master wallet seed is envelope-encrypted with AWS KMS; a database or server leak alone cannot decrypt funds.
- **Multi-sig withdrawals** — high-value payouts require multiple independent admin approvals; no single compromised session can drain the treasury.
- **Step-up authentication** — withdrawals, trades, and transfers over $1,000 (or from an unrecognized device) require a fresh 6-digit code via email or authenticator app.
- **KYC/KYB** — real identity verification (Sumsub) gating deposits and withdrawals.
- **Hardened surface** — 2FA on trades, tiered rate limiting, signed webhooks, parameterized queries, input sanitization, and a built-in stress/pentest harness.

**Marketing translation:** "Your money, provably safe — down to the 0.000000001."

---

## 4. Scope & Scale (engineering credibility for the deck)

- ~100,000 lines of production code across mobile (React Native/Expo, 70+ screens), server (Node/Express/PostgreSQL, 50+ data models), and web (Next.js).
- Live integrations: Binance (pricing/execution), Sumsub (KYC), Stripe + Checkout.com (card/bank on-ramp), 1inch (DEX), on-chain settlement (BTC/ETH/SOL/TRON), AWS KMS, Sentry.
- Multi-currency, multi-corridor by design — the same engine that prices USD/LYD scales to EGP, NGN, ARS, and beyond with configuration, not rebuilds.

---

## 5. Market & Positioning

**The wedge:** controlled/parallel-currency corridors — multi-billion-dollar informal FX + remittance markets (Libya, Egypt, Nigeria, Lebanon, Turkey, Sudan, the MENA/Africa diaspora) that incumbents won't serve.

**The moat (in priority order):**
1. **Be the rate.** Own price discovery for parallel currencies — the trusted, published number people quote.
2. **Regulatory work as IP.** Doing the licensing nobody else will is the barrier competitors can't cheaply cross.
3. **Network effects.** Each P2P trader, agent, business, and remittance recipient deepens liquidity and tightens the rate.

**Positioning vs. incumbents:** Binance/Revolut have the features; none operate the corridors. Tazdan = "the super-app for the markets the giants abandoned."

---

## 6. Business Model & Revenue Streams (all backed by shipped code)

| Stream | Mechanic |
|---|---|
| **FX spread** (primary, ~60–75% of revenue) | Transparent markup on parallel-currency conversion, floored at the live street rate |
| Crypto exchange spread | Configurable markup on buy/sell (default 2.5%) |
| Withdrawal fees | Flat/percentage on fiat & crypto withdrawals |
| P2P escrow fees | Commission on peer trades |
| Card interchange + tiers | Issuing revenue + premium card tiers |
| Business (KYB) accounts | Volume-tiered fees on the highest-value segment |

---

## 7. Financial Projections (defensible, current model)

**Framing for investors:** the FX spread is the engine; everything else is retention surface. Numbers assume a licensed launch and conservative volume ramp.

**The lever — FX spread @ 2.5%:**
| Monthly corridor FX volume | Monthly FX revenue |
|---|---|
| $1M (early, one corridor) | ~$25,000 |
| $4M (traction) | ~$100,000 |
| $10M (established) | ~$250,000 |

**Blended monthly revenue:**
| Stage | Monthly | Annualized |
|---|---|---|
| Conservative (Year 1) | ~$32,000 | ~$390,000 |
| Moderate | ~$84,000 | ~$1.0M |
| Optimistic | ~$217,000 | ~$2.6M |

**3-year trajectory:**
| Year | Posture | Monthly | Annual |
|---|---|---|---|
| 1 | Licensed launch, 1 corridor, capped limits | $20k–$50k | $0.24M–$0.6M |
| 2 | 2–3 corridors, business accounts ramp | $60k–$150k | $0.7M–$1.8M |
| 3 | Established multi-corridor rail | $150k–$350k | $1.8M–$4.2M |

**Cost structure (be honest in the deck):** compliance/legal, KYC per-check, custody/insurance, payment processing, and fraud reserve dominate — budget $15k–$40k/mo once live. Margin is strong on FX spread (near-zero marginal cost), thinner on card on-ramp.

**Outcome framing:** a focused, defensible **$1–4M/yr revenue** fintech with a credible path to more as corridors compound — not a hype-cycle moonshot, a real business in a real, underserved market.

> Note for materials: do not present any unbuilt feature as revenue. Everything above maps to shipped code. Projections are illustrative and contingent on licensing + volume — label them as such.

---

## 8. Brand & Design Direction (for the creative team)

- **Tone:** confident, transparent, empowering. Anti-establishment in spirit (we serve who the giants ignore) but bank-grade in trust.
- **Visual language:** clean, monochrome-forward, premium fintech (the app ships a monochrome theme — lean into black/white/grey with sharp typography). Avoid the cluttered "crypto casino" aesthetic.
- **Hero messages to explore:** "The real rate. Finally." · "Money that works where you do." · "Send home what they're actually owed." · "Built for the markets the banks left behind."
- **Proof points for the deck:** double-entry ledger + KMS custody + multi-sig (trust); live parallel-rate engine (differentiation); claim-link remittance (virality); KYB business accounts (revenue density).
- **Audiences:** (1) consumers in-corridor, (2) diaspora remitters, (3) SMEs/importers, (4) investors.

---

*Prepared from a direct review of the current codebase. For deeper technical detail see LAUNCH_READINESS.md and REVENUE_ESTIMATE.md.*
