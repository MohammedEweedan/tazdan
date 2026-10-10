# Auditability

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

| Record | What it captures | Mutability |
|---|---|---|
| `LedgerEntry` | Every money leg, grouped per journal, with reference type and id | Append-only (database trigger) |
| `StateTransition` | Every lifecycle change: from, to, actor type and id, reason, provider response, risk decision, ledger groups | Append-only |
| `AuditLog` | Every privileged staff action: actor, IP, user agent, entity, before, after, reason | Append-only |
| `RiskDecision`, `CaseNote` | Risk evaluations; compliance case files | Append-only |
| `ControlSwitchEvent` | Every kill-switch change with reason and previous state | Append-only |
| `TreasuryMovement` | Every liquidity movement with reference | Append-only |
| `ProviderCall` | Every external call (metadata, latency, outcome) | Append-only |
| `SecurityEvent` | Logins, failures, access denials, security changes | Append-only |
| `ApprovalRequest` | Maker, checker, payload, decision, execution result | Status transitions only |
| `AiInteraction` | AI requests, data read, outputs, human decisions | Decisions recorded once |
| `RemittanceQuote` | Price shown to the customer | Immutable after issue |

Deletion of evidence rows is possible only inside a transaction that sets `tazdan.allow_purge` (for approved retention jobs). An auditor role (AUDITOR, read-only) and the cockpit Audit, Ledger, Approvals and AI activity pages give direct access; every transfer page shows its lifecycle, journals, provider calls, risk decision and audit records together.
