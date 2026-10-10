# Bank integration guide

Status: **internal implementation complete for manual bank operations; automated bank connectivity not built.**

## Today

- **Deposits**: customers transfer to a Tazdan bank account shown in the app (entered by an administrator in Platform banks — nothing is seeded), quote their reference and submit a deposit claim; staff confirm in the deposit queue, which posts `SYSTEM_ONRAMP → USER`.
- **Withdrawals**: customers request; staff approve in the withdrawal queue and execute the bank transfer outside the platform; approval settles the reservation and posts `USER → SYSTEM_OFFRAMP`.
- **Treasury**: prefunds and withdrawals to partners are recorded with bank references.

## Automating a bank

| Capability | Integration | Tazdan hook |
|---|---|---|
| Incoming credit notifications (webhook, camt.054, MT940) | Match by reference and amount to pending deposit claims | Deposit confirmation service (conditional transition + journal) |
| Statements (camt.053 / MT940) | Daily reconciliation of `SYSTEM_ONRAMP` / `SYSTEM_OFFRAMP` movements | New reconciliation source alongside provider statements |
| Outgoing payments (pain.001, API) | Execute approved withdrawals | Implement as a payout provider (`category: 'BANK'`) |
| Safeguarding account balances | Daily customer-funds check | Compare with `CUSTOMER` fund-class ledger total |

Rules: credit only on confirmed funds; idempotency by bank transaction id; never auto-credit an unmatched payment — route to `SUSPENSE` for investigation.
