# AML / sanctions screening provider guide

Status: **internal screening engine and case management complete; no list data is bundled.**

Today: compliance imports official list exports (CSV with list name, entity type, name, aliases, country, date of birth, wallet address, identifier) in Cockpit → Compliance → Watchlists; the engine screens customers, beneficiaries, business recipients and withdrawal addresses; potential matches go to review; no coverage routes to review in production.

Options:

1. **Scheduled official imports** — UN, OFAC SDN, EU, UK HMT; automate the download and import daily; keep the source and date (stored per entry).
2. **Screening vendor** — implement the screening interface in `services/providers/types.ts` (`ScreeningSubject` → matches) as an adapter and call it from `screenSubject`; keep the internal list for local designations.
3. **Chain analytics** for crypto addresses — score destination and source addresses; feed results into the risk engine as a signal.

Transaction monitoring rules are internal (17 rules, editable). A vendor's monitoring can be added as additional risk events.
