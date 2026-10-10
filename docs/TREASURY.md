# Treasury

`services/treasury/pools.service.ts`; cockpit Treasury page.

## Pools

One pool per payout rail and currency (`SANDBOX_GB_FPS-GBP`, `TAZDAN_WALLET-LYD`, …), recording entity, location, fund class, target, minimum and maximum exposure. **Pools start empty**; balances come only from recorded movements.

## Movements (append-only)

| Type | Meaning | Ledger |
|---|---|---|
| `PREFUND` | Money sent to the partner | TREASURY + / SYSTEM_ONRAMP − |
| `WITHDRAW` | Money returned from the partner | reverse of prefund |
| `ADJUST_IN` / `ADJUST_OUT` | Statement corrections | TREASURY ⟷ ADJUSTMENT |
| `RESERVE` | Earmark for a routed transfer (row lock on the pool) | — |
| `RELEASE` | Earmark returned (cancel, failure) | — |
| `CONSUME` | Earmark spent when the payout is paid | part of the payout journal |

Balance = prefunds − withdrawals ± adjustments − consumed; available = balance − open reservations. Reservation takes a row lock so two transfers cannot both reserve the same liquidity.

## Alerts

Low liquidity (available below minimum; critical at zero), below target, exposure above maximum, rapid depletion (more than half the balance paid out in 24 h), concentration (one pool holds over 80% of a currency) and overdue settlement obligations for post-funded partners. Shown on the Treasury page and counted on the Overview.

## Forecast

The Forecasts page shows days of cover per pool at the 30-day average payout rate and the shortfall over the chosen horizon.

## Operations

Recording a movement requires `treasury.operate`, a bank or partner reference and a note; thresholds changes are audited. Pools and ledger positions are reconciled continuously ([RECONCILIATION.md](RECONCILIATION.md)). Note that the ledger `TREASURY` account also holds source-currency principal collected from senders until it is swept, so it can exceed pool balances; integrity checks compare only pool movements.
