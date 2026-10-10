# Blockchain

## Networks

| Asset | Network | Deposits | Live withdrawal broadcast |
|---|---|---|---|
| ETH | Ethereum | yes | yes |
| USDT | ERC-20 | yes | yes |
| USDT | TRC-20 | yes | **no** — gated until a TRX fee-delegation treasury exists |
| BTC | Bitcoin (P2WPKH, broadcast via mempool.space) | yes | yes |
| SOL | Solana (native transfer via RPC) | yes | yes |

Other assets (BNB, XRP, ADA, DOGE, MATIC, DOT, AVAX) are held as internal balances for trading and are not withdrawable on-chain.

## Custody model

HD wallets derived from a master seed (`services/wallet/walletDerivation.service.ts`, `masterSeed.service.ts`); the seed is encrypted with AES-256-GCM, its data key wrapped by AWS KMS when `MASTER_SEED_KMS_KEY_ID` is set (otherwise a local environment key — development only). Deposit addresses are per customer; deposits are verified on-chain (`depositVerification.service.ts`) before crediting. Self-custody linking is supported for display.

## Withdrawals

`POST /api/withdrawal/initiate` (instant path): kill switches (`withdrawals`, `blockchain`), address validation per chain, verified email, mandatory TOTP, a 24-hour allow-list for new addresses, KYC limits, screening of the destination address, the risk engine (anything short of approve is refused), then debit and broadcast (`onchainSettlement.service.ts`). A failed broadcast is refunded (`onchain_withdrawal_refund`). Simulated broadcasts are allowed only outside production with `ALLOW_SIMULATED_ONCHAIN_BROADCAST=1`.

The staff-approved path (`POST /api/withdrawals`) reserves funds and waits for approval in the cockpit queue.

## Ledger

`onchain_deposit`, `onchain_withdrawal` and `onchain_withdrawal_refund` journals against `SYSTEM_CHAIN`. A periodic fund-integrity audit compares internal holdings with on-chain balances.

## Known gaps

TRON broadcasting; no chain-analytics (address risk scoring) vendor — destination screening relies on imported watchlist entries; the platform is the counterparty when the hedge venue is unreachable ([audit/TECHNICAL_DEBT.md](audit/TECHNICAL_DEBT.md)).
