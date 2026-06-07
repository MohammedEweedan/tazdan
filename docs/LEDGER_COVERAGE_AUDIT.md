# Ledger Coverage Audit

_Generated 2026-06-07. Static analysis only — not yet validated against a live DB._

## Method

Cross-referenced every controller/service that mutates `wallet.balance`, `wallet.frozen`,
or `ledgerAccount.balance` against calls to `postLedger()` (the canonical double-entry
writer in `src/services/ledger/ledger.service.ts`, which enforces the per-currency
conservation invariant).

## The canonical pattern

The **live buy/sell path is ledger-correct**:

```
mobile  →  POST /api/exchange/{quote,execute}
        →  exchange.controller
        →  orderExecution.service.ts  →  postLedger(tx, { legs, refType, refId })  ✅
```

`recurringBuy.service` and `feeCollector.service` also route through
`orderExecution.service`, so recurring buys + fee collection are covered.

## Findings

### ✅ Already double-entry correct
| Path | Mechanism |
|------|-----------|
| Buy / Sell (live, mobile) | `exchange.controller → orderExecution.service → postLedger` |
| Recurring buys | `recurringBuy.service → orderExecution.service` |
| Fee collection | `feeCollector.service → orderExecution.service` |
| Deposits | `deposit.controller` calls `postLedger` directly |
| Transfers | `transfer.controller` calls `postLedger` |
| Claim links | `claimLink.controller` calls `postLedger` |
| Admin adjustments | `admin.controller` calls `postLedger` |

### ✅ CLOSED (2026-06-07) — ledger legs added
| Path | Mechanism |
|------|-----------|
| **P2P escrow lock** | seller USER → SYSTEM_ESCROW (`p2p_escrow_lock`), wrapped in a tx with the `frozen` reservation |
| **P2P escrow release** | SYSTEM_ESCROW → buyer USER (`p2p_escrow_release`) |
| **P2P escrow refund / cancel** | SYSTEM_ESCROW → seller USER (`p2p_escrow_refund`) |
| **Card top-up** | user USER → SYSTEM_OFFRAMP (`card_topup`) |
| **Card physical fee** | user USER → PLATFORM (`card_physical_fee`) |
| **Card budget load** | user USER → SYSTEM_OFFRAMP (`card_budget_load`) |
| **Referral payouts** | PLATFORM → user USER (`referral_reward`), loop now atomic |
| **Withdrawal freeze/cancel/reject** | No leg needed by design — these only touch the `frozen` reservation (no balance moves). Settlement already had a correct leg. Cancel + reject hardened to run in a transaction. |

### ❌ Still open (lower priority)
| Path | File | Risk |
|------|------|------|
| **Wallet internal move** | `wallet.controller.ts:210,214` | MED — verify whether this is a user-facing path or internal rebalance. |
| **Liquidity pool deposits/payouts** | `liquidityPool.controller.ts:317,434` | LOW/MED — depends on whether LP is launch-scoped. |

### ✅ Legacy / orphaned — REMOVED (2026-06-07)
| Path | Note |
|------|------|
| `order.controller.ts` (`/api/orders`) | Deleted — route, controller, and mount removed. Mobile used `/api/exchange` (ledger-correct); the orphaned non-ledger money route is gone. |

## Recommended remediation order (each needs DB-backed test before merge)

1. **P2P** — wrap escrow/release/refund/dispute balance moves in `postLedger` legs
   (USER ↔ ESCROW system account). Highest custody risk.
2. **Card** — fund/spend/cashback + budget-wallet moves through `postLedger`.
3. **Withdrawals** — add ledger legs for freeze→settle and unfreeze→refund.
4. **Referral** — offsetting system-rail leg for payouts.
5. **Delete or convert** `order.controller` to remove the orphaned non-ledger path.
6. **Wallet internal move + LP** — confirm scope, then convert.

## Cannot be closed without infrastructure
- Running `balanceMutations.test.ts` / `ledger.test.ts` — **no Postgres on this host.**
- Production dry-run of `backfill.service` / `reconcile.service`.
- Confirming credited balances render in admin double-entry views.

These are infra/process gaps, not code gaps.
