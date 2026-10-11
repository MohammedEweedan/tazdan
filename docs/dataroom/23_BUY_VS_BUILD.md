# 23 — Buy vs build

See also [../../TAZDAN_BUY_VS_BUILD.md](../../TAZDAN_BUY_VS_BUILD.md).

| Component | Build (as Tazdan did) | Buy (market options) | Observation |
|---|---|---|---|
| Ledger | Built: database-enforced double entry | Ledger-as-a-service products | Built version is tightly integrated with state machines and controls |
| Wallets and payments core | Built | Banking-as-a-service platforms | BaaS ties you to the provider's jurisdictions and licences |
| Remittance orchestration | Built; partners still needed | Remittance network providers, white-label MTOs | Partners are required either way; orchestration lets you multi-source |
| KYC / KYB | Manual review built; vendor interface | KYC vendors | Buying is normal; integration point exists |
| Sanctions screening | Engine built; data must be sourced | Screening vendors | Lists or a vendor must be bought regardless |
| Transaction monitoring | Rule engine built | Monitoring vendors | Built engine covers core rules; vendors add analytics |
| Card issuing | Interface only | Issuer processors | Must be bought |
| Crypto custody | Built (HD wallets, KMS) | Custodians | Regulated custody may be required by licence conditions |
| Back office | Control Cockpit built | Generic admin tools | Built cockpit is domain-specific with dual control and audit |

Acquiring Tazdan provides the built components above (estimate in [21_REPLACEMENT_COST.md](21_REPLACEMENT_COST.md)); it does not provide licences, partners, customers or data.
