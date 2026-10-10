# Cards

## State

Card features exist in the mobile app and API (virtual card issuance, freeze/unfreeze/cancel, top-up, physical card order, funding from budgets, spend history with cashback). They are **off in production**: the card issuer abstraction (`services/cardIssuer/index.ts`) refuses its MOCK issuer when `NODE_ENV=production`, and top-up, physical orders and budget funding sit behind `requireFeature('cards')`.

## Issuer abstraction

```ts
interface CardIssuer {
  name: 'MOCK' | 'STRIPE' | 'MARQETA' | 'RAILSBANK' | 'LITHIC';
  issueVirtualCard(req): Promise<{ externalCardId, last4, expiryMonth, expiryYear, network }>;
  freezeCard(req): Promise<void>;
  unfreezeCard(req): Promise<void>;
  cancelCard(req): Promise<void>;
}
```

Selected by `CARD_ISSUER`; `getActiveCardIssuer()` applies the production guard. Card freeze, unfreeze and cancel in Tazdan propagate to the issuer. Card numbers are never stored — only the issuer's id and the last four digits.

## Development-only simulation

`POST /api/cards/:id/transactions` (simulated purchases) returns 404 in production; the mobile "Simulate" button exists only in development builds.

## To go live

An issuer programme (BIN sponsor, processor), an adapter implementing the interface, authorisation webhooks posting `card_spend` journals in real time, dispute/chargeback handling, and scheme compliance. See [integrations/CARD_ISSUER_GUIDE.md](integrations/CARD_ISSUER_GUIDE.md).
