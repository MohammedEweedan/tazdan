# Tazdan — acquisition technology report

For a strategic acquirer's technology review. Measured on 2026-10-07 from the repository; no production data was accessed and none is stated. Data room: [docs/dataroom/](docs/dataroom/).

## The asset

| Component | Measured |
|---|---|
| Applications | API server, mobile app (consumer, business, staff), website with the staff Control Cockpit |
| Database | 96 models, 51 enums, 53 migrations, database-enforced financial controls |
| API | 405 endpoints (196 customer, 163 permission-gated staff, 44 public incl. 9 API-key and 12 provider callbacks, 2 optional) |
| Screens | 82 mobile (25 admin, 5 business), 51 web (32 Control Cockpit) |
| Source | 39,220 server lines (208 files), 57,727 mobile lines (214 files), 22,811 website lines (122 files) |
| Tests | 20 server suites, 151 tests passing against PostgreSQL |
| Financial workflows | 38 ledger journal types in code (34 in production paths) |
| Risk | 17 rules, screening engine, case management |
| Providers | 17 registered; 9 payout adapters (8 sandbox, 1 internal) |
| Documentation | **152 Markdown files** repository-wide (97 under `docs/`: 27 technical references plus a generated route list, 13 audit, 24 data room, 9 integration guides, 10 regulatory, 10 runbooks, 4 legal/security/business), plus 8 `TAZDAN_*` reports; baseline was 62 (15 under `docs/`) |

## What an acquirer gets

- A correct-by-construction money core: double-entry ledger with database enforcement, append-only evidence, reconciliation, idempotent and concurrency-safe money paths.
- A remittance orchestration layer ready for partner activation on 12 Libya corridors.
- An operations platform: Control Cockpit with least-privilege roles, dual control, kill switches and full audit.
- A business payouts product with a public API and signed webhooks.
- An AI assistance layer designed for accountability (read-only, permission-scoped, audited, human-accepted drafts).
- Documentation sufficient for a new team to operate and extend the system.

## What an acquirer does not get

Licences, partner contracts, live corridors, a card programme, sanctions data subscriptions, measured traction, an external security assessment, or a multi-region deployment.

## Readiness

Not launch ready; the gap is configuration, release rehearsal, device testing and external activation rather than missing core software. See [TAZDAN_LAUNCH_READINESS_REPORT.md](TAZDAN_LAUNCH_READINESS_REPORT.md).

## Reproduction estimate

72–122 engineer-months (about 0.9–2.4 million USD under stated cost assumptions); method and exclusions in [docs/dataroom/21_REPLACEMENT_COST.md](docs/dataroom/21_REPLACEMENT_COST.md). Not a valuation.

## Diligence index

| Topic | Document |
|---|---|
| Before/after with feature table and required counts | [TAZDAN_BEFORE_AFTER_AUDIT.md](TAZDAN_BEFORE_AFTER_AUDIT.md) |
| Technical due diligence (34 security controls) | [TAZDAN_TECHNICAL_DUE_DILIGENCE.md](TAZDAN_TECHNICAL_DUE_DILIGENCE.md) |
| Change history with root causes | [docs/audit/CHANGE_LEDGER.md](docs/audit/CHANGE_LEDGER.md) |
| Risks | [docs/dataroom/20_TECHNICAL_RISKS.md](docs/dataroom/20_TECHNICAL_RISKS.md) |
| External dependencies | [TAZDAN_REMAINING_EXTERNAL_DEPENDENCIES.md](TAZDAN_REMAINING_EXTERNAL_DEPENDENCIES.md) |
| IP and licences | [docs/dataroom/03_IP_INVENTORY.md](docs/dataroom/03_IP_INVENTORY.md) |
| Control Cockpit | [TAZDAN_CONTROL_COCKPIT_REPORT.md](TAZDAN_CONTROL_COCKPIT_REPORT.md) |
| AI | [TAZDAN_AI_AUTOMATION_REPORT.md](TAZDAN_AI_AUTOMATION_REPORT.md) |
| Buy vs build | [TAZDAN_BUY_VS_BUILD.md](TAZDAN_BUY_VS_BUILD.md) |
