# AML architecture

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

| Layer | Implementation |
|---|---|
| Customer due diligence | KYC documents with manual review; tiers gate per-transaction, daily and monthly limits on calendar periods in Africa/Tripoli time (`utils/kycLimits.ts`; customers see their limits and reset dates before confirming, and a request for a higher level never lowers the current one); KYB for businesses with case-based review |
| Screening | Internal engine over imported watchlists (names, aliases, wallet addresses); results stored with lists checked; potential matches reviewed by people — [SANCTIONS_CONTROLS.md](SANCTIONS_CONTROLS.md) |
| Transaction monitoring | 17 rules in the risk engine, run on remittances, business payouts and withdrawals — [TRANSACTION_MONITORING.md](TRANSACTION_MONITORING.md) |
| Case management | Cases with SLA, owner, transitions, append-only case file, resolution required to close |
| Source of funds | Required above corridor thresholds (request-information outcome) |
| Record keeping | Append-only decisions, transitions, audit log — [AUDITABILITY.md](AUDITABILITY.md) |
| Governance | Rule changes versioned and audited; maker-checker for sensitive actions; least-privilege roles (COMPLIANCE, AML_ANALYST) |

Not implemented: regulatory filing (SAR/STR), travel-rule messaging, threshold/currency transaction reports, risk-based customer rating (periodic re-scoring), monitoring of internal transfers and P2P by the rule engine. A written AML programme, MLRO appointment and board approval are organisational requirements — draft at [../legal/aml-program.md](../legal/aml-program.md).
