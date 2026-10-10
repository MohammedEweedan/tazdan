# Operations

Day-to-day running of Tazdan, mostly from the Control Cockpit. Detailed procedures live in [runbooks/](runbooks/).

## Daily

| Task | Where | Permission |
|---|---|---|
| Work deposit, withdrawal (watch risk notes) and KYC queues | Cockpit → Operations | `deposits.confirm`, `withdrawals.approve`, `customers.kyc.review` |
| Decide remittances in review; retry or refund failed payouts | Remittance | `compliance.decide`, `remittance.operate` |
| Work compliance cases, screening hits, KYB | Compliance, Businesses | compliance permissions |
| Approve or reject pending approvals (not your own) | Approvals | per type |
| Check treasury alerts; record prefunds with bank references | Treasury | `treasury.operate` |
| Resolve reconciliation exceptions | Reconciliation | `recon.resolve` |
| Support escalations | Support | `support.reply` |
| Daily close | [runbooks/daily-close.md](runbooks/daily-close.md) | finance |

## Watch

- Overview: queues, alerts, kill switches on.
- System health: p95 latency and error rates; provider health and circuit breakers.
- `ledger_trading_halt`: if set, investigate with [runbooks/balance-drift.md](runbooks/balance-drift.md) before clearing.
- Stale FX: [runbooks/stale-fx-rate.md](runbooks/stale-fx-rate.md). Provider webhook failures: [runbooks/provider-webhook-failure.md](runbooks/provider-webhook-failure.md).

## Incidents

1. Contain with kill switches (feature, currency, corridor, provider or customer).
2. Investigate with the audit log, lifecycle, provider call log and ledger journals of the affected records.
3. Correct with approvals (adjustments, goodwill refunds) — never by editing the database.
4. Record the cause and the fix in the change ledger.

## Monthly / quarterly

Verify backups and run a restore drill; review staff roles and remove leavers; review risk-rule thresholds and their firing counts; re-import updated sanctions lists; review AI activity if enabled.
