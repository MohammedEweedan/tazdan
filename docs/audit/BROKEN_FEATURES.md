# Broken features

## Found at baseline (2026-10-06) — all fixed

| # | Defect | Impact | Fixed in |
|---|---|---|---|
| 1 | Admin freeze/unfreeze rewrote wallet `frozen` amounts | Released reserved money; double spend | CL-01 |
| 2 | Admin "freeze transaction" changed settled statuses | Records contradicted balances | CL-02 |
| 3 | `POST /api/transfers/send` failed for USDT (invalid enum values in query) | Feature unusable for its default currency | CL-03 |
| 4 | Mobile transfer endpoint skipped step-up; chat payments stored client step-up claims | Account-takeover money loss | CL-04 |
| 5 | Session list read an unused table; "sign out other devices" revoked nothing | Stolen sessions could not be ended | CL-05 |
| 6 | P2P escrow double-reserved; long-tail assets credited buyer without debiting seller | Money creation | CL-06 |
| 7 | Dispute resolution could not move escrow and rejected its own default status | Disputes could not be settled | CL-07 |
| 8 | Referral reward claim race | Double payout | CL-08 |
| 9 | Swap receipt showed an invented transaction hash | Misleading records | CL-09 |
| 10 | Mobile business portal called endpoints that did not exist | Whole portal non-functional | CL-34 |
| 11 | Default administrator password in seed and scripts | Admin takeover | CL-11 |
| 12 | Card issuer, on-ramp, off-ramp defaulted to MOCK in production | Fake completed payments possible | CL-16 |
| 13 | Two integration suites could not load (ESM dependency) | Auth and wallet untested | CL-38 |
| 14 | Deploy did not wait for CI | Broken builds could ship | CL-39 |

## Found during the final forensic audit (2026-10-07) — all fixed

| # | Defect | Impact | Fixed in |
|---|---|---|---|
| 15 | Ledger reconciliation read balances and sums in two queries | False drift halted all trading under load | CL-19 |
| 16 | Seven fabricated "Tazdan" deposit bank accounts seeded on every boot and hardcoded in the app; fake IBAN on the Receive screen | Customers could wire money to accounts Tazdan does not hold | CL-20 |
| 17 | Convert screen used a random rate and reported success without converting | Customers told money moved when it did not | CL-41 |
| 18 | Refunded transfers exposed "Compliance rejection"; receipts showed internal states | Tipping-off risk | CL-42 |
| 19 | Compliance queue sorted priority alphabetically | Urgent cases buried | CL-21 |
| 20 | Review cases stayed open after the decision | Stale queue, wasted reviewer time | CL-22 |
| 21 | Integrity reconciliation re-opened the same break every run | Exception noise | CL-23 |
| 22 | Support escalations could be resolved twice | Duplicate messages to customers | CL-24 |
| 23 | Five staff routes checked only the admin role | Least privilege bypassed (e.g. deposit confirmation) | CL-44 |

## Known broken now

None known in code paths covered by tests. Items that work but are unsafe or unverified are in [PARTIAL_FEATURES.md](PARTIAL_FEATURES.md) and [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md).
