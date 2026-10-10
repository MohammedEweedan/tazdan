# Compliance

Software controls supporting an AML/CFT programme. They do not constitute a programme by themselves and do not imply any regulatory approval — see [regulatory/AML_ARCHITECTURE.md](regulatory/AML_ARCHITECTURE.md).

## Where controls run

| Flow | Screening | Risk engine | Outcome handling |
|---|---|---|---|
| Remittance (create) | sender, beneficiary | yes (`REMITTANCE`) | reject → refused + case; review → held in clearing + case |
| Beneficiary (add) | beneficiary name and country | rules marked `BENEFICIARY` | potential match blocks use until reviewed |
| Business payout batch | business, each recipient | yes (`BUSINESS_PAYOUT`) | blocked line fails with neutral wording + case; review holds the batch + case |
| Withdrawal (staff-approved) | customer, destination address | yes (`WITHDRAWAL`) | blocking → refused + case; review → queued with a risk note + case |
| Withdrawal (instant on-chain) | customer, destination address | yes (`WITHDRAWAL`) | anything short of approve → refused (reviewed path available) |
| Internal transfers, chat payments, claim links, P2P | — | not wired (step-up and limits only) | see [audit/PARTIAL_FEATURES.md](audit/PARTIAL_FEATURES.md) |
| Onboarding | KYC documents, manual review | — | KYC tiers gate limits |

## Risk rules (17, editable in the cockpit, versioned)

| Code | Category | Default action | Applies to | Default parameters |
|---|---|---|---|---|
| `RESTRICTED_JURISDICTION` | Geography | REJECT | remittance, business payout, beneficiary | KP, IR, MM |
| `SANCTIONS_SCREENING_HIT` | Sanctions | REVIEW | remittance, business payout, beneficiary, withdrawal | fuzzy matches never auto-reject |
| `SCREENING_NO_COVERAGE` | Sanctions | REVIEW | remittance, business payout | production only |
| `HIGH_VALUE` | AML | REVIEW | remittance, withdrawal, business payout | ≥ 5,000 USD |
| `SOURCE_OF_FUNDS_REQUIRED` | AML | REQUEST_INFORMATION | remittance | corridor threshold |
| `VELOCITY_COUNT_24H` | AML | REVIEW | remittance, withdrawal | > 5 in 24 h |
| `VELOCITY_AMOUNT_24H` | AML | REVIEW | remittance, withdrawal | > 10,000 USD in 24 h |
| `STRUCTURING` | AML | REVIEW | remittance, withdrawal | ≥ 3 in 48 h at 80–100% of 5,000 USD |
| `DEPOSIT_CYCLING` | AML | REVIEW | remittance, withdrawal | ≥ 80% of a ≥ 1,000 USD deposit out within 48 h |
| `NEW_BENEFICIARY_HIGH_VALUE` | Fraud | REVIEW | remittance | ≥ 1,000 USD to a beneficiary added < 24 h ago |
| `BENEFICIARY_FANOUT_7D` | Fraud | REVIEW | remittance | > 5 beneficiaries in 7 days |
| `BENEFICIARY_SHARED` | Fraud | REVIEW | remittance | one payout account used by > 2 senders |
| `NEW_DEVICE_HIGH_VALUE` | Fraud | CHALLENGE | remittance, withdrawal, transfer | ≥ 500 USD from a new device |
| `SHARED_DEVICE` | Fraud | REVIEW | remittance, withdrawal | device on > 2 accounts |
| `RECENT_SECURITY_CHANGE` | Fraud | REVIEW | remittance, withdrawal | password/2FA change < 48 h, ≥ 200 USD |
| `YOUNG_ACCOUNT_HIGH_VALUE` | Fraud | REVIEW | remittance, withdrawal | account < 7 days, ≥ 2,000 USD |
| `SCORE_THRESHOLD` | AML | REVIEW | remittance, withdrawal, business payout | combined score ≥ 60 |

A rule that throws is recorded as a review signal (a failing rule never silently approves). Each evaluation is stored as an append-only `RiskDecision` with the triggered rules, signals and a plain-language explanation; signals feed the Fraud page as `RiskEvent`s.

## Screening

`services/compliance/screening.service.ts`: names are normalised (case, diacritics, Arabic letter variants, honorifics) and compared with Jaro-Winkler against names and aliases of active watchlist entries; dates of birth and countries adjust confidence; wallet addresses match exactly. Results are stored (`ScreeningResult`) with the lists checked. **No list data ships with Tazdan.** Compliance imports official exports (UN, OFAC, EU, UK HMT, PEP, internal) through the cockpit; until a list is loaded, screening returns "no coverage" and, in production, routes affected flows to review.

## Cases

`ComplianceCase` with type (KYC, KYB, AML, SANCTIONS, PEP, FRAUD, SOURCE_OF_FUNDS, SOURCE_OF_WEALTH, TRAVEL_RULE, OTHER), priority, SLA (critical 4 h, high 24 h, medium 72 h, low 7 days), owner, transitions (open → assigned → investigating ⇄ awaiting information → escalated → closed) and an append-only case file. Closing requires a resolution. Decisions taken elsewhere (remittance review, business batch release) close their case automatically with the decision.

## Tipping off

Customers never see compliance states, scores, screening results or reasons: remittance wording is neutral, blocked business lines say "This payment cannot be processed", withdrawals say "can't be processed", AI support drafts are instructed never to mention checks (CL-42).

## Not provided

Regulatory filing (SAR/STR), travel-rule messaging and threshold reporting are not built; evidence for them is available in cases, decisions and the audit log ([audit/MISSING_ESSENTIALS.md](audit/MISSING_ESSENTIALS.md)).
