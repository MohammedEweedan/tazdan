# Tazdan — remaining external dependencies

Every item below is **INTERNAL IMPLEMENTATION COMPLETE / EXTERNAL PROVIDER ACTIVATION REQUIRED** unless stated. Nothing in this repository is a licence, contract or certification.

| Dependency | Needed for | What exists in Tazdan | Activation steps | Guide |
|---|---|---|---|---|
| Regulatory authorisations (payments/e-money/MTO; VASP) | Operating any money service | Controls supporting compliance | Legal | [docs/legal/licensing-memo.md](docs/legal/licensing-memo.md) |
| Payout partners (UK, euro area, Egypt, Turkey, UAE, Tunisia, Libya) | Remittance corridors | Orchestration, routing, treasury, reconciliation, 8 sandbox rails | Contract, adapter, prefund, enable, set corridor `LIVE` | [docs/integrations/PAYOUT_PROVIDER_GUIDE.md](docs/integrations/PAYOUT_PROVIDER_GUIDE.md) |
| Safeguarding / operating bank accounts | Holding customer funds; bank deposits | Fund-class ledger; deposit flow; admin bank-account management | Open accounts; enter them in Platform banks | [docs/integrations/BANK_INTEGRATION_GUIDE.md](docs/integrations/BANK_INTEGRATION_GUIDE.md) |
| Sanctions/PEP data | Screening coverage | Screening engine, review workflow, import tool | Import official lists daily or subscribe a vendor | [docs/integrations/AML_PROVIDER_GUIDE.md](docs/integrations/AML_PROVIDER_GUIDE.md) |
| KYC/KYB vendor (optional) | Automated verification | Manual review; provider interface | Contract, adapter, SDK | [docs/integrations/KYC_PROVIDER_GUIDE.md](docs/integrations/KYC_PROVIDER_GUIDE.md) |
| Card issuer | Cards | Issuer interface, card features | Programme, adapter, authorisation webhooks | [docs/integrations/CARD_ISSUER_GUIDE.md](docs/integrations/CARD_ISSUER_GUIDE.md) |
| PSP | Card / gateway deposits | On-ramp interface, Stripe adapter | Merchant account, keys, webhooks | [docs/integrations/PSP_INTEGRATION_GUIDE.md](docs/integrations/PSP_INTEGRATION_GUIDE.md) |
| Crypto liquidity venue reachable from production | Hedged buy/sell | Order execution; simulated fills when unreachable | Venue/OTC/proxy or principal-risk policy | [docs/integrations/VASP_INTEGRATION_GUIDE.md](docs/integrations/VASP_INTEGRATION_GUIDE.md) |
| AWS KMS key | Custody seed protection | KMS envelope encryption | Create key, set `MASTER_SEED_KMS_KEY_ID`, re-wrap seed | [docs/runbooks/custody-kms.md](docs/runbooks/custody-kms.md) |
| Offsite backup storage | Disaster recovery | Backup sidecar with verification | Set `BACKUP_S3_URI` and keys; drill | [docs/runbooks/backup-restore.md](docs/runbooks/backup-restore.md) |
| Twilio or Meta | Phone OTP, WhatsApp | Integrations (refuse to simulate in production) | Credentials | — |
| Anthropic (optional) | AI assistant | AI layer, off in production | DPA, key, `AI_LEVEL` | [docs/AI_AUTOMATION.md](docs/AI_AUTOMATION.md) |
| Penetration testing firm | Independent assurance | Scope document | Engage | [docs/security/pentest-scope.md](docs/security/pentest-scope.md) |
| TRON fee-delegation treasury | USDT-TRC20 withdrawals | Gated path | Fund TRX treasury; implement broadcast | [docs/BLOCKCHAIN.md](docs/BLOCKCHAIN.md) |
