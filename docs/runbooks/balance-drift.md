# Balance Drift Runbook

Trigger: `/api/admin/operational-readiness` reports `balanceDrift.status=critical` or trading is halted.

1. Stop new risky actions by leaving the trading halt enabled.
2. Open `/api/admin/fund-integrity` and identify affected currencies.
3. Compare `Wallet` balances, ledger accounts, deposits, withdrawals, and admin adjustments for the affected currency.
4. If the diff is a confirmed unrecorded external credit, use `/api/admin/fund-integrity/reconcile`.
5. If the diff is negative, do not reconcile. Freeze affected flows, export the audit log, and investigate missing debits/credits.
6. After the diff is zero and entries are explained, record `/api/admin/audit-log/review`, then clear the halt.

