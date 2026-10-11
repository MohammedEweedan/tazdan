# Do not touch

Areas that work, are fragile, or belong to someone else's in-flight work. Change them only deliberately, with tests, and with the owner's agreement.

## Owner's in-progress work (left untouched by this programme)

- `client/src/components/LandingPage.tsx`, `client/src/components/PageTitle.tsx`, `client/src/components/landing/*`, `client/src/components/ui/SecurityCompliance.tsx`, `client/src/app/security/*`
- `client/src/i18n/*.json`, `client/src/app/sitemap.ts`, `client/public/sw.js`, the deleted icon files under `client/` and `client/public/`

## Money invariants — change only with tests

- `server/src/services/ledger/ledger.service.ts` (`postLedger`) — conservation per currency; fund classes.
- `server/src/services/wallet/atomicWallet.ts` — `reserveFunds` / `settleReserve` / `releaseReserve` / `debitAvailable` are single conditional statements; do not split them into read-then-write.
- `server/src/services/p2p/escrow.ts` — the only path that may move P2P escrow.
- `server/src/services/remittance/stateMachine.ts` — the edge whitelist; never update `RemittanceTransfer.state` directly.
- The controls section at the end of `server/prisma/migrations/20261006120000_operating_platform/migration.sql` — append-only triggers and the deferred balanced-group constraint. Purging evidence requires `SET LOCAL tazdan.allow_purge = 'on'` inside a transaction and should never be done by application code.

## Production behaviour that looks odd but is deliberate

- Mock and sandbox adapters throw in production (`services/providers/guard.ts`).
- AI is off in production unless `AI_LEVEL` is set.
- An ADMIN with no staff roles is treated as SUPER_ADMIN so the existing mobile admin keeps working; the cockpit shows a banner. Assign explicit roles instead of removing this.
- Customer-facing remittance wording hides compliance states (`customerStatus` in server and mobile) — do not expose raw states or reasons.
- Bank deposit accounts are never seeded or hardcoded (CL-20).

## Infrastructure

- Production branch is `master`; the droplet deploys with `git pull` and `docker compose … up -d --build --force-recreate server`; the container runs migrations on start. Environment lives in the repository-root `.env` on the droplet, not `server/.env`.
- The website is deployed on Vercel; changing the droplet does not change the website.
- Port 3100 on the development machine belongs to another application.
