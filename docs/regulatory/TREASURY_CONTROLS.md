# Treasury controls

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

- Pools per partner and currency with target, minimum and maximum exposure (database checks keep thresholds consistent).
- Movements are append-only, carry a bank or partner reference and a note, post matching ledger journals, and require `treasury.operate`; threshold changes are audited.
- Reservations under a row lock prevent over-commitment; payouts consume reservations; failures release them.
- Alerts: low liquidity, below target, over-exposure, rapid depletion, concentration, overdue post-funded settlements.
- Integrity reconciliation compares pools with pool-related ledger legs.
- Corridors refuse to quote when the base rate leaves treasury floor/ceiling bounds; FX overrides need a second approver and expire.
- Forecast of days of cover per pool.

Not automated: partner balance confirmations, bank statement matching for prefunds, FX hedging of pool positions.
