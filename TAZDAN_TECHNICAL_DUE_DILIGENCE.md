# Tazdan — technical due diligence

Prepared from the repository on 2026-10-07 (branch `hardening/p0-stop-the-bleeding`, uncommitted). No production systems were accessed; no traffic, revenue or customer figures are stated.

## 1. Architecture

Monolithic TypeScript API (Express, Prisma, PostgreSQL, Redis) with clear domain services; Expo mobile app; Next.js website hosting the staff Control Cockpit. Money invariants enforced in code and in the database. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 2. Financial correctness

- Double-entry ledger; every journal balanced per currency; a deferred database trigger rejects unbalanced groups at commit; ledger entries append-only ([docs/LEDGER.md](docs/LEDGER.md)).
- Conditional state transitions, single-statement reservations, idempotency keys, concurrency tests ([docs/TRANSACTIONS.md](docs/TRANSACTIONS.md)).
- Continuous reconciliation; trading halt on ledger breaks; a false-drift defect that could halt trading under load was found and fixed (CL-19).
- Defects fixed in this programme include money creation in P2P escrow, release of reserved funds by admin freeze, double referral payouts, fabricated deposit bank accounts shown to customers, and a conversion screen that reported fake success ([docs/audit/BROKEN_FEATURES.md](docs/audit/BROKEN_FEATURES.md)).

## 3. Security controls (34)

| # | Control |
|---|---|
| 1 | bcrypt password hashing (cost 12) |
| 2 | 15-minute access tokens bound to a session id |
| 3 | Refresh-token rotation with reuse detection |
| 4 | Instant session revocation (denylist + cutoff) |
| 5 | TOTP 2FA with recovery |
| 6 | Step-up codes for high-value or new-device actions |
| 7 | Device trust registry |
| 8 | Mandatory 2FA and verified email for on-chain withdrawals |
| 9 | 24-hour allow-list for new withdrawal addresses |
| 10 | Layered rate limits (global, auth, withdrawals, webhooks, API keys, AI) |
| 11 | IP strike bans |
| 12 | Security headers (helmet) |
| 13 | CORS allow-list |
| 14 | Request body size limit |
| 15 | Specific permission on every staff route (12 roles, 49 permissions) |
| 16 | Maker-checker for sensitive staff actions |
| 17 | Kill switches by feature, currency, corridor, provider, customer |
| 18 | Append-only evidence tables (database) |
| 19 | Balanced-ledger constraint at commit (database) |
| 20 | Immutable price records (database) |
| 21 | Audit log of privileged actions (actor, IP, before/after, reason) |
| 22 | Security events including access denials |
| 23 | PII masking by permission |
| 24 | Signature verification of inbound callbacks (HMAC, constant-time) |
| 25 | Signed outbound webhooks with SSRF guard |
| 26 | Hashed, scoped, expiring, role-bound API keys; live/test separation |
| 27 | No default administrator credentials |
| 28 | Production guard on mock and sandbox adapters |
| 29 | Custody seed encryption (KMS envelope when configured) |
| 30 | Committed-secret scan in CI |
| 31 | Dependency audit gate in CI |
| 32 | Deploys only after CI passes |
| 33 | Claim-link PIN attempt cap |
| 34 | Tipping-off safeguards in customer-facing wording |

Open: external penetration test; SOC 2 / ISO 27001; KMS key must be configured in production. See [docs/SECURITY.md](docs/SECURITY.md).

## 4. Compliance and fraud

Risk engine with 17 rules (AML 7, fraud 7, sanctions 2, geography 1) on remittances, business payouts and withdrawals; screening of customers, beneficiaries, recipients and crypto addresses against imported lists (none bundled); case management with SLA. Internal transfers, chat payments and P2P are not scored by the engine. No SAR/STR or travel-rule tooling. See [docs/COMPLIANCE.md](docs/COMPLIANCE.md), [docs/FRAUD.md](docs/FRAUD.md).

## 5. External dependencies

All payout rails are sandbox; card issuing, card deposits and off-ramp are refused in production; crypto hedging falls back to simulated fills because the venue is geo-blocked. See [TAZDAN_REMAINING_EXTERNAL_DEPENDENCIES.md](TAZDAN_REMAINING_EXTERNAL_DEPENDENCIES.md).

## 6. Quality

151 server tests pass against PostgreSQL (20 suites), including end-to-end remittance and concurrency tests; three consecutive full runs were green. No mobile or website UI tests; the latest mobile changes are type-checked only. Known test gaps are listed in [docs/audit/TECHNICAL_DEBT.md](docs/audit/TECHNICAL_DEBT.md).

## 7. Operations and infrastructure

Single droplet with Docker Compose; Vercel; nightly verified backups (offsite pending configuration); migrations run on container start — the new database controls must be rehearsed on production data before deployment. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/DISASTER_RECOVERY.md](docs/DISASTER_RECOVERY.md).

## 8. Material risks

[docs/dataroom/20_TECHNICAL_RISKS.md](docs/dataroom/20_TECHNICAL_RISKS.md): migration rehearsal, unhedged crypto exposure, untested mobile changes, an unexplained fund-integrity discrepancy reported in June 2026, missing sanctions data, custody key configuration, single-region hosting, test gaps.

## 9. Conclusion

The codebase is substantially more correct, controlled and operable than at baseline, with the financial-control architecture an institutional buyer would expect. It is not production-ready for regulated money movement until the configuration items, release procedure and external activations listed in [TAZDAN_LAUNCH_READINESS_REPORT.md](TAZDAN_LAUNCH_READINESS_REPORT.md) are completed.
