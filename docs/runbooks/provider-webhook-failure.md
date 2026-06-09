# Provider Webhook Failure Runbook

Trigger: failed on-ramp, off-ramp, or on-chain provider events appear in operational readiness.

1. Confirm provider dashboard health and webhook signing configuration.
2. Check failed rows for duplicate `providerRef`, missing signatures, invalid payloads, or network timeouts.
3. Retry idempotently using the provider reference. Never create a second credit without the same external reference.
4. Confirm the ledger has exactly one balanced group for the settled provider event.
5. Notify support if user-facing settlement is delayed beyond the SLA.
6. Record an audit-log review after remediation.

