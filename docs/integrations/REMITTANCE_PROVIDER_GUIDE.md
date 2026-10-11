# Remittance provider guide

For partners that provide an **end-to-end corridor** (they take a funded instruction and handle FX and payout), as opposed to a local payout rail.

Status: **internal implementation complete; external provider activation required.**

Two integration patterns:

1. **As a payout rail** — Tazdan prices the customer (quote, fee, FX margin), holds funds in clearing, and instructs the partner in the destination currency. Implement the [payout provider interface](PAYOUT_PROVIDER_GUIDE.md); settlement model `PREFUNDED` (Tazdan prefunds destination currency) or `POSTFUNDED` (Tazdan owes the partner per settlement cycle — tracked as `RemittanceSettlement` obligations with due dates and overdue alerts).
2. **Partner prices the FX** — set the corridor's base-rate source to the partner's rate (a rate provider adapter) and record the partner's FX markup in `terms.fxMarkupPercent` so routing compares true cost.

Corridor configuration (cockpit → Remittance): status, limits, payout methods, purposes, source-of-funds threshold, rate floor/ceiling, quote TTL, fee and margin, tier discounts. Compliance, travel-rule data obligations and reporting remain Tazdan's responsibility as the customer-facing institution unless the contract says otherwise — confirm with counsel.
