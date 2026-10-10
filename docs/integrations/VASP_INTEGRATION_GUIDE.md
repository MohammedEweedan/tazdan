# VASP and liquidity integration guide

Status: **on-chain custody live for ETH, USDT-ERC20, BTC and SOL; hedging venue unreachable from production.**

## Liquidity / hedging

Buy and sell orders are priced from live market data; the hedge order goes to Binance (`services/exchange/orderExecution.service.ts`). Binance is geo-blocked from the production host, so orders fall back to a simulated fill and **Tazdan carries the market risk**. Options: a reachable venue or OTC desk with an API (implement the order execution interface), a proxy in an allowed region, or an explicit principal-risk policy with exposure limits and daily reporting ([../business/hedging-execution-plan.md](../business/hedging-execution-plan.md)).

## Custody

Master seed under KMS envelope encryption (`MASTER_SEED_KMS_KEY_ID` must be set in production); hot-wallet limits; on-chain deposit verification; fund-integrity audit. A third-party custodian would replace `walletDerivation` and `onchainSettlement` behind the same calls.

## Travel rule

Not implemented. For VASP-to-VASP transfers above thresholds, integrate a travel-rule network and attach originator/beneficiary data to on-chain withdrawals.
