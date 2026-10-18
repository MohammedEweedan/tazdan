# Launch blockers — 17 October 2026

This replaces the 8 October checklist. Local hardening and tests do not authorise a public launch. All nine evidence gates must pass for the exact entity, customer countries, capabilities, currencies, corridors and providers. See the [release runbook](../runbooks/launch-readiness.md).

| Blocker | Evidence needed to clear | Responsible function |
| --- | --- | --- |
| Lawful Libya collection, FX conversion and outward settlement | Issued permissions or approved regulated-principal arrangement, signed legal scope and bank acceptance; review applicable CBL circulars and permitted pricing | Board / Libyan counsel / banking partner |
| Destination reach | Written country, residency, currency and payout-method coverage for Libya-origin funds; production agreements and tested adapters | Partnerships / compliance / engineering |
| Customer safeguarding | Opening and daily independent bank/custody-to-liability reconciliation, account ownership and insolvency treatment, pending and returned funds reconciled | Finance / auditor / counsel |
| Historic discrepancy | Explain and evidence every historical imbalance, including the previously reported approximately 2,444 USDT issue; reverse unsupported credits with approved journals | Finance / independent reviewer |
| Sister-company separation | Separate entity books, custody and bank accounts; exact intercompany records, settlement terms, transfer pricing and lawful replenishment | Group finance / counsel |
| Liquidity | Own capital funded in each payout currency/partner pool; stress test one-way flows and blocked settlement; exclude customer balances | Treasury / board |
| Production migration | Rehearse all pending migrations including `20261017120000_exact_ledger_controls` on a restored production copy; resolve duplicate accounts/references/fees and invalid owners without deleting evidence | Engineering / finance |
| Legacy crypto execution | Real-money route disabled in code. Build durable reserve/submit/reconcile/finalise execution; certify lost replies and crash recovery with the venue | Engineering / venue |
| Group-wide exposure policy | Local transfer, chat, claim, P2P, card-load and withdrawal creation now repeat KYC checks under a transaction/customer lock, with completed and pending usage in one SQL snapshot. Compliance must still approve aggregate cross-product/group exposure policy and rail-specific thresholds | Compliance / engineering |
| Additional pooled products | Group-pool controller contains assumed USD-to-USDT conversion and legacy updates; it is not currently routed. Keep unrouted and exclude from launch; rebuild native-currency custody before exposing it | Engineering / finance |
| Independent security | External penetration test, current sanctions/PEP coverage and monitoring acceptance, isolated remote custody/recovery test, secret rotation | Security / compliance |
| Current dependency advisory scan | Re-run runtime dependency audits for server, client and mobile from a network that can reach npm's advisory registry. This attempt failed with registry DNS errors and supplies no clean audit result | Security / engineering |
| Device and operational readiness | Physical iOS/Android English/Arabic RTL QA, complaints ownership, real notifications, monitoring drill, recovery and money-state reconciliation after restore | QA / operations |

No worldwide approval is assumed. Add each corridor only when origin settlement, destination payout and the operating legal entity are covered together. A shell-company registration and an overseas reserve do not clear these blockers.

Changes and projections are documented in the [financial hardening and launch assessment](../../deliverables/TAZDAN_FINANCIAL_HARDENING_AND_LAUNCH_2026_10_17.md). Production was not accessed or deployed.
