# Stale FX Rate Runbook

Trigger: operational readiness reports stale FX rows or stale Fulus cache.

1. Check Fulus webhook delivery and API token configuration.
2. Use the admin rate refresh endpoint for the stale pair.
3. If Fulus is unavailable, verify fallback provider output and sanity bounds.
4. Remove stale manual overrides unless there is an approved treasury reason.
5. Keep trading halted for affected corridors if rates are outside tolerated drift.
6. Document the source used for the restored rate in the audit log.

