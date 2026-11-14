# Financial hardening validation — 17 October 2026

Branch: `codex/financial-launch-hardening`. Local results only; production was not accessed or deployed. The unrelated `.claude/worktrees/musing-khayyam-9e68ba` worktree was preserved.

Runtime: Node 24.15.0, Prisma/client 5.22.0 and temporary PostgreSQL 18.4 on Darwin arm64. The spreadsheet used the separately bundled artifact-tool runtime.

| Check | Result |
| --- | --- |
| Clean PostgreSQL migration rehearsal | All 58 migrations applied successfully, including `20261017120000_exact_ledger_controls`; new private-schema migrations also exercised in database suites |
| Full server regression, database tests enabled | **48 suites passed; 370 tests passed; zero skipped** |
| Server production build | `npm run build` passed |
| Prisma schema | `prisma validate` passed |
| Client TypeScript | `tsc --noEmit` passed |
| Mobile TypeScript | `tsc --noEmit` passed |
| Patch whitespace | `git diff --check` passed |
| Spreadsheet formula/export inspection | Four sheets, 710 formulas, no cached formula errors; two chart series bound to cells; exported stroke colours verified |
| Spreadsheet calculation | Downside/base/growth match an independent arithmetic implementation; all cash-bridge checks zero to six decimals; ticket-size sensitivity passes |
| Spreadsheet visual inspection | Summary, assumptions, CBL sources, both forecast years and chart helper table rendered and inspected; sub-dollar processing cost formatting corrected |
| Current npm production dependency audits | **Unavailable** for server/client/mobile: advisory registry DNS resolution failed (`ENOTFOUND registry.npmjs.org`). No clean security-audit result is claimed |

Database tests used a temporary isolated PostgreSQL instance at `127.0.0.1:55479` with a disposable database and private test schemas. No `.env` database connection was used for migrations or tests; `DATABASE_URL` was set explicitly in each command. This is a clean-schema rehearsal, not a restored-production-data rehearsal.

The regression command, run from `server`, was:

```sh
NODE_ENV=test CI=false RUN_DB_TESTS=1 \
DATABASE_URL=postgresql://tazdan_test@127.0.0.1:55479/postgres \
./node_modules/.bin/jest --runInBand --forceExit --silent
```

The suite uses `--forceExit` for application/background handles. These results do not establish graceful process shutdown, settlement load capacity, production network reliability, physical-device behaviour or external provider certification. No production bank, venue, custody balance, safeguarding account or license was validated.

New financial tests verify exact atomic-unit conservation in both ledgers, account/currency consistency, one account under concurrent first posting, observable deferred-constraint failures for interactive/batch transactions, rollback, treasury reference replay/changed terms/precision, cumulative concurrent customer limits, native-currency fee reporting without asset creation, missing/stale valuation refusal, persisted session revocation and production MFA replay denial on shared-cache/persistent-store uncertainty. Existing suites cover money flows, exploit cases, remittance state transitions, custody recovery, authorisation, business payouts and API behaviour.

A significant compatibility finding was that the tested Prisma/PostgreSQL combination could return callback success after a deferred constraint caused rollback at COMMIT. The shared Prisma client now forces outstanding constraints before financial success is returned. Both transaction modes pass the regression. Rehearse on the production database/Prisma versions and restored data before deploying.

CBL actuals were checked against the official September 2026 foreign-exchange-use report, printed page 2, linked from [CBL's publication index](https://cbl.gov.ly/uses-of-foreign-exch/). All business forecast inputs are separately labelled assumptions. Model checks and the exported workbook are under `outputs/01a1499a-cec2-7000-a54c-12aac96a6718/`.

Outstanding acceptance evidence is listed in [launch blockers](LAUNCH_BLOCKERS.md) and the [financial launch assessment](../../deliverables/TAZDAN_FINANCIAL_HARDENING_AND_LAUNCH_2026_10_17.md). This validation does not certify an airtight financial institution or a 10/10 operating platform.
