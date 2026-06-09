# Hot Wallet Limit Runbook

Trigger: operational readiness reports a hot-wallet limit breach.

1. Confirm the configured `hot_wallet_limit_<CURRENCY>` value.
2. Move excess funds to cold storage or a segregated treasury account.
3. Pause large withdrawals for the currency if provider or signer risk is elevated.
4. Verify queued on-chain withdrawals and pending admin approvals.
5. Re-run operational readiness and daily close after the balance is below limit.
6. Record the action in the audit log.

