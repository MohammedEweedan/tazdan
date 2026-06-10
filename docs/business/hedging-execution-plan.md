# Execution & hedging plan — closing the unhedged book

## The problem

Binance market execution is geo-blocked (HTTP 451) from the droplet and
`placeBinanceMarket` cannot fill. Today, when a user buys/sells crypto, the
platform itself is the counterparty: user balances move, the platform's
position does not. That means:

- The platform is **net short** every asset users hold (exposure dashboard's
  "if all users sold instantly" number is real, unhedged P&L risk).
- The spread (2.5%) is compensation for *execution*, not for *market risk* —
  a 10% BTC overnight move eats 4 spreads of margin.
- The fund-integrity audit can stay green while the treasury silently loses
  economic value (it audits quantity conservation, not mark-to-market).

## Fix in three stages

**Stage 1 (this month) — execution via a reachable venue.**
Run order execution from a jurisdiction where a tier-1 venue serves the
entity (this also pairs with the licensing memo):
- Easiest: a $10/mo VPS in a permitted region (e.g. EU) running a tiny
  "execution relay" — the droplet calls it over mTLS; it holds the exchange
  API key (withdrawals-disabled key!) and places the order. ~200 lines.
- Venue choice: Kraken or OKX (check entity eligibility), Binance via the
  relay region if compliant for the entity. Keep TWO venues configured —
  one venue ban must not re-create this problem.

**Stage 2 — net-exposure hedging, not per-order.**
Per-order fills are operationally heavy at small volume. Instead, every N
minutes compute net user-position deltas per asset (the exposure endpoint
already computes holdings) and rebalance the platform's venue account to
match. Band-based: only trade when |delta| > band (e.g. $500/asset). This
caps market risk at the band size while keeping venue fees tiny.

**Stage 3 — LYD inventory policy.**
LYD cannot be hedged on any exchange — LYD exposure IS the business. Policy:
- Define max LYD inventory (e.g. the float needed for 3 days of corridor
  payouts) and rebalance via the P2P book + partner network beyond it.
- The existing skew mechanism (lydOrderBook) already leans price against
  net flow — formalize its parameters as the official inventory-defense.
- Track USD-value of LYD float daily on the admin dashboard (add a tile) so
  devaluation risk is visible, not discovered.

## Treasury rules to adopt with this

1. Platform daily on-chain withdrawal caps (now enforced in code) sized to
   the hot wallet policy (custody-kms runbook).
2. Weekly mark-to-market of the whole book (assets at venue + hot + cold −
   user liabilities) — one number, one spreadsheet row per week, signed.
3. The ~unexplained USDT delta: run `scripts/diagnose-fund-integrity.ts` in
   prod, attribute it, book the reconciliation, and treat any FUTURE drift
   as an incident (the audit then has teeth).
