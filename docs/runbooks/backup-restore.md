# Backups, point-in-time recovery and restore evidence

The backup sidecar uses the reviewed image in `scripts/backup/Dockerfile`, runs as an unprivileged user and installs no packages at startup. It creates a custom-format PostgreSQL dump and uploaded-file archive, verifies the dump is readable, and writes a SHA-256 manifest. The offsite manifest is uploaded last, marking a complete set. Upload failure fails the run, does not update the success marker and does not rotate the previous good local set. The container becomes unhealthy on a failed run or when the last successful run exceeds 30 hours; failures retry after five minutes.

Production compose requires `BACKUP_S3_URI` and separate `BACKUP_AWS_ACCESS_KEY_ID` / `BACKUP_AWS_SECRET_ACCESS_KEY`; `BACKUP_AWS_REGION` and optional `BACKUP_AWS_ENDPOINT_URL` select the storage region/endpoint. Give this identity only write access to the backup prefix, use a separate restore/read identity, server-side encryption and restricted bucket policy. Configure versioning/retention/immutability separately in the storage service, and test that a compromised application identity cannot delete backups. Do not reuse custody/KMS credentials. Keep uploads mounted read-only. Files and manifests must stay private.

## Automated disposable restore

Download one complete offsite backup set into a private directory using the restore identity. The utility checks the database and optional uploads digests before touching the target. It creates a **new** database whose name starts `tazdan_restore_`; it refuses an existing target and never drops or cleans it. Use the environment to pass credentials rather than writing them into commands or reports:

```sh
export RESTORE_MANIFEST_PATH=/private/recovery/tazdan-TIMESTAMP.manifest.json
export RESTORE_TARGET_DATABASE_URL # set securely; fresh tazdan_restore_<unique> database
export RESTORE_DRILL_CONFIRMED=1
export RESTORE_REPORT_PATH=/private/recovery/restore-report.json
node scripts/restore-drill.mjs
```

The restore role needs permission to create the disposable database. Native `psql`/`pg_restore` must match the source's PostgreSQL version. For a local PostgreSQL test container set `PG_TOOL_CONTAINER=<container name>`; target connection then uses the container's hostname/port perspective. The script streams the dump, verifies journal conservation/cached balances and nonnegative valid reservations, and records elapsed time without credentials or private rows. The retained target can be examined and removed later under the database operator's procedure.

A passing script is one part of recovery evidence. Verify restored Wallet/UserWallet totals against the journal; actual deposit, withdrawal, remittance and provider references; pending/unknown operations; uploads and document reads; authentication and encryption/key recovery; downstream provider webhook replay; and safe cutover. The uploads hash does not prove the application can decrypt/read documents. Archive the reviewed report, backup age, complete outage timing and independent approver. Test failure and rollback as well as the happy path.

## PITR and customer-money recovery

A nightly dump permits up to 24 hours of database loss and cannot meet a five-minute infrastructure RPO. Enable managed PostgreSQL point-in-time recovery or independently operated continuous WAL archiving with monitored archive lag, encrypted offsite retention and restore to a chosen timestamp. This is a deployment prerequisite, not something the repository can enable without database-provider access.

Drill restore immediately before a committed payment, recover the database to the selected timestamp, then reconcile durable provider references and accepted requests before reopening. Every accepted money operation must be recovered or explicitly reconciled; a nominal infrastructure RPO never permits an unexplained missing customer payment. Initial targets are RTO within 60 minutes and infrastructure RPO at most 5 minutes, with zero unexplained accepted money records lost.

## Failure response

Alert on backup container health and storage/WAL failures through the deployment's monitoring system; this repo cannot attach the actual on-call notification route. A recent local dump is not proof of an offsite copy. Check complete manifests from the restore identity and perform an offsite-to-fresh-host drill. Pause new activity if the recovery plan cannot meet the reviewed pilot conditions. Restore into a fresh target first; never run `pg_restore --clean` against production as a drill. Use an immutable image SHA and a separately reviewed database rollback/cutover plan.
