# Routing

`services/remittance/routing.ts` decides which payout rail pays each transfer.

## Eligibility

For a payout (destination country, currency, payout method, amount) every registered rail is evaluated. A rail that does not serve the currency or country is skipped. A rail that does is **kept with a reason** if it is ineligible, so operators can see why it was not used:

- does not support the payout method;
- sandbox rail while running in production;
- provider not `ENABLED` in the provider registry;
- provider paused by a kill switch;
- circuit breaker open after repeated failures;
- amount outside the provider's limits;
- insufficient prefunded liquidity in its treasury pool (prefunded and internal rails).

## Scoring

Eligible rails are scored 0–1:

| Factor | Weight | Measure |
|---|---|---|
| Cost | 35% | provider fee relative to the cheapest eligible rail |
| Speed | 25% | SLA, pushed to the next business morning after the cut-off (Friday and Saturday treated as non-business days for MENA rails) |
| Reliability | 25% | paid ÷ (paid + failed + returned) over 30 days; below 10 outcomes, 0.95 is assumed and flagged |
| Liquidity | 15% | prefunded headroom relative to this payout |
| Health penalty | −0.2 | when the provider's last health check failed |

The best rail becomes the route and the next the fallback. The complete ranking, with factors, is stored (`RemittanceRoute`) against the quote and the transfer and shown on the transfer page in the cockpit.

## Registered rails

| Code | Mode | Settlement | Notes |
|---|---|---|---|
| `SANDBOX_GB_FPS` | Sandbox | Prefunded | UK Faster Payments simulation |
| `SANDBOX_EU_SEPA` | Sandbox | Prefunded | SEPA Instant simulation |
| `SANDBOX_EG_BANK` | Sandbox | Prefunded | Egypt bank simulation, weekday cut-off |
| `SANDBOX_TR_FAST` | Sandbox | Prefunded | Turkey FAST simulation |
| `SANDBOX_AE_IPP` | Sandbox | Prefunded | UAE instant payments simulation |
| `SANDBOX_TN_BANK` | Sandbox | Prefunded | Tunisia bank simulation, cut-off |
| `SANDBOX_LY_BANK` | Sandbox | Prefunded | Libya bank simulation, cut-off |
| `SANDBOX_SWIFT` | Sandbox | Post-funded | Correspondent simulation (daily settlement obligations) |
| `TAZDAN_WALLET` | Production | Internal | Credits a Tazdan customer's wallet |

Adding a real partner: [integrations/PAYOUT_PROVIDER_GUIDE.md](integrations/PAYOUT_PROVIDER_GUIDE.md).
