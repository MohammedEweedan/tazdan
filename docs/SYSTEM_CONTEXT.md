# System context

## Actors

| Actor | Uses | Authenticates with |
|---|---|---|
| Consumer | Mobile app | Email/password, refresh-token sessions, optional TOTP 2FA, device trust, step-up codes |
| Business owner and team | Mobile business screens | Same as consumer, plus business role (OWNER, ADMIN, ANALYST, DEVELOPER) |
| Business system | Public API `/api/v1` | API key (`tzk_live_…` / `tzk_test_…`), scoped |
| Staff | Web Control Cockpit, mobile admin screens | Staff account (role ADMIN) + staff roles and permissions |
| Payout partner | Callback endpoint `/api/remittance/webhooks/:providerCode` | HMAC signature over the raw body |
| Other providers | Webhooks (crypto withdrawal, WhatsApp, on-ramp) | Per-provider secrets |

## External systems

| System | Purpose | State |
|---|---|---|
| PostgreSQL | System of record | Live |
| Redis | Rate limits, session denylist, codes | Optional; degraded mode without it |
| Resend | Transactional email | Live |
| Fulus API | LYD parallel-market rate (primary) | Live when `FULUS_API_TOKEN` is set |
| open.er-api / Coinbase / CryptoCompare | FX and crypto reference prices | Live |
| Binance | Crypto order hedging | Geo-blocked from production; orders fall back to simulated fills |
| Ethereum / Bitcoin / Solana RPCs | On-chain deposits and withdrawals | Live paths for ETH, USDT-ERC20, BTC, SOL; TRON not live |
| Payout partners | Remittance payouts | Sandbox adapters only |
| Card issuer, PSP, off-ramp | Cards, card deposits, fiat off-ramp | Interfaces only; refused in production |
| KYC vendor | Identity verification | Optional; manual review in production by default |
| Twilio / Meta | Phone OTP, WhatsApp | Refuse to simulate in production |
| Anthropic API | AI assistant | Off in production by default |
| Vercel | Website hosting | Live |
| DigitalOcean | API droplet | Live |

See [ARCHITECTURE.md](ARCHITECTURE.md) for the internal structure and [PROVIDERS.md](PROVIDERS.md) for the adapter model.
