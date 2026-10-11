# Reconciliation

`services/reconciliation/recon.service.ts`; cockpit Reconciliation page.

## Provider statements

For each enabled external rail (scheduler every 30 minutes, or on demand), the provider's statement for the window is matched against internal payouts by provider reference:

| Result | Meaning |
|---|---|
| `MATCHED` | Reference, amount, currency, fee and status agree; a paid transfer moves to `RECONCILED → COMPLETED` |
| `MISSING_INTERNAL` | On the statement, not in Tazdan |
| `MISSING_EXTERNAL` | In Tazdan, not on the statement |
| `DUPLICATE` | Reference appears twice on the statement |
| `AMOUNT_MISMATCH` / `CURRENCY_MISMATCH` / `FEE_MISMATCH` | Values disagree |
| `STATUS_MISMATCH` / `LATE_SETTLEMENT` | Status differs; still pending well past the SLA |

Internal payouts (Tazdan wallet rail) are completed against the ledger directly.

## Integrity checks

| Check | Compares |
|---|---|
| Ledger cache | each account balance vs the sum of its entries |
| Conservation | sum of all entries per currency = 0 |
| Wallet read model | `Wallet.balance` vs the customer's `USER` ledger account |
| Negative wallets | impossible states |
| Treasury pools | Σ pool balances vs pool-related `TREASURY` ledger legs |
| Remittance clearing | clearing balance vs transfers funded but not yet paid or refunded |

A break that already has an open exception is not duplicated; an open exception whose break has disappeared is closed automatically with a note (escalated ones stay with their owner) (CL-23).

## Resolution

Operators with `recon.resolve` mark an exception resolved, escalated or written off, with a note; every decision is audited. Writing off does not move money — a correcting ledger adjustment goes through maker-checker.

## Known limitation

Integrity checks other than the ledger cache read several tables in separate queries, so a check during heavy traffic can raise a transient exception that clears on the next run. Moving them into one snapshot transaction is listed in [audit/TECHNICAL_DEBT.md](audit/TECHNICAL_DEBT.md).
