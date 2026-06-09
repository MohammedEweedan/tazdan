# Daily Close Process

Run once per operating day with `/api/admin/daily-close`.

The close snapshot captures reconciliation, fund integrity, stale FX, provider failures, liquidity exposure, hot-wallet limits, support SLA health, and audit-review freshness.

Required review:

1. Overall readiness is `ok` or every warning has an owner.
2. Fund and ledger reconciliation are clean.
3. No unresolved provider failures are older than the retry window.
4. FX rates are fresh or a fallback source is documented.
5. Support SLA breaches have owners.
6. Audit log review is recorded with `/api/admin/audit-log/review`.

