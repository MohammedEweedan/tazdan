# Launch blockers

Status 2026-10-08. A blocker must be cleared before real customers move real money through the affected capability. "Owner" = decision, contract, credential or action outside the codebase.

## Platform-wide

| # | Blocker | Type | How to clear |
|---|---|---|---|
| 1 | Regulatory authorisation for the activities and countries served | Owner | Legal; nothing in code substitutes for it |
| 2 | Deploy and rehearse migrations `20261006120000` … `20261008110000` (six) on a restored copy of production data | Engineering + owner | Rehearsed on a copy of the development database 2026-10-08 (applied in under a second; placeholder banks switched off). The production container runs `prisma migrate deploy` on boot |
| 3 | Confirm no placeholder deposit bank account is active after deploy; enter real accounts | Owner | Cockpit or mobile admin → Platform banks; see CL-20 |
| 4 | Device test of the mobile changes; new native build (prior blocker: expo-location and SDK realignment need a native build) | Engineering | Build, test, submit |
| 5 | Offsite backups and a restore drill | Owner | `BACKUP_S3_URI` and keys; [docs/runbooks/backup-restore.md](../runbooks/backup-restore.md) |
| 6 | Production secrets held outside the droplet (password manager) | Owner | Disaster-recovery prerequisite |
| 7 | Phone OTP provider configured (or phone verification disabled in the product) | Owner | Twilio or Meta credentials |
| 8 | Custody KMS key for the master seed (`MASTER_SEED_KMS_KEY_ID`) | Owner | [docs/runbooks/custody-kms.md](../runbooks/custody-kms.md) |
| 9 | Explain the reported fund-integrity discrepancy | Owner (tooling done) | Audit rebuilt (CL-47). Run `scripts/diagnose-fund-integrity.ts USDT` in production, acknowledge each currency's history in the cockpit, then set `FUND_AUDIT_HALT=1` |
| 10 | Staff accounts given explicit roles (no implicit SUPER_ADMIN) | Owner | Cockpit → Staff & roles. Staff 2FA is enforced in production and the cockpit guides setup (CL-53) |
| 11 | External penetration test | Owner | [docs/security/pentest-scope.md](../security/pentest-scope.md) |

## Per capability

| Capability | Blocker |
|---|---|
| Remittance | Payout partner contract and production adapter per corridor; prefunding; corridor set `LIVE` by an authorised operator |
| Crypto buy/sell | Reachable hedge venue, or approve the principal-exposure limits (enforced in code, CL-51) and a hedging routine |
| Cards, card deposits | Issuer and PSP |
| Sanctions screening | UN, OFAC SDN and UK lists load automatically (CL-52); PEP and EU data need a vendor |
| AI assistant | Data-processing agreement; `AI_LEVEL`; `ANTHROPIC_API_KEY` |

## Readiness statement

The brief's launch criteria require, among others, live provider integrations, backups with a tested restore, and validated production configuration. Those are not yet met, so this programme does **not** declare the platform launch ready. The accurate statement is in [TAZDAN_LAUNCH_READINESS_REPORT.md](../../TAZDAN_LAUNCH_READINESS_REPORT.md).
