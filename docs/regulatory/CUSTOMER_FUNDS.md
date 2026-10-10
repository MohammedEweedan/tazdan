# Customer funds

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

## Segregation in the ledger

Every ledger account carries a fund class:

| Class | Accounts | Meaning |
|---|---|---|
| CUSTOMER | USER, SYSTEM_ESCROW, REMITTANCE_CLEARING | Money owed to customers |
| SETTLEMENT | SYSTEM_ONRAMP/OFFRAMP/CHAIN/FX, PARTNER_SETTLEMENT, TREASURY, SUSPENSE, ADJUSTMENT | Money in transit with rails and partners, and controlled corrections |
| CORPORATE | PLATFORM | Tazdan's revenue |

The customer-funds figure at any moment is the sum of CUSTOMER-class balances; the Ledger page shows balances by class. A safeguarding reconciliation (CUSTOMER total vs safeguarding bank balances and custody holdings) is **not automated** — it needs bank statement connectivity ([../integrations/BANK_INTEGRATION_GUIDE.md](../integrations/BANK_INTEGRATION_GUIDE.md)).

## Protections

- Customer balances can be changed only by balanced journals; operators cannot edit balances (corrections are dual-controlled adjustments).
- Reservations protect money committed to pending operations; administrative freezes never release them.
- Remittance funds sit in clearing (customer class) until paid out or refunded; clearing is reconciled against in-flight transfers.
- Revenue is recognised only at payout (fee and FX margin), never at funding.

## Gaps

Safeguarding accounts and their daily reconciliation, corporate-vs-customer bank segregation, and insolvency-remote arrangements are business and legal actions outside the codebase.
