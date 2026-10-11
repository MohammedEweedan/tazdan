# FX

## Rate sources

`services/exchange/fxRateProvider.service.ts` resolves a pair in this order:

For supported cash pairs involving LYD, **Fulus is authoritative in both directions**. Its finite positive reference rate is accepted without range caps, jump holds, demand skew or manual rate substitution. If there is no Fulus observation, these pairs are unavailable. Cached Fulus observations remain the last known rate during provider outages. Trading spreads/fees are applied separately to executable quotes.

For other pairs:

1. An active treasury **override** within its expiry (set only through maker-checker, 5 minutes to 24 hours, spread ≤ 20%).
2. **Fulus** — the primary real-time LYD parallel-market rate (webhook plus polling fallback).
3. Public reference feeds (open.er-api) with derivation through USD for crosses.
4. A static fallback table — **never** used for executable prices: conversions, swaps and remittance quotes refuse `fallback:` sources in production; outside production a quote records that it used one.

Rates are cached for 60 seconds (`FX_CACHE_TTL_MS`) and sanity-bounded per pair (a feed outside its window is treated as poisoned). USD/LYD ticks are stored (`FxRateTick`) for the cockpit's history chart.

## Executable prices

- **Swaps** (`/api/wallets/swap`): `quoteConversion` values the source at its executable SELL price and the target at its BUY price; the credit is rounded down. `GET /api/wallets/swap/quote` returns the same calculation without moving money; the swap accepts `minCredited` and refuses to fill below it.
- **Remittance**: customer rate = mid × (1 − corridor spread × (1 − tier discount)); corridor rate floors and ceilings pause quoting on anomalies rather than clamping.

## Controls

- FX overrides: requested with a reason, approved by a second person, applied with expiry, audited (`FX_OVERRIDE_APPLIED`), visible on the cockpit FX page with history.
- Kill switch `fx` stops swaps; the ledger trading halt stops exchange orders.
- Revenue: remittance fees and FX margin are recognised at payout as `PLATFORM` credits and reported on the Finance page.
