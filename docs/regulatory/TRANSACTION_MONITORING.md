# Transaction monitoring

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

Real-time, pre-execution monitoring by the risk engine (`services/risk/engine.ts`), applied to remittances, business payouts and withdrawals. Each evaluation is stored as an append-only `RiskDecision` (outcome, score, triggered rules, signals, explanation, engine version).

Rules and default thresholds are listed in [../COMPLIANCE.md](../COMPLIANCE.md#risk-rules-17-editable-in-the-cockpit-versioned): high value, 24-hour count and amount velocity, structuring, deposit cycling, new-beneficiary and fan-out patterns, shared payout accounts, new and shared devices, recent security changes, young accounts, sanctions hits, missing coverage, restricted jurisdictions and a combined score threshold.

Outcomes: `APPROVE`; `CHALLENGE` (step-up); `REVIEW` / `REQUEST_INFORMATION` (held, case opened); `REJECT` / `BLOCK` / `FREEZE` (refused, case opened). A rule that errors becomes a review signal.

Tuning: Cockpit → Compliance → Rules shows each rule's 30-day firing count; edits create a new version with the reason in the audit log.

Not covered: retrospective (batch) monitoring across history, peer-group analytics, internal transfers / P2P / chat payments, network analytics beyond the fraud graph.
