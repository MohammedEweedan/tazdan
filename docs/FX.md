# FX

## Rate sources

`services/exchange/fxRateProvider.service.ts` resolves a pair in this order:

For supported cash pairs involving LYD, **Fulus is the authoritative reference in both directions**. Its finite positive rate is accepted without range caps, jump holds or manual rate substitution. If there is no Fulus observation, these pairs are unavailable. Executable LYD prices come from the LYD market maker (below), never straight from the reference, and never from a stale one.

For other pairs:

1. An active treasury **override** within its expiry (set only through maker-checker, 5 minutes to 24 hours, spread ≤ 20%).
2. **Fulus** — the primary real-time LYD parallel-market rate (webhook plus polling fallback).
3. Public reference feeds (open.er-api) with derivation through USD for crosses.
4. A static fallback table — **never** used for executable prices: conversions, swaps and remittance quotes refuse `fallback:` sources in production; outside production a quote records that it used one.

Rates are cached for 60 seconds (`FX_CACHE_TTL_MS`) and sanity-bounded per pair (a feed outside its window is treated as poisoned). USD/LYD ticks are stored (`FxRateTick`) for the cockpit's history chart.

## Executable prices

- **Swaps** (`/api/wallets/swap`): `quoteConversion` values the source at its executable SELL price and the target at its BUY price; the credit is rounded down. `GET /api/wallets/swap/quote` returns the same calculation without moving money; the swap accepts `minCredited` and refuses to fill below it.
- **Remittance**: customer rate = mid × (1 − corridor spread × (1 − tier discount)); corridor rate floors and ceilings pause quoting on anomalies rather than clamping.

## LYD market maker

`services/exchange/lydMarketMaker.{math,service}.ts`. Every LYD quote path uses it: `getRate` for X/LYD and LYD/X, swaps (USDT/LYD is USDT at par through USD/LYD), and crypto quotes funded or settled in LYD.

**Pips.** 1 pip = `pipSize` LYD on USD/LYD (default 0.0001; quoted to 4 dp). Every spread and skew setting is a whole number of pips. Other currencies use the same pips as fractions of the USD/LYD reference, applied to their own Fulus rate, with extra decimals for cheap currencies.

**Quote** (R = Fulus, σ = applied skew, W = widening):

| | Formula | Default |
|---|---|---|
| ask (we sell USD) | R + (base + W + σ) pips, rounded up | R + 500 |
| bid (we buy USD) | R − (base + W − σ) pips, rounded down | R − 500 |
| **floor** (owner) | ask ≥ R + (askFloorOffset + W) pips | offset 0: seller pressure can take the ask down to Fulus, never below |
| **cap** | ask ≤ R + (base + W + maxUpSkew) pips | +800 at most |
| bid margin | bid ≤ R − (minHalfSpread + W) pips | ≥ 100 below Fulus |

With the default offset of 0, an ask sitting exactly on the floor earns nothing on that side against Fulus. The bid side always earns at least `minHalfSpreadPips`.

**Skew.** Committed LYD trades (swap and crypto-order Transaction rows; failed orders skipped) are ingested by the scheduler worker into Redis. Per customer: opposite trades are FIFO-matched (round trips count for nothing), the remainder decays with `flowHalfLifeSec`, then it is capped at `perUserCapUsd`. Imbalance I = Σnet / max(Σ|net|, depthUsd). Target = sign(I) × round(|I| × maxSkew / step) × step, where maxSkew is `maxUpSkewPips` when customers net-buy USD (both sides step up) and `maxDownSkewPips` when they net-sell (both step down; validated ≤ base − floorOffset). The target is 0 below `minVolumeUsd` or `minTraders` distinct customers. A token bucket moves σ by at most `maxSkewChangePipsPerMin`, with at most one minute's worth banked, and updates atomically in Redis (Lua).

**Safety.** If Fulus last confirmed the reference more than `refFreshSec` ago (15 min), the quote widens by `staleWidenPips`. Past `refMaxAgeSec` (60 min), quoting stops (503). If Redis is unavailable, a process-local copy is used and the quote widens by `degradedWidenPips`. Locked crypto quotes settled in LYD are re-checked when consumed: if the market moved through the price, the fill is refused (409). Swaps re-price at execution and honour `minCredited`.

**Configuration.** PlatformSettings `fx_market_maker.LYD`. It takes effect only when bound to an approved maker-checker request and its `FX_MM_CONFIG_APPLIED` audit row, so a direct settings write is ignored (defaults, or the last verified config, stay in force). To change it: `POST /api/cockpit/approvals` `{ type: 'FX_OVERRIDE', payload: { kind: 'MARKET_MAKER_CONFIG', changes: { baseHalfSpreadPips: 400, maxDownSkewPips: 400 } }, reason }`, then a second `fx.override` holder approves at `/api/cockpit/approvals/:id/decide`. Bounds are validated on both request and approval.

**Kill switches.** `POST /api/cockpit/controls` `{ scope: 'PROVIDER', key: 'FX_MM:USD/LYD' | 'FX_MM:LYD' (all pairs), blocked, reason }`. A failed switch lookup halts quoting; it never allows it.

**Visibility.** Staff: `GET /api/cockpit/fx` → `rates[].live.marketMaker` (reference, bid, ask, mid, spread, skew and target in pips, widening, mode, flow, config and its source, halt state, estimated captured LYD). Customers see only their executable price.

**Revenue.** Crypto orders in LYD fold the LYD margin (vs reference) into `spreadCapture`, so the existing fee collection books it. Swaps: `conversionLedgerLegs()` / `lydConversionMargin()` build the journal with a PLATFORM leg, ready to wire into the swap handler.

**Risk.** The profit guarantee is per fill, against the reference at quote time. Inventory we hold still moves with the parallel rate; limit and hedge it separately.

## Controls

- FX overrides: requested with a reason, approved by a second person, applied with expiry, audited (`FX_OVERRIDE_APPLIED`), visible on the cockpit FX page with history.
- Kill switch `fx` stops swaps; the ledger trading halt stops exchange orders.
- Revenue: remittance fees and FX margin are recognised at payout as `PLATFORM` credits and reported on the Finance page.
