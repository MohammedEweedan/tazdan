# 20 — Technical risks

| # | Risk | Likelihood / impact | Mitigation state |
|---|---|---|---|
| 1 | New database triggers break an untested legacy path on first production deploy | Medium / High | Rehearsal on restored production data is a required release step ([../DEPLOYMENT.md](../DEPLOYMENT.md)) |
| 2 | Crypto orders fill against the platform when the hedge venue is unreachable | High (venue geo-blocked) / High | Documented; needs a venue or a principal-risk policy |
| 3 | Mobile changes contain device-only defects | Medium / Medium | Device test pass required before release |
| 4 | Reported fund-integrity discrepancy (≈2,444 USDT, 2026-06) remains unexplained | Unknown / High | Not re-verified (no production access); investigate |
| 5 | Sanctions screening without loaded lists | Certain until lists are imported / High | Production routes affected flows to review; import or subscribe |
| 6 | Custody seed protected by a local key if `MASTER_SEED_KMS_KEY_ID` is unset | Depends on configuration / Critical | Launch blocker |
| 7 | Single-region, single-droplet deployment; untested restore | Low / High | Backups exist; offsite copy and drill pending |
| 8 | Test gaps on several money paths | — / Medium | Listed in [../audit/TECHNICAL_DEBT.md](../audit/TECHNICAL_DEBT.md) |
| 9 | Legacy wallets not fully backfilled into the ledger (`allowNegativeUser` in some paths) | Low / Medium | Backfill then remove the allowance |
| 10 | Key-person dependency | — / High | Mitigated by documentation in `docs/` |
