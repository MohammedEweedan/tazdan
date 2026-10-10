# Disaster recovery

## Objectives (proposed, not yet tested)

| Scenario | Target | Basis |
|---|---|---|
| API process crash | Minutes | Docker restart policy |
| Droplet loss | Hours (RTO); up to 24 h of data (RPO) with nightly dumps; less with managed PITR | Restore runbook below |
| Database corruption / bad migration | Hours | Restore latest verified dump into a new database |
| Provider outage | Immediate degradation, no data loss | Circuit breakers, kill switches, routing fallback |

These are targets, not measured results: no restore drill has been recorded yet (owner blocker).

## Backups

The `backup` sidecar runs `pg_dump` nightly and on every deploy, verifies each dump with `pg_restore --list`, keeps 14 days locally, tars the `uploads` volume (KYC documents), and copies offsite when `BACKUP_S3_URI` is set (it fails loudly if that is set but the upload is impossible). If the database is a managed instance, enable its daily backups and point-in-time recovery as well.

## Recovery order

Follow [runbooks/backup-restore.md](runbooks/backup-restore.md):

1. New droplet, Docker, clone `master`.
2. Restore the repository-root `.env` from the password manager (it must not live only on the droplet).
3. Restore the newest verified dump; restore uploads.
4. `docker compose -f docker-compose.prod.yml up -d --build` (migrations run on start).
5. Re-point DNS for `api.promrkts.com`; re-issue certificates.
6. Before reopening: check `ledger_trading_halt`, run an integrity reconciliation from the cockpit, compare wallet totals with the ledger, confirm one small on-chain withdrawal signs (custody keys via KMS).
7. Turn on kill switches for withdrawals and remittance until checks pass; turn them off deliberately.

## Operating safely during an incident

Kill switches stop money movement by feature, currency, corridor, provider or customer without a deploy (Cockpit → Controls). Every switch change is audited. The trading halt stops exchange orders automatically on a ledger break.
