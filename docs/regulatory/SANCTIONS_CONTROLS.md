# Sanctions controls

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

| Control | Detail |
|---|---|
| Lists | Imported by compliance (UN, OFAC SDN, EU, UK HMT, PEP, internal); source and import date kept per entry; **none bundled** |
| Subjects screened | Customer (on remittance, withdrawal), beneficiary (on creation and periodically), business and business recipients, crypto destination addresses |
| Matching | Normalised names (diacritics, Arabic letter variants, honorifics removed), Jaro-Winkler against names and aliases, date-of-birth and country adjustments; exact wallet-address match |
| Outcome | Potential match → review (fuzzy matches never auto-reject); confirmed match blocks the beneficiary; no list loaded → "no coverage", routed to review in production |
| Geography | `RESTRICTED_JURISDICTION` rejects remittances and business payouts involving configured countries (default KP, IR, MM) |
| Review | Cockpit → Compliance → Screening; decisions audited; case opened for holds |
| Tipping off | Customer-facing wording never mentions screening |

Operational requirement: import updated lists on a schedule (daily) or subscribe a vendor; record evidence of each import.
