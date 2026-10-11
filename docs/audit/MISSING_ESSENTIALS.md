# Missing essentials

What a regulated money business needs that this codebase does not provide, either because it is outside software (licences, contracts, people) or because it was not built. Items are not ranked by effort.

## Outside the codebase (owner / business actions)

| Essential | Why it matters | Notes |
|---|---|---|
| Regulatory authorisation for each activity and jurisdiction (e-money / payment institution / money transmission; VASP registration for crypto) | Operating without it is unlawful | See [docs/legal/licensing-memo.md](../legal/licensing-memo.md). Nothing in this repository is a licence or a substitute for one. |
| Contracts with payout partners per corridor | Remittance runs only on sandbox rails | Adapter interface and activation steps: [docs/integrations/PAYOUT_PROVIDER_GUIDE.md](../integrations/PAYOUT_PROVIDER_GUIDE.md) |
| Safeguarding / client-money bank accounts | Customer funds must be segregated | The ledger already separates customer, settlement and corporate fund classes ([docs/regulatory/CUSTOMER_FUNDS.md](../regulatory/CUSTOMER_FUNDS.md)) |
| Real Tazdan deposit bank accounts entered in the admin | Bank deposits are unavailable until then | Placeholders removed (CL-20) |
| Sanctions and PEP list subscription (or official list imports on a schedule) | Screening reports "no coverage" without data | Import path exists in the cockpit |
| KYC/KYB vendor (optional) | Manual review does not scale | Provider interface exists; manual review works today |
| Card issuer and PSP | Cards and card deposits are off in production | Interfaces exist |
| Hedging venue reachable from production | Crypto orders otherwise fill against the platform | [docs/business/hedging-execution-plan.md](../business/hedging-execution-plan.md) |
| Named MLRO / compliance officer, written AML programme approved by the board | Required by every AML regime | Draft: [docs/legal/aml-program.md](../legal/aml-program.md) |
| Data-processing agreement with Anthropic before enabling AI in production | Customer data would leave the platform | AI is off in production by default |
| External penetration test | Independent assurance | Scope: [docs/security/pentest-scope.md](../security/pentest-scope.md) |

## Inside the codebase (not built)

| Essential | Status |
|---|---|
| Regulatory reporting (SAR/STR filing, threshold reports, travel-rule messages) | Not built. Cases and evidence exist; filing is manual. |
| Customer data export and account deletion (data-subject requests) | Not built (statements export exists). |
| Statement-of-account documents with regulator-required wording per jurisdiction | Partial (statements exist; wording not reviewed). |
| Payouts to external bank accounts for businesses | Not built — use remittance corridors once live. |
| KYB document upload in the app | Not built — staff request documents. |
| Alerting to an on-call channel (PagerDuty/Slack) from treasury alerts, reconciliation breaks, provider circuit breakers | Not built — visible in the cockpit only. |
| Second-region failover | Not built — single droplet; restore-from-backup is the recovery path ([docs/DISASTER_RECOVERY.md](../DISASTER_RECOVERY.md)). |
