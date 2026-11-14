# Tazdan Payment Operations

Confidential buyer discussion draft · 17 October 2026

**Reconcile payment records, investigate exceptions and retain approval evidence alongside your existing financial systems.**

Tazdan is proposing a focused operations-software deployment for a bank, payment provider or financial-services operator. Its codebase includes reconciliation services, treasury controls, an operations console, balanced ledgers, business approvals, scoped API access and signed webhooks. The proposed package would be configured and validated against one institution's agreed workflow.

## First use case

Compare an agreed provider/bank statement feed with internal payment records. Show matched items, unmatched records, duplicates and discrepancies; assign exceptions to operators; retain the evidence required for daily close. Keep the institution's existing processing, accounts and financial-services responsibilities in place.

The initial engagement is a read-only pilot with synthetic or approved redacted data. It does not collect deposits, execute payments, hold customer funds, issue cards or provide cross-border transfer permissions.

## Proposed engagement

| Stage | Opening commercial proposal | Deliverable |
| --- | ---: | --- |
| Paid pilot | $25,000 | One workflow and one agreed statement format; agreed test cases, exception review and evidence export |
| Production implementation | $75,000, separately scoped | Institution-specific integration, isolated deployment, access configuration, training and acceptance |
| Annual subscription | $120,000 per agreed deployment | Non-exclusive software use, maintenance and defined support |

Prices are proposals for discussion, subject to scope, verified delivery cost, purchasing requirements, contract and tax treatment. No customer acceptance or market price validation is claimed. Third-party services, infrastructure, unusual migration and continuous on-call support require express scope and pricing. A six-week pilot delivery target begins once the contract, deposit, usable sample data and environment access are available; it is not a procurement or production-launch promise.

## Evidence available for diligence

- Local validation on 17 October 2026 recorded 48 passing server suites and 370 passing tests, including database-backed financial controls. Server build, Prisma validation and web/mobile TypeScript checks passed.
- Code and documentation support demonstrations of reconciliation exceptions, treasury/reference controls, approval workflows, API authorisation and audit evidence.
- Independent security assurance, production load/restore evidence, institution-specific integrations and buyer acceptance remain to be completed. The latest dependency vulnerability audit could not be completed because its advisory registry was unreachable; no clean audit result is claimed.

These are engineering results, not certification, production service levels or evidence of transaction volume, customers, revenue, banking partners or regulatory approvals. The founder confirms ownership of the code/IP; ownership records, the rights-holding entity and third-party licence obligations are to be documented in diligence. Detailed source access and commercial rights require agreed terms.

## Scope to agree before work starts

Identify the legal entity, operations sponsor, budget holder, source systems, record format, currencies and precision, cut-off times, required reports, permitted data and hosting location. Agree volume and retention limits, role permissions, support responsibilities, measurable acceptance and the institution's procurement/security requirements.

The existing reconciliation code uses provider-specific statements. A generic bank/CSV connector is not represented as complete. Enterprise account mapping, currency rules and customer-specific imports require implementation and verification. Start with one institution and one legal entity in an isolated deployment; shared enterprise tenancy is not offered as an established capability.

The next commercial step is a workflow discovery meeting, followed by an agreed paid pilot scope. A buyer considering an acquisition can request a separate confidential discussion about the relevant company or IP rights; any licence, asset sale or share sale would have distinct terms.

Prepared from the repository and [local validation record](../docs/audit/FINANCIAL_HARDENING_VALIDATION_2026_10_17.md). Proposed scope: [paid pilot](TAZDAN_PAID_PILOT_OFFER_2026_10_17.md).
