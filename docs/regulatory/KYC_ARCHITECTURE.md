# KYC architecture

> Technical description of controls implemented in software. It is not legal advice, does not describe a licensed activity, and implies no regulatory approval. Tazdan holds no licence referenced in this repository.

- **Collection**: identity documents uploaded in the app (`POST /api/users/kyc`), stored in the backed-up uploads volume.
- **Decision**: manual review in the cockpit KYC queue (`customers.kyc.review`), every decision audited; a vendor can be connected through the KYC provider interface ([../integrations/KYC_PROVIDER_GUIDE.md](../integrations/KYC_PROVIDER_GUIDE.md)). Mock auto-approval exists only outside production.
- **Tiers**: `kycTier` drives per-currency limits for deposits, withdrawals and transfers (`enforceKycLimit`); fiat withdrawals require approved KYC.
- **Businesses (KYB)**: owner submits; a KYB case opens; compliance approves or rejects with a note (the owner is notified); payouts are refused until approval.
- **Ongoing**: security changes (password, 2FA) are recorded and feed fraud rules; there is no periodic re-verification or document-expiry tracking yet.
- **Privacy**: contact details masked for staff without `customers.pii`; AI tools mask personal data.
