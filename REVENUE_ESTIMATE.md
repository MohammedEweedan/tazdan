# Tazdan — Revenue Model & Estimate (v2)

**Date:** 2026-05-31
**Supersedes** the earlier estimate. That version listed memecoin minting and smart-contract deployment as revenue lines — **those are not built and are removed here.** This version only counts streams with shipped code behind them, and discounts assumptions to defensible levels.

---

## Honest framing first

Tazdan is, at its core, a **MENA-first FX-and-crypto rail whose defensible edge is the USD/LYD parallel-market spread.** Generic crypto trading competes head-on with Binance and loses on price; the LYD/FX angle is the real, hard-to-copy business. The model below reflects that: **the FX spread is ~60–75% of realistic revenue.** Treat the rest as retention surface, not the engine.

Every line maps to actual implemented code:

| Stream | Code that backs it |
|---|---|
| Exchange spread (crypto buy/sell) | `priceEngine.service` — admin-configurable spread, baked into quote |
| FX spread (USD/LYD + MENA fiat) | `fxRateProvider.service` + `lydOrderBook.service` — scraped floor + demand skew |
| Withdrawal fees | `withdrawal` / `cryptoWithdrawal` controllers → `collectFee()` |
| P2P escrow fees | `p2p.controller` (812 LOC, escrow + disputes) |
| Card interchange/issuing | `Card`/`CardTransaction` models, card issuer service |
| Business (KYB) tiered fees | `BusinessProfile` w/ volume-based `industry` tier |
| Liquidity pools | `LiquidityPool` (shared wallet / goal-based) |

---

## The one number that matters: FX spread

This is the business. Conservative math:

- Spread applied: **2.5%** default (admin-set), symmetric, **floored at the live street rate** so low demand can't erode it.
- The market is real: Libya's official vs parallel USD/LYD diverges ~40%+, and MENA remittance/FX demand is large and underserved by app-native rails.

| Monthly LYD/FX volume | Revenue @ 2.5% |
|---|---|
| $1M (early, one market) | **$25,000** |
| $4M (traction) | **$100,000** |
| $10M (established) | **$250,000** |

Volume here is the whole ballgame. $1M/mo is a few hundred active users moving meaningful sums — plausible in-market within months of a licensed launch. Everything else is rounding by comparison.

---

## Full stream estimate (defensible)

Assumptions deliberately conservative for a **new** emerging-markets app — the prior doc's "5,000 MAU each trading $2,400/mo" was ~5–10× too hot.

| Stream | Conservative (early) | Moderate | Optimistic |
|---|---|---|---|
| **FX spread (USD/LYD + MENA)** | **$25,000** | **$60,000** | **$150,000** |
| Crypto exchange spread (2.5%) | $3,000 | $9,000 | $25,000 |
| Withdrawal fees | $2,000 | $5,000 | $9,000 |
| P2P escrow fees | $800 | $2,500 | $6,000 |
| Card interchange + tiers | $500 | $3,000 | $10,000 |
| Business (KYB) accounts | $1,000 | $4,000 | $15,000 |
| Transfers / misc | $300 | $800 | $2,000 |
| **TOTAL / MONTH** | **~$32,600** | **~$84,300** | **~$217,000** |
| **TOTAL / YEAR** | **~$391k** | **~$1.0M** | **~$2.6M** |

**Read the conservative column as your real Year-1 planning number, and even that assumes you clear licensing and reach ~$1M/mo FX volume.** A more cautious Year-1 (sub-$1M FX volume while licensing settles) is **$8k–$20k/mo** — still a real business, just slower.

---

## Costs (the prior doc badly under-counted these)

For a regulated money app, compliance and fraud dominate — not hosting.

| Cost | Monthly |
|---|---|
| Compliance / legal / license maintenance | $5,000 – $20,000 |
| KYC/KYB per-check (Sumsub) | $1 – $3 × volume |
| Custody (Fireblocks/BitGo) or KMS + insurance | $2,000 – $10,000 |
| Payment processing (Stripe/Checkout) | 1.5–3% of card on-ramp |
| Chargebacks / fraud losses | budget 0.5–2% of card volume |
| Infra (DO/AWS, Redis, Postgres, Sentry) | $500 – $3,000 |
| Support / ops | $2,000 – $8,000 |
| **Realistic total** | **$15,000 – $40,000+/mo once live** |

Net margin is healthy **on the FX spread specifically** (near-zero marginal cost per trade). It is **thin or negative on card on-ramp** after processing + fraud. Don't blend them into one "75–90% margin" — that was the prior doc's biggest financial error.

---

## 3-year outlook (conviction-weighted)

| Year | Posture | Monthly Rev (realistic) | Annual |
|---|---|---|---|
| Year 1 | Licensed launch, one market, capped limits | $20k – $50k | $240k – $600k |
| Year 2 | 2–3 markets, business accounts ramp | $60k – $150k | $720k – $1.8M |
| Year 3 | Established MENA rail, network effects | $150k – $350k | $1.8M – $4.2M |

This is a **$1–4M/yr revenue business** if executed well — a genuinely good outcome for a focused fintech, **not** a unicorn, and it lives or dies on (1) the license and (2) never losing a customer dollar to a ledger bug.

---

## What would change these numbers most (in order)

1. **Licensing** — gates whether you can operate and stay in the stores at all.
2. **FX volume** — the single revenue lever; concentrate product + marketing here.
3. **Trust / integrity** — one public balance-loss incident in this market kills word-of-mouth permanently.
4. **Business/KYB accounts** — highest revenue-per-user; the KYB plumbing exists, so this is upside that's mostly sales/onboarding effort, not engineering.

---

*Comparables: Binance P2P MENA, regional remittance apps, and controlled-FX arbitrage rails. Adjusted down for a new entrant's volume ramp and up for the structural LYD spread advantage.*
