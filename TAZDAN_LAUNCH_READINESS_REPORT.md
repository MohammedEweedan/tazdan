# Tazdan — launch readiness report

Date: 2026-10-07. Scope: the code in this repository on branch `hardening/p0-stop-the-bleeding`. Production systems were not accessed during this programme.

## Verdict

**Not launch ready.** The software controls the brief requires are in place and tested, but production configuration, a migration rehearsal, mobile device testing, licences and partner activation are outstanding. When the engineering and configuration items in "Before any launch" are complete, the accurate statement becomes:

> **PLATFORM TECHNICALLY READY FOR REGULATED PROVIDER ACTIVATION AND CONTROLLED PRODUCTION LAUNCH.**

Remittance, cards and card deposits additionally require licensed partners before real customer money moves through them.

## Criteria (from the brief)

| Criterion | Status | Evidence |
|---|---|---|
| Ledger invariants pass | ✅ | Database-enforced balance; `ledger.reconcile.test.ts`, golden tests |
| Financial flows reconcile | ✅ (sandbox statements) | `remittance.golden.test.ts` |
| No fake money movement | ✅ in code | Production guards; CL-20, CL-41, CL-09 |
| Authentication hardened | ✅ | `integration.auth.test.ts` |
| Authorisation hardened | ✅ | 163/163 staff routes permission-gated |
| Admin hardened | ✅ | Dual control, audit, kill switches |
| Monitoring exists | ⚠️ partial | Cockpit metrics, provider logs; no external paging |
| Backup exists | ✅ / ⚠️ | Nightly verified dumps; offsite needs `BACKUP_S3_URI` |
| DR exists | ⚠️ partial | Documented; no restore drill recorded |
| Provider failures handled | ✅ | Circuit breakers, polling, refunds, golden tests |
| Reconciliation works | ✅ | Statements + integrity checks |
| Remittance lifecycle works | ✅ sandbox | Golden and API tests |
| FX quotes auditable | ✅ | Immutable quotes with rate source |
| Limits work | ✅ | KYC limits, corridor limits, business limits |
| Compliance / fraud / sanctions hooks | ✅ code / ⚠️ data | No sanctions lists loaded yet |
| Production configuration validated | ❌ | KMS custody key, offsite backups, OTP provider, real bank accounts |
| Critical tests pass | ✅ | 151/151 |
| CI prevents broken deployments | ✅ | Deploy waits for CI on `master` |
| Operations documentation exists | ✅ | `docs/OPERATIONS.md`, runbooks |
| Cockpit provides operational control | ✅ | 32 pages |

## Before any launch (engineering and configuration)

1. Rehearse the three new migrations on a restored production backup ([docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)); the server applies them on start.
2. Device-test the mobile changes (Send abroad, Convert, step-up prompts in Send/chat/bulk pay, deposit and Receive, business approvals and invitations); ship a new native build.
3. Set `MASTER_SEED_KMS_KEY_ID`; configure offsite backups and run a restore drill; keep production secrets in a password manager.
4. Enter real deposit bank accounts; confirm no placeholder account is active.
5. Configure Twilio/Meta or disable phone verification.
6. Assign explicit staff roles; enable staff 2FA.
7. Load sanctions lists (or subscribe a vendor).
8. Investigate the reported fund-integrity discrepancy.
9. Decide the crypto hedging position (venue or principal-risk policy with limits).

## Before each external capability

| Capability | Needs |
|---|---|
| Remittance corridor | Licence coverage, payout partner contract, production adapter, prefunding, corridor `LIVE` |
| Cards | Issuer programme and adapter |
| Card deposits | PSP and adapter |
| AI assistant | Data-processing agreement, `AI_LEVEL`, API key |

Full list: [docs/audit/LAUNCH_BLOCKERS.md](docs/audit/LAUNCH_BLOCKERS.md), [TAZDAN_REMAINING_EXTERNAL_DEPENDENCIES.md](TAZDAN_REMAINING_EXTERNAL_DEPENDENCIES.md).
