# Deployment

## Topology

| Component | Where | How it deploys |
|---|---|---|
| API | DigitalOcean droplet, `/srv/promrkts`, Docker Compose (`docker-compose.prod.yml`): `tazdan-server` (port 5000), `tazdan-redis`, `tazdan-nginx`, `backup` sidecar | `git pull --no-rebase origin master` then `docker compose -f docker-compose.prod.yml up -d --build --force-recreate server` |
| Database | PostgreSQL (see compose / managed instance) | Migrations run automatically: the server container starts with `npx prisma migrate deploy && node dist/index.js` |
| Website + cockpit | Vercel | Vercel deploy of `client/` |
| Mobile | EAS builds and OTA updates | `eas build` / `eas update` |

The production branch is **`master`**. Environment variables live in the repository-root `.env` on the droplet (not `server/.env`); `--force-recreate` is needed for changes to take effect. The image runs compiled `dist/`; a plain restart serves stale code.

## CI and image builds

`.github/workflows/ci.yml` (on pushes to master/main/develop/`hardening/**` and pull requests): server — migrations on an empty database, migration drift check against a shadow database, type-check, tests, route-inventory gate, build; mobile — type-check; client — type-check and production build; security — `npm audit` (server production dependencies blocking at high), committed-secret scan.

`.github/workflows/deploy.yml` runs **only after CI succeeds on `master`** and builds and pushes server and client images for the exact commit CI tested. The droplet pull-and-rebuild step is manual.

## Releasing this programme's changes — required procedure

The programme adds three migrations: `20261006120000_operating_platform` (new tables plus database controls: append-only triggers, balanced-ledger constraint, immutable quotes, non-negative wallet checks), `20261007090000_business_payouts`, and `20261007100000_disable_placeholder_platform_banks`. Because the container migrates on start, **deploying the server applies them**.

1. **Back up** production and confirm the dump restores ([runbooks/backup-restore.md](runbooks/backup-restore.md)).
2. **Rehearse** on a staging database restored from that backup: `npx prisma migrate deploy`, then run the server against it and exercise the main flows (or run the full test suite pointed at it — the suites create their own data). Watch for errors containing "is append-only" or "Unbalanced ledger group": they mean a legacy path needs fixing before release.
3. Check historical wallet rows against the new checks: `SELECT * FROM "Wallet" WHERE balance < 0 OR frozen < 0;` (the checks are `NOT VALID`, so existing rows do not block the migration, but they should be investigated — [runbooks/balance-drift.md](runbooks/balance-drift.md)).
4. Run the TRY/TND ledger backfill if not done.
5. Deploy the server; verify `/api/health`, sign in to the cockpit, confirm Providers shows sandbox rails and Controls shows no unexpected switches.
6. In Platform banks, confirm no placeholder account is active (the third migration deactivates them) and enter real accounts.
7. Deploy the website on Vercel.
8. Build and test the mobile app on devices; ship as a new native build (the earlier SDK realignment requires one).

## Configuration added by this programme

| Variable | Default | Purpose |
|---|---|---|
| `AI_LEVEL` | `OFF` in production | AI assistant level |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | — / `claude-opus-5` | AI provider |
| `AI_RATE_PER_10MIN` | 40 | Per-staff AI limit |
| `BUSINESS_APPROVAL_THRESHOLD_USD` | 10000 | Default batch approval threshold |
| `BUSINESS_PAYOUT_MAX_USD` | 25000 | Per-payout limit |
| `API_KEY_RATE_PER_MIN` | 120 | Public API limit per key |
| `MANUAL_ADJUSTMENT_SINGLE_USD` | 100 | Above this, adjustments need approval |
| `REMITTANCE_WORKER_MS`, `RECON_INTERVAL_MS`, `LEDGER_RECONCILE_MS` | 15 s, 30 min, 5 min | Worker intervals |
| `SANDBOX_TIME_SCALE` | 1 | Test-only SLA compression |
| `ALLOW_PRODUCTION_ADMIN_CREATE` | unset | Permit `create-admin` in production |

## Rollback

Application: redeploy the previous image or commit. Database: migrations are forward-only; the new tables are additive, but the triggers change behaviour — to back out the controls without losing data, drop the triggers listed in [DATABASE.md](DATABASE.md) in a reviewed SQL change, never by deleting rows.
