# Acquisition gaps

What a strategic acquirer's technical due diligence would flag, and the state of each. Facts only; valuation is out of scope.

| Area | Gap | State |
|---|---|---|
| Licences and partners | No licences, no live payout partners, no card issuer | Owner actions; software ready for partner activation |
| Traction | No measured production volumes are reported in this repository | Do not infer any |
| Single-founder knowledge | Architecture documented in `docs/`; change history in `docs/audit/CHANGE_LEDGER.md` | Improved by this programme |
| Test coverage | 150 automated server tests; none for mobile or website UI | Known gaps listed in TECHNICAL_DEBT.md |
| Infrastructure | Single droplet, single region; managed database not confirmed | DR is restore-from-backup |
| Observability | In-process metrics, provider call log, cockpit system page; no external APM or paging | Sentry DSN for mobile is an open owner item |
| Security assurance | No external penetration test, no SOC 2 / ISO 27001 | Scope document exists |
| Code ownership | Third-party libraries under their own licences; no vendored proprietary code identified | See [docs/dataroom/03_IP_INVENTORY.md](../dataroom/03_IP_INVENTORY.md) |
| Data protection | No data-subject export/deletion tooling | Not built |
| Financial controls | Database-enforced ledger, reconciliation, maker-checker, audit trail | Built in this programme |
