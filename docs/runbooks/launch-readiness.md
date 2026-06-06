# Launch Readiness Runbook

Use this checklist before enabling real customer funds in any corridor.

## Release Gates

- `server`, `client`, and `mobile` type checks pass.
- Server DB tests pass in CI with Postgres and Redis.
- `npm audit --audit-level=high` has no unresolved production-critical issue.
- `NEXT_PUBLIC_API_URL`, `EXPO_PUBLIC_API_BASE`, `CLIENT_URL`, and CORS origins all point at the same production environment.
- Production API is HTTPS only.
- Real `.env` files are not committed.

## Money Controls

- `FUND_AUDIT_HALT=1` is set in production.
- `LEDGER_BACKFILL_ON_BOOT=0` after the opening-balance backfill is complete.
- `/api/admin/fund-integrity` shows fund audit and ledger reconciliation as healthy.
- Any non-zero fund-integrity difference has a named owner, written note, and audit-log entry.
- All balance-changing releases include a test that asserts both `Wallet` and `LedgerEntry`.
- Trading halt clearances are recorded with the reason and approving admin.

## Custody And Payments

- On-ramp provider is live, not mock.
- Stripe or Checkout webhook signing secrets are configured.
- On-chain deposit webhooks have signing keys or shared secrets configured.
- Withdrawal address whitelist is enabled.
- High-value withdrawal multi-approval thresholds are set.
- Hot-wallet keys are protected by KMS or custody provider before public launch.

## Observability

- Server Sentry DSN is configured.
- Mobile Sentry DSN is configured in EAS profile if the native package is installed.
- Request logs include request IDs.
- Alerts exist for trading halt, failed reconciliation, webhook error rate, FX scrape staleness, and withdrawal queue age.

## Go / No-Go

Go only when:

- Legal approval exists for the launch corridor.
- Liquidity is available for the published rate and limits.
- Daily manual reconciliation is staffed for the beta period.
- Support, compliance, and engineering escalation paths are named.

