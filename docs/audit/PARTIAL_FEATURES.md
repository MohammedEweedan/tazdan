# Partial features

Features that exist but are incomplete, depend on something not yet in place, or carry a known risk.

| Feature | What is missing or risky | What it needs |
|---|---|---|
| Remittance (all 12 corridors) | Runs only against sandbox payout rails | A licensed payout partner per corridor, an adapter against its API (interface already defined), prefunding or settlement terms, then `LIVE` status (refused until an enabled production rail exists) |
| Buy / sell crypto | When the hedge venue (Binance) is unreachable — it is geo-blocked from the production host — orders fill against the platform: Tazdan becomes the unhedged counterparty | A reachable liquidity venue or a proxy, and a hedging policy ([docs/business/hedging-execution-plan.md](../business/hedging-execution-plan.md)) |
| Cards | Issuer abstraction complete; refused in production | Card issuer contract and adapter |
| Card / gateway deposits | On-ramp abstraction complete; refused in production | PSP account and adapter (a Stripe adapter exists) |
| Sanctions screening | Matching engine and review workflow complete; no list data bundled | Import official lists regularly, or subscribe a screening vendor |
| Phone OTP | Refuses to simulate in production | Twilio or Meta credentials |
| Bank deposits | Placeholder accounts removed | Administrator must enter Tazdan's real accounts per currency |
| Business KYB evidence | Submission flips the business to review and opens a KYB case; there is no in-app upload of company documents — staff request them | A document upload step for KYB |
| AI assistant | Off in production by default | Anthropic API key, data-processing agreement, `AI_LEVEL` |
| Crypto withdrawals on TRON | Live broadcast not implemented (simulated broadcast refused in production) | TRON signing/broadcast path |
| Mobile changes in this programme | Type-checked only | Device build and manual test (step-up modal in Send/chat/bulk-pay, Send abroad, Convert, deposit, Receive, business approvals and invitations) |
| Liquidity-pool / group features | Controllers exist but are not mounted | Product decision; leave unmounted until then |
| Fee revenue mirror | Fees are mirrored to the platform user's wallet as well as the ledger | Retire the mirror in favour of the ledger PLATFORM account |
