# 22 — Launch readiness

Against the brief's launch criteria (2026-10-07):

| Criterion | State |
|---|---|
| Ledger invariants pass | Met — database-enforced, tested |
| Financial flows reconcile | Met in tests; provider statements only from sandbox rails |
| No fake money movement | Met in code (production guards; fake bank accounts, fake conversions and fake hashes removed) |
| Authentication hardened | Met |
| Authorisation hardened | Met (every staff route permission-gated) |
| Admin hardened | Met (dual control, audit, kill switches) |
| Monitoring exists | Partial — cockpit metrics and logs; no external paging |
| Backup exists | Met (nightly, verified); offsite copy depends on configuration |
| DR exists | Partial — documented; no restore drill recorded |
| Provider failures handled | Met in design and tests (circuit breakers, retries, refunds) |
| Reconciliation works | Met |
| Remittance lifecycle works | Met on sandbox rails |
| FX quotes auditable | Met (immutable quotes, rate source recorded) |
| Limits work | Met |
| Compliance / fraud / sanctions hooks | Met in code; sanctions data not loaded |
| Production configuration validated | Not met — KMS key, offsite backups, OTP provider, real bank accounts pending |
| Critical tests pass | Met (151/151) |
| CI prevents broken deployments | Met |
| Operations documentation exists | Met |
| Control Cockpit provides operational control | Met |
| External partners activated | Not met — required for remittance, cards, card deposits |

**Statement:** the platform is **not** launch ready. Once the production configuration items are completed and the release procedure (including the migration rehearsal and mobile device testing) is done, the accurate statement would be: *platform technically ready for regulated provider activation and controlled production launch.* Licences and partner activation remain required.
