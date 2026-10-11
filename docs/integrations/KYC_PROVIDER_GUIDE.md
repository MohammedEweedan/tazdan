# KYC provider guide

Status: **manual review works in production; vendor interface exists (`server/src/services/kyc/`).**

The KYC provider interface creates an applicant and a session token for the vendor's SDK and receives the vendor's decision. `KYC_PROVIDER=MOCK` auto-approves only outside production (production defaults to `MANUAL`, and startup validation refuses MOCK in production).

To activate a vendor: contract; implement the adapter; embed the vendor SDK in the mobile KYC screen; verify decision webhooks; map vendor outcomes to `kycStatus` and `kycTier`; store the vendor's reference and decision on the user; keep manual review as the fallback queue for vendor "review" outcomes. KYB (businesses) follows the same pattern; today KYB is reviewed by staff from a case.
