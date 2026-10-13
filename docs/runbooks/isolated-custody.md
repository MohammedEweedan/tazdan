# Isolated custody activation

Production API signing is disabled. `CUSTODY_MODE=disabled` is the default. `getMasterMnemonic()` refuses all production calls, and production boot rejects master-seed encryption/KMS variables. Envelope encryption alone does not isolate a signer if the API can ask KMS to decrypt it.

Deploy a separate custody service or integrate a contracted custodian behind this gateway contract before selecting `CUSTODY_MODE=remote`. This repository provides the API client and recovery worker, not a deployed custodian or independent withdrawal policy engine. Give the API no seed, private key, KMS decrypt permission, or custody administrative role. Use separate infrastructure, administrator identities, secret stores and network access. The gateway must independently enforce approved destinations, limits, sanctions screening, maker/checker approval, liquidity/gas policies and withdrawal idempotency. An API bearer token must not bypass those controls.

## Gateway contract

Set `CUSTODY_PROVIDER_CODE` to the exact approved code in the release manifest. New address provisioning and withdrawals verify that scope. HTTPS only in production; redirects are rejected, request timeout is 15 seconds. Authenticate with a dedicated `CUSTODY_PROVIDER_TOKEN` of at least 32 characters. Restrict API egress to the gateway and apply mTLS at the deployment boundary where supported.

- `POST /v1/wallets`, `Idempotency-Key: wallet_<walletIndex>`; body `{userId,walletIndex}`. Return `{ethAddress,btcAddress,solAddress,tronAddress}`. Persist the mapping before replying. Retries must return identical addresses.
- `POST /v1/withdrawals`, `Idempotency-Key: <operationId>`; body `{operationId,userId,walletIndex,asset,network,amount,toAddress}`. Persist immutable terms and outcome before broadcasting. Never broadcast twice for one operation id. Reject different terms with the same id. Return the status object below.
- `GET /v1/withdrawals/<operationId>` returns `{operationId,status,txHash,definitiveNoBroadcast?}`. Status is `UNKNOWN`, `PENDING`, `CONFIRMED` or `REJECTED`. `txHash` is null or the immutable chain reference. `CONFIRMED` must represent the independently verified finality policy. `definitiveNoBroadcast=true` is allowed only when the gateway has durable proof this operation never broadcast and can never broadcast later. A lost reply or missing record is UNKNOWN.

The API commits a debit and balanced journal under `BROADCAST_UNKNOWN` before calling the gateway. A timeout preserves that debit. Retries return the same operation. The minute worker queries status without resubmitting. Only REJECTED with `definitiveNoBroadcast=true` and no hash can refund; the status transition and refund journal commit atomically. A reconciliation exception preserves funds and requires operator review. Unknown operations appear in the operations report and protected metrics. Never manually rebroadcast or reset an unknown operation to an unsent state.

Current live withdrawal paths remain ETH/ERC20, USDT/ERC20, BTC native and SOL native. Unsupported networks fail before debit. TRC20 withdrawal is closed until a reviewed energy/gas and settlement integration is implemented. Local signing and simulated broadcasts are development/test only.

## Existing-wallet migration

Existing addresses are immutable customer deposit destinations. Do not generate replacement addresses and assume old assets moved. Inventory every address/index, pending operation, balance and chain holding. Prove the custodian can control or sweep each old address, including gas, UTXOs, finality and late deposits. Use an approved migration with independent reconciliation before switching gateway mappings. Keep old-address monitoring and customer communication until late deposits are handled. A wallet/address provisioning retry must never allocate a second address set.

## Required activation evidence

Attach contracted provider terms and exact supported networks; separate custody access-control review; independent penetration test; policy-bypass tests under compromised API credentials; key recovery and custodian outage drills; timeout/replay/concurrent retry tests; confirmed-no-broadcast refund proof; hot-wallet limits and cold-storage ceremony; named on-call owners. Store private evidence outside Git and reference its digest in the release manifest. All gates remain pending until these proofs exist. Local fixture tests do not meet provider activation evidence.
