# Funds flow

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

## Customer money in

```mermaid
flowchart LR
  B[Customer bank] -->|transfer with reference| TB[Tazdan bank account]
  TB -.staff confirm.-> L1[Ledger: SYSTEM_ONRAMP → USER]
  C[Crypto wallet] -->|on-chain deposit, verified| L2[Ledger: SYSTEM_CHAIN → USER]
  BIZ[Business wallet] -->|bulk payout| L3[Ledger: business USER → recipient USER + PLATFORM fee]
```

## Remittance (Tripoli → London)

```mermaid
sequenceDiagram
  participant W as Sender wallet (USER, LYD)
  participant CL as REMITTANCE_CLEARING (LYD)
  participant T as TREASURY (LYD / GBP pool)
  participant P as PLATFORM (LYD)
  participant OUT as SYSTEM_OFFRAMP (GBP)
  W->>CL: total debit (principal + fee) at funding
  Note over CL: customer money in transit (customer fund class)
  CL->>T: principal at base rate (LYD)
  CL->>P: fee + FX margin (LYD revenue)
  T->>OUT: receive amount (GBP) from the prefunded partner pool
  Note over OUT: beneficiary's bank credited by the payout partner
```

Refund before payout: clearing → sender, in full including the fee. Payout returned after payment: the paid journal is reversed leg for leg, then refunded. Goodwill refund after delivery: platform revenue → sender (dual control).

## Money out

| Path | Controls | Ledger |
|---|---|---|
| Bank withdrawal | KYC, limits, step-up, screening + risk engine, staff approval | USER → SYSTEM_OFFRAMP (+ PLATFORM fee) |
| On-chain withdrawal | kill switches, 2FA, address allow-list (24 h), KYC limits, address screening + risk engine | USER → SYSTEM_CHAIN; refund on broadcast failure |
| Remittance payout | above | see diagram |

All journals balance per currency; the database rejects unbalanced groups at commit. See [../LEDGER.md](../LEDGER.md).
