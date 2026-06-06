# Ledger Unification Runbook

Goal: every real balance movement is mirrored into the double-entry ledger in the same database transaction.

## Required Pattern

Any code that changes `Wallet.balance`, `UserWallet.*Balance`, or `altBalances` must do one of:

- call `postLedger()` inside the same transaction, or
- change only `frozen`/reserved state without changing total balance, or
- document why the value is not user money.

## External Credits

Use this ledger shape for deposits, on-ramp credits, opening balances, and admin credits:

- `SYSTEM_ONRAMP`, negative amount
- `USER`, positive amount

## External Debits

Use this ledger shape for withdrawals and off-ramp payouts:

- `USER`, negative gross amount
- `SYSTEM_OFFRAMP`, positive net amount
- `PLATFORM`, positive fee amount when a fee is retained

## Internal Transfers

Use this ledger shape for transfers and claim-link redemption:

- sender `USER`, negative gross amount
- recipient `USER`, positive received amount
- `PLATFORM`, positive fee amount when a fee exists

## Test Coverage

Every balance-mutating endpoint needs an integration test that asserts:

- the API succeeds,
- visible `Wallet` or `UserWallet` balances changed as expected,
- `LedgerEntry` rows exist for the same reference,
- entries sum to zero per currency,
- user `LedgerAccount.balance` matches the expected post-action value.

Covered in `server/src/__tests__/balanceMutations.test.ts`:

- admin deposit confirmation,
- admin manual credit,
- claim-link redemption.

Next endpoints to cover:

- fiat withdrawal process and rejection,
- crypto order buy and sell,
- internal transfer,
- P2P escrow release,
- card top-up and physical-card fee,
- budget-to-card funding.

