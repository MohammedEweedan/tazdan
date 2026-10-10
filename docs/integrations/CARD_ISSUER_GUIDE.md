# Card issuer guide

Status: **interface complete; refused in production.** See [../CARDS.md](../CARDS.md).

Implement `CardIssuer` (`issueVirtualCard`, `freezeCard`, `unfreezeCard`, `cancelCard`) in `server/src/services/cardIssuer/` and set `CARD_ISSUER`. Then add: real-time authorisation webhook (approve/decline against the card's funding wallet with a reservation, `card_spend` journal on clearing), refunds and reversals, physical card fulfilment, dispute/chargeback flow, tokenisation for wallets if offered, and PCI scope review (Tazdan stores only the issuer card id and last four digits). Remove the development simulation route only if the issuer sandbox replaces it.
