# Database backup & restore

Backups are produced nightly by the `backup` sidecar in
`docker-compose.prod.yml` (pg_dump custom format, 14-day rotation, volume
`dbbackups`). It also runs once on every deploy, so a broken backup path is
discovered at deploy time, not at restore time.

## Verify backups exist (run monthly)

```bash
docker compose -f docker-compose.prod.yml exec backup ls -lh /backups
```

## Offsite copies — REQUIRED before launch

A droplet loss must not take the backups with it. Set in `/srv/promrkts/.env`:

```
BACKUP_S3_URI=s3://tazdan-db-backups/prod      # DO Spaces works (S3 API)
AWS_ACCESS_KEY_ID=…  AWS_SECRET_ACCESS_KEY=…   # Spaces keys
```

(DO Spaces needs `aws` CLI in the sidecar; alternatively run
`rclone copy` from the host against the volume path.)

If the DB is DigitalOcean **Managed** Postgres: enable its built-in daily
backups + PITR too — the sidecar is then the offsite/portable copy.

## Restore drill (run once now, then quarterly)

Restoring is the only proof a backup works.

```bash
# 1. Fresh scratch database (NEVER the live one for a drill)
createdb tazdan_restore_test          # or a throwaway managed DB

# 2. Restore
docker compose -f docker-compose.prod.yml run --rm backup \
  pg_restore --clean --if-exists --no-owner \
  -d "postgresql://USER:PASS@HOST:5432/tazdan_restore_test?sslmode=require" \
  /backups/<latest>.dump

# 3. Sanity: row counts + the money invariant
psql "$RESTORE_URL" -c 'SELECT count(*) FROM "User";'
psql "$RESTORE_URL" -c 'SELECT currency, sum(balance) FROM "Wallet" GROUP BY 1;'
```

## Real disaster recovery order

1. Provision new droplet, install Docker, clone repo @ master.
2. Restore `/srv/promrkts/.env` from the password-manager copy
   (**keep an encrypted copy of prod .env in the team password manager —
   the droplet must not be the only holder of JWT/encryption secrets**).
3. `pg_restore` the newest dump into the (new) database.
4. `docker compose -f docker-compose.prod.yml up -d --build`.
5. Re-point DNS A record for api.promrkts.com; re-issue certbot certs.
6. Master seed: lives in the DB (restored) + KMS — confirm one withdrawal
   signs on testnet-sized amount before announcing recovery.
