# Providers

Every external dependency sits behind an adapter with a declared **mode** — `PRODUCTION`, `SANDBOX` or `MOCK`. The provider registry (`Provider` table, synced at boot) records mode, status, coverage, last health check, and every call (`ProviderCall`: operation, latency, success, error code — request/response metadata only, no secrets).

## The production guard

`services/providers/guard.ts` — `assertAdapterUsable(feature, name)` throws when a MOCK or SANDBOX adapter would run with `NODE_ENV=production`. It guards payout rails (routing marks them ineligible), card issuing, card/gateway deposits and the off-ramp. The same rule is enforced by dedicated production checks for KYC mock auto-approval, phone OTP simulation, simulated on-chain broadcasts and simulated card spend. Enabling a sandbox provider in production from the cockpit is refused (`PROVIDER_NOT_ACTIVATED`).

## Circuit breaker and health

Repeated failures open a provider's circuit; routing then skips it until it recovers. Health checks run every 60 seconds; a failing check lowers the provider's routing score. Operators can set a provider to `ENABLED`, `MAINTENANCE` or `DISABLED` (audited), or pause it with a kill switch.

## Inventory

| Domain | Adapters | Production state |
|---|---|---|
| Payout rails | 8 sandbox rails (UK FPS, SEPA, Egypt, Turkey FAST, UAE IPP, Tunisia, Libya, SWIFT) + Tazdan wallet (internal, production) | Sandbox only — partner activation required |
| FX | Fulus (LYD parallel rate), open.er-api, Coinbase, CryptoCompare | Live |
| Crypto execution | Binance | Geo-blocked from production; simulated fills |
| Blockchains | Ethereum, Bitcoin (mempool.space), Solana RPC | Live (TRON not live) |
| Card issuer | MOCK; interface for Stripe, Marqeta, Railsbank, Lithic | Refused in production |
| On-ramp (card/gateway deposits) | MOCK, Stripe adapter, MoonPay stub | Refused in production until configured |
| Off-ramp | MOCK | Refused in production |
| KYC | MOCK (auto-approve, non-production only); manual review | Manual review |
| Sanctions screening | Internal engine over imported lists | Live engine; no bundled data |
| Email | Resend | Live |
| SMS / WhatsApp | Twilio, Meta | Refuse to simulate in production |
| AI | Anthropic | Off in production by default |

## Adding a provider

1. Implement the domain interface (`services/providers/types.ts` for payouts; `services/cardIssuer`, `services/onramp`, `services/offramp`, `services/kyc` for the others) with mode `PRODUCTION`.
2. Register it (`services/providers/registry.ts`) with countries, currencies, payout methods and terms (fees, limits, SLA, cut-off, settlement model).
3. Verify its callbacks by signature over the raw body; make status application idempotent.
4. Implement `statement()` for reconciliation.
5. Run it against the provider's sandbox with the golden tests; enable it in the cockpit; prefund its pool if prefunded; set the corridor `LIVE`.

Guides per provider type: [integrations/](integrations/).
