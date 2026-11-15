# Rehearse pending migrations on a restored production copy

Run this before deploying any release that adds migrations production has not applied. Some migrations add constraints and triggers that existing rows can violate (`20261017120000_exact_ledger_controls` adds unique indexes, CHECKs and balance triggers). A failure in production leaves the deploy half-applied, so find it on a copy first.

## 1. Restore the latest backup into a disposable database

Use [backup-restore.md](backup-restore.md). Run the tools inside the PostgreSQL 16 container so `pg_restore` matches the server:

```sh
export RESTORE_MANIFEST_PATH=/private/recovery/tazdan-TIMESTAMP.manifest.json
export RESTORE_TARGET_DATABASE_URL # fresh tazdan_restore_mig_<date> database
export RESTORE_DRILL_CONFIRMED=1
export PG_TOOL_CONTAINER=<postgres container name>
node scripts/restore-drill.mjs
```

The drill's report must say `passed`. A `failed` report (ledger exceptions or invalid reservations) means production data already needs repair before any migration.

## 2. See what production is missing, then apply it

```sh
cd server
DATABASE_URL="$RESTORE_TARGET_DATABASE_URL" npx prisma migrate status
DATABASE_URL="$RESTORE_TARGET_DATABASE_URL" npx prisma migrate deploy
```

If a migration fails, note the constraint and rows in the error, then mark the migration rolled back on the copy (`npx prisma migrate resolve --rolled-back <name>`) and investigate with [balance-drift.md](balance-drift.md). Repair production data with approved adjustments (maker-checker), never by editing rows, and repeat from step 1 on a fresh backup.

## 3. Check the result

On the migrated copy:

```sql
-- Every journal group nets to zero per currency
SELECT "groupId", currency, sum(amount) FROM "LedgerEntry" GROUP BY 1, 2 HAVING abs(sum(amount)) > 0.000000000001;
-- Cached ledger balances equal their entries
SELECT a.id FROM "LedgerAccount" a LEFT JOIN "LedgerEntry" e ON e."accountId" = a.id GROUP BY a.id HAVING abs(a.balance - coalesce(sum(e.amount), 0)) > 0.000000000001;
-- No negative balances or reservations larger than the balance
SELECT id FROM "Wallet" WHERE balance < 0 OR frozen < 0 OR frozen > balance;
```

All three must return no rows. Then start the API against the copy (`NODE_ENV=production`, the copy's `DATABASE_URL`, real-money switches off) and confirm the fund-integrity audit and launch-readiness checks run without new exceptions.

## 4. Deploy

Take a fresh backup, deploy, and run `npx prisma migrate status` against production to confirm nothing is pending. Drop the disposable database under the database operator's procedure.

The first deploy of the launch-gate release closes new money activity until `REAL_MONEY_ENABLED=1` and a verified evidence manifest are in place ([launch-readiness.md](launch-readiness.md)). Plan that evidence before the deploy window.
