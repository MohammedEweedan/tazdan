# Release readiness and scoped pilot

Production new money activity is closed unless `REAL_MONEY_ENABLED=1` and every gate in a private evidence manifest is verified. The manifest must match the image's `RELEASE_SHA`, contain current dated reviews, name an owner, and bind each private artifact by SHA-256. Reviews expire. Missing, changed, unreadable or escaped artifact files close new activity. Artifact validation is cached for at most 30 seconds; expiry is checked on each movement. Existing settlement/reconciliation and recovery paths continue; emergency switches apply to new activity.

Copy `docs/launch-evidence.example.json` to a private directory. Replace the commit, launch market, currencies, features, corridor codes and provider codes with the approved pilot scope. Scope lists use exact server codes and deny omitted corridors/providers. Remove features that are not ready. Do not mark a gate verified without its actual evidence and independent owner review. The example deliberately leaves every gate pending.

Mount this directory read-only at `/run/launch-evidence` (`private-launch-evidence/` is ignored by Git). Run `npm run readiness` in `server` with `LAUNCH_EVIDENCE_PATH` and `RELEASE_SHA` set before deployment. Production boot also validates evidence when money is enabled. Use an immutable reviewed image SHA, `FUND_AUDIT_HALT=1`, `LEDGER_BACKFILL_ON_BOOT=0`, separate JWT/webhook secrets, working Redis and no production master-seed variables. Blockchain activity additionally requires remote custody. Validate the migration and rollback procedure in staging before the pilot.

| Gate | Required acceptance evidence |
| --- | --- |
| authorization | Issued authorization and legal scope review for the exact product/market; terms, privacy, safeguarding and complaints obligations. A pending application is insufficient. |
| providers | Signed live agreements, approved currencies/corridors, settlement/reconciliation terms, outage/finality policies and independently tested sandbox/live callbacks. |
| security | Independent ASVS/MASVS review and penetration test; no unaccepted exploitable critical/high findings; isolated custody bypass tests; named, dated dependency exceptions; rotation of previously exposed credentials. |
| moneyPaths | Actual API/database tests for every enabled rail: replay, concurrency, reversals, reservations, fees, lost replies, process recovery, bad webhook signatures and reconciliation. No unexplained balances or unbacked baseline. |
| deviceQa | Signed results on physical iPhone and Android, Arabic/English, RTL text and mixed number/address rendering, weak/offline networks, restart, biometrics, accessibility and confirmation/error recovery. |
| recovery | Offsite complete backup set and document/key recovery; fresh restore and point-in-time recovery; verified money/provider reconciliation; measured RTO/RPO and rollback rehearsal. |
| operations | Named incident/on-call owners, alerts delivered in a drill, daily close/reconciliation, support and complaints ownership, scoped account/value/volume limits and pilot stop criteria. |

## Monitoring and stop criteria

`/api/health/live` checks the running process. `/api/health/ready` checks database/shared Redis with a deadline and reports `moneyReady` separately. Readiness does not certify a completed payment. `/api/metrics` requires a separate bearer `METRICS_TOKEN` and exposes bounded request counters/latency histograms, dependency/money readiness and unknown custody operations. Deploy the alert rules in `ops/monitoring/tazdan-alerts.yml` and verify the actual notification route. Scrape individual workers/replicas, not a random cluster worker behind one port.

Initial targets: 99.9% availability for measured critical journeys, internal API p95 below 2 seconds, pilot crash-free sessions at least 99.5% and production at least 99.9%, critical incident acknowledgement within 15 minutes, infrastructure RTO within 60 minutes and PITR RPO at most 5 minutes. Recovery must reconcile every accepted money operation; infrastructure RPO never authorizes losing customer transactions. The nightly dump alone cannot provide a 5-minute RPO.

Stop new money activity on unexplained ledger drift, unbacked credit, ambiguous provider broadcast, unsafe custody, failed safeguarding reconciliation or unavailable shared coordination. Preserve operation references and money; reconcile before any refund/retry. Use existing Control Cockpit kill switches with a reason, and review the shared trading halt. Never clear an integrity halt merely to restore availability.

Use `server/load-test/pilot-readiness.js` with the expected pilot peak to exercise 3× request load on test accounts. It measures read-only API traffic; it does not prove settlement throughput or provider capacity. Separate rail-specific, financially reconciled load/soak tests are required for each enabled payment path. Archive results and deployment size with evidence.

## Production maturity

The code supplies release controls, recovery tools and test coverage. A production maturity rating requires sustained real operation: measured journey SLIs, real settlement exceptions, tested incident response, independent audits, compliant safeguarding and complaints outcomes, key recovery, realistic capacity and months of reliable service. Review the evidence monthly and after material changes. Do not label a broad feature inventory as mature production.
