# Data retention

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

## Current state

No automated retention or deletion is implemented. Evidence tables are append-only; deletion requires an explicit purge transaction. Backups keep 14 days of nightly dumps locally (longer offsite according to the bucket policy).

## What needs a policy (owner decision with counsel)

| Data | Typical driver | Notes |
|---|---|---|
| Ledger, transactions, transitions, audit, risk decisions, cases | AML record-keeping (commonly 5+ years after the relationship ends) | Keep; purge only via an approved retention job using `tazdan.allow_purge` |
| KYC documents | AML record-keeping vs data minimisation | Stored in the uploads volume |
| Messages and support conversations | Product and dispute evidence | |
| Security events, provider call logs, metric samples | Security and operations | Shorter retention is likely appropriate |
| AI interactions | Accountability of AI use | Includes masked customer data |

## Data-subject rights

Export and erasure tooling is not built. Erasure must respect record-keeping obligations (pseudonymise rather than delete regulated records).
