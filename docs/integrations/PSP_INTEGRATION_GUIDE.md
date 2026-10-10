# PSP integration guide (card and gateway deposits)

Status: **interface complete; refused in production until a real PSP is configured.**

`server/src/services/onramp/` defines the on-ramp provider (`quote`, `confirm`, `parseWebhook`). A Stripe adapter exists (`stripe.provider.ts`); MoonPay is a stub. `getActiveOnRampProvider()` refuses the MOCK provider in production, so card deposits cannot complete with fake success.

To activate: merchant account and underwriting; set `ONRAMP_PROVIDER` and the provider's keys; verify webhook signatures; credit only on the PSP's final success event (`webhook_deposit` journal); handle refunds and chargebacks by reversing journals (a chargeback after the money was spent creates a negative balance to recover — define the policy first); add PSP statements to reconciliation; set deposit limits per KYC tier.
