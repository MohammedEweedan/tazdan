/**
 * Card issuer abstraction (virtual Visa cards).
 *
 * Real candidates: Stripe Issuing, Marqeta, Railsbank, Lithic.
 * `MockCardIssuer` returns deterministic fake card data so the rest of the
 * card flow (issuance → activation → spend → freeze) works end-to-end in dev.
 */

import { v4 as uuidv4 } from 'uuid';
import type { CardTier, Currency } from '@prisma/client';

export interface CardIssuanceRequest {
  userId: string;
  tier: CardTier;
  currency: Currency;
  cardHolder: string;          // "RAYAN ZAHI"
  nickname?: string;
  shippingCountry?: string;    // virtual = no shipping, but we record jurisdiction
}

export interface CardIssuanceResult {
  externalCardId: string;      // provider's card id (Stripe `ic_…`, Marqeta token…)
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  network: 'VISA' | 'MASTERCARD';
}

export interface CardActionRequest {
  externalCardId: string;
}

export interface CardIssuer {
  readonly name: 'MOCK' | 'STRIPE' | 'MARQETA' | 'RAILSBANK' | 'LITHIC';
  issueVirtualCard(req: CardIssuanceRequest): Promise<CardIssuanceResult>;
  freezeCard(req: CardActionRequest): Promise<void>;
  unfreezeCard(req: CardActionRequest): Promise<void>;
  cancelCard(req: CardActionRequest): Promise<void>;
}

class MockCardIssuer implements CardIssuer {
  readonly name = 'MOCK' as const;

  async issueVirtualCard(req: CardIssuanceRequest): Promise<CardIssuanceResult> {
    void req;
    const last4 = String(Math.floor(1000 + Math.random() * 9000));
    const now = new Date();
    return {
      externalCardId: `mock_card_${uuidv4()}`,
      last4,
      expiryMonth: now.getMonth() + 1,
      expiryYear: now.getFullYear() + 4,
      network: 'VISA',
    };
  }

  async freezeCard(_: CardActionRequest): Promise<void> { /* no-op */ }
  async unfreezeCard(_: CardActionRequest): Promise<void> { /* no-op */ }
  async cancelCard(_: CardActionRequest): Promise<void> { /* no-op */ }
}

class StripeIssuingCardIssuer implements CardIssuer {
  readonly name = 'STRIPE' as const;
  async issueVirtualCard(_: CardIssuanceRequest): Promise<CardIssuanceResult> { throw new Error('Stripe Issuing not configured. Set STRIPE_SECRET_KEY and implement.'); }
  async freezeCard(_: CardActionRequest): Promise<void> { throw new Error('Stripe Issuing not configured.'); }
  async unfreezeCard(_: CardActionRequest): Promise<void> { throw new Error('Stripe Issuing not configured.'); }
  async cancelCard(_: CardActionRequest): Promise<void> { throw new Error('Stripe Issuing not configured.'); }
}

let cached: CardIssuer | null = null;

export function getCardIssuer(): CardIssuer {
  if (cached) return cached;
  const name = (process.env.CARD_ISSUER || 'MOCK').toUpperCase();
  switch (name) {
    case 'STRIPE': cached = new StripeIssuingCardIssuer(); break;
    case 'MOCK':
    default:       cached = new MockCardIssuer();          break;
  }
  return cached;
}

export function __resetCardIssuer() { cached = null; }
