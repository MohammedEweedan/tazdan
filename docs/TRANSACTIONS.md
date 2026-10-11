# Transactions and state

How Tazdan keeps money operations correct under concurrency, retries and failure.

## Atomicity

Every money operation runs in one database transaction that contains, together: the state transition, the wallet update, the ledger journal, the lifecycle record and the audit record. Either all are committed or none are. External calls (payout providers, blockchains, email) happen **outside** the money transaction; their outcome is applied afterwards by a second transaction that checks the state is still what it expected.

## Conditional transitions

Status changes are written as `UPDATE … WHERE id = ? AND status IN (expected)`, and the code checks that exactly one row changed (`assertTransitioned`). Two requests racing for the same transition cannot both win; the loser receives `409 TRANSACTION_CONFLICT`. Examples: deposit confirmation, withdrawal approval, claim-link redemption, P2P release/refund, approvals, business payouts, AI draft decisions, support escalations.

## Remittance state machine

`services/remittance/stateMachine.ts` holds an explicit edge whitelist over 23 states; `transition()` refuses anything else and writes an append-only `StateTransition` row with actor, reason, provider response and linked risk decision or ledger groups. See [REMITTANCE.md](REMITTANCE.md).

## Reservations

Funds committed to a pending operation are moved from spendable to `frozen` with one conditional statement (`reserveFunds`: succeeds only if `balance − frozen ≥ amount`). Completion spends the reservation (`settleReserve`); cancellation returns it (`releaseReserve`). Withdrawals, budgets, claim links, P2P escrow and business payout batches all use this. Administrative freezing of a customer never touches `frozen` (CL-01).

## Idempotency

| Operation | Key | Behaviour on retry |
|---|---|---|
| Remittance creation | `idempotencyKey` (client), plus single-use quote | Returns the original transfer (`duplicate: true`) |
| Business batch (app) | `Idempotency-Key` header | Returns the original batch |
| Public API payouts | `Idempotency-Key` header (required) | Returns the original batch with 200 |
| Provider callbacks | provider reference + current state | Re-applying a status is a no-op |
| Deposit confirmation, claim links, P2P | conditional transition | Second attempt fails with 409 |
| Chat messages | `clientId` | De-duplicated in client and server |

## Concurrency tests

`concurrency.money.test.ts` fires simultaneous requests at claim links, P2P cancellations, deposit confirmations, withdrawals and chat payments and asserts that money moves exactly once and never exceeds the balance. `remittance.golden.test.ts` spends one quote from many requests at once. `ledger.reconcile.test.ts` runs reconciliation during concurrent postings.
