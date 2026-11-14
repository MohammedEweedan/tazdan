# Paid pilot scope — Tazdan Payment Operations

Non-binding commercial draft · 17 October 2026 · USD

This is a scope for negotiation, not an executed contract or a claim of production readiness. The founder confirms code/IP ownership; document the rights-holding entity, actual contracting entities, tax treatment and applicable data/security obligations before signing. No work or access is authorised merely by this draft.

## Parties and objective

Supplier legal entity: **to be verified**. Buyer legal entity: **to be agreed**. Buyer sponsor and budget owner: **to be agreed**.

Demonstrate a repeatable read-only daily reconciliation for one institution, one legal entity, one agreed workflow and one agreed statement format, with controlled exception review and a traceable evidence export. The buyer retains its processing systems and control of all money.

## Scope and prerequisites

Before a fixed delivery commitment, agree and record:

- A single data source, permitted redacted/synthetic samples, ownership/permission to use them, format/schema, payment identifiers, record statuses and authoritative totals.
- Currencies, decimal precision, amount/fee treatment, cut-off time, timezone, reversals, duplicate rules and matching rules. Do not assume a two-decimal currency rule works for every asset.
- A maximum file size, record volume, import frequency, retention/deletion period, hosting location and access roles. Values must be filled in before signature; no unlimited throughput is offered.
- An institution-approved baseline fixture and expected outcomes, the buyer's acceptance owner and an agreed review period.
- A supplier delivery budget, staffing commitment, dependency list and security/data handling requirements.

Use synthetic data unless the buyer expressly approves a redacted data set and the processing terms are in place. Do not load unnecessary personal data or live account credentials.

## Deliverables and delivery target

| Step | Deliverable | Target after prerequisites |
| --- | --- | --- |
| Discovery and mapping | Written input/output mapping, roles, limits, baseline workflow and agreed golden test fixtures | Week 1 |
| Import adapter | One mapped statement adapter, validation, deterministic replay handling and import report | Weeks 2–3 |
| Operations workflow | Matched/unmatched/exception views, scoped operator actions and audit/evidence export | Weeks 3–4 |
| Acceptance | Replayed fixtures, buyer review, documented gaps, handover and deletion/retention confirmation | Weeks 5–6 |

The target begins after the signed scope, first payment, usable samples and access are received. Discovery may identify incompatibilities requiring a written scope/price change before further work. Do not promise the current application already provides the adapter, evidence export or isolation configuration required by this pilot.

## Acceptance criteria

The parties will sign off the fixture inputs, expected results and measurable performance envelope before implementation. Acceptance should demonstrate:

1. A clean fixture matches the buyer-approved records and exact totals in each agreed currency, with no silent rounding or discarded records.
2. Unmatched internal/external items, duplicate records, amount discrepancies and agreed status/fee differences appear with the expected classifications and source references.
3. Replaying the same import creates no duplicate financial record or repeated operator action. Changed content under a reused import identifier is reported as a conflict under the agreed rule.
4. The agreed roles permit authorised review and deny unauthorised changes; the maker cannot perform a second-person approval where that workflow is included. No live payment is sent.
5. Exported evidence accounts for all fixture records and records operator/time/action. The agreed load envelope, import duration, retention and restoration requirements are met in the pilot environment.

The buyer signs an acceptance record against these criteria. Open defects and their disposition must be explicit. Do not rely on subjective “works perfectly” acceptance or automatic acceptance terms that were never agreed.

## Commercial proposal

Pilot fee: **$25,000**, comprising $10,000 at signed scope and $15,000 at written acceptance. Any VAT, withholding, bank charges and lawful payment route must be addressed in the final contract. Buyer payments go to the named supplier's corporate account.

The $10,000 milestone covers the agreed discovery/mapping and initial work; refund, cancellation and failure-to-deliver rights must be stated in the contract. Neither it nor the acceptance balance is represented as guaranteed cash before a buyer signs and pays. Maintain a project cost and liability reserve; do not treat the whole invoice as profit or founder cash.

Production rollout and annual subscription require separate orders. Opening prices are $75,000 and $120,000 respectively; no free rollout, pilot credit or recurring commitment is implied by the pilot. Fees for bespoke scope, hosting, third-party services, support hours and service levels require express agreement.

## Rights, data and exit

Proposed rights are a limited, non-exclusive evaluation licence for the agreed pilot environment. The supplier may grant only rights it owns or is authorised to grant. The buyer retains its data and pre-existing IP; allocations for custom adapters, reusable improvements, confidentiality and third-party components must be resolved in the final documents. No source-code ownership transfer, corridor exclusivity or right to redistribute is implied.

Define the permitted processing, subprocessors, hosting, access logging, incident contacts, retention/deletion, export format and termination handover. Agree support response times, change control, liability limits, procurement requirements and governing law with the real counterparties. The pilot does not provide a regulatory approval or warrant that the institution's financial-services obligations are met.

## Supplier go/no-go before signature

- Verify the IP chain and contracting authority; complete dependency licence review and resolve restrictions relevant to the proposed rights.
- Estimate the scoped delivery and support cost, cash budget and time contingency; accept only if the project has a credible margin and delivery owner.
- Confirm that the quoted workflow is deliverable using the actual samples and that the buyer has a budget owner and acceptance owner.
- Record each unfulfilled technical/security prerequisite. A local test result does not close a buyer's assurance requirement.

Internal execution plan: [technology monetisation plan](TAZDAN_TECH_MONETIZATION_PLAN_2026_10_17.md). Buyer summary: [buyer brief](TAZDAN_BUYER_BRIEF_2026_10_17.md).
