/**
 * Country-aware payment-method catalogue.
 *
 * What the user sees in the topup sheet depends on where they're
 * verified to live. Reasons:
 *  - Bank rails are country-scoped (UK FPS, US ACH, AED IBAN, etc.)
 *  - Card acquirers refuse some jurisdictions outright
 *  - Local last-mile in controlled-currency markets (LYD cash agents)
 *
 * Keep this map honest. Don't list a method we can't actually settle.
 *
 * Methods are sorted by recommended order (instant + cheapest first).
 *
 * Add a country: append to COUNTRY_METHODS. Add a method: append to
 * METHOD_CATALOGUE and reference its id from the country list.
 */
import type { Currency } from '@/types';

export type PaymentMethodId =
  | 'CARD'              // Stripe card, Apple Pay, Google Pay
  | 'APPLE_PAY'         // Apple Pay direct (when Stripe isn't the rail)
  | 'BANK_TRANSFER'     // SWIFT / IBAN / FPS / ACH — admin-reviewed
  | 'LYD_AGENT'         // Cash deposit via Promrkts agent network (Libya)
  | 'MOONPAY'           // MoonPay redirect (fiat-on-ramp aggregator)
  | 'P2P';              // Peer-to-peer escrow on the platform

export interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  /** Short user-facing description. Keep < 60 chars. */
  description: string;
  icon: string; // Ionicons name
  /** Currencies the method accepts as INPUT (fiat the user pays in). */
  currencies: Currency[];
  /** Real-world settle speed shown next to the method. */
  speed: 'Instant' | '~1 hour' | '1-2 hours' | '1-3 days' | 'Same day';
  /** Fee summary (display only). Real fees come from the quote API. */
  feeSummary: string;
  /** Server provider key — what `paymentMethod` to send on the API. */
  serverMethod: 'CARD' | 'BANK_TRANSFER' | 'APPLE_PAY' | 'P2P';
  /** When false, the option appears greyed out as "coming soon". */
  enabled: boolean;
  /** Daily/per-tx min in USD. UI hint only — server enforces. */
  minUsd?: number;
  maxUsd?: number;
}

export const METHOD_CATALOGUE: Record<PaymentMethodId, PaymentMethod> = {
  CARD: {
    id: 'CARD',
    name: 'Debit or Credit Card',
    description: 'Visa, Mastercard. Apple Pay & Google Pay supported.',
    icon: 'card-outline',
    currencies: ['USD', 'EUR', 'GBP', 'AED'],
    speed: 'Instant',
    feeSummary: '2.9% + $0.30',
    serverMethod: 'CARD',
    enabled: true,
    minUsd: 10,
    maxUsd: 5000,
  },
  APPLE_PAY: {
    id: 'APPLE_PAY',
    name: 'Apple Pay',
    description: 'One-tap payment using your Apple wallet.',
    icon: 'logo-apple',
    currencies: ['USD', 'EUR', 'GBP', 'AED'],
    speed: 'Instant',
    feeSummary: '2.9% + $0.30',
    serverMethod: 'APPLE_PAY',
    enabled: true,
    minUsd: 10,
    maxUsd: 5000,
  },
  BANK_TRANSFER: {
    id: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    description: 'Send from your bank to Promrkts. No card fees.',
    icon: 'business-outline',
    currencies: ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP', 'LYD'],
    speed: '1-3 days',
    feeSummary: 'No fee on deposits over $100',
    serverMethod: 'BANK_TRANSFER',
    enabled: true,
    minUsd: 25,
  },
  LYD_AGENT: {
    id: 'LYD_AGENT',
    name: 'Cash via Promrkts Agent',
    description: 'Pay cash at a local agent and have LYD credited.',
    icon: 'people-outline',
    currencies: ['LYD'],
    speed: '~1 hour',
    feeSummary: '1% agent fee',
    serverMethod: 'BANK_TRANSFER',  // server settles via agent ledger
    enabled: true,
    minUsd: 20,
    maxUsd: 10_000,
  },
  MOONPAY: {
    id: 'MOONPAY',
    name: 'MoonPay',
    description: 'Cards from 160+ countries via MoonPay.',
    icon: 'globe-outline',
    currencies: ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'],
    speed: 'Instant',
    feeSummary: '~4.5% (set by MoonPay)',
    serverMethod: 'CARD',
    enabled: false, // toggle to true once MOONPAY_API_KEY is set
  },
  P2P: {
    id: 'P2P',
    name: 'Peer-to-peer (P2P)',
    description: 'Buy USDT/LYD from another verified Promrkts user.',
    icon: 'swap-horizontal-outline',
    currencies: ['USD', 'AED', 'SAR', 'EGP', 'LYD'],
    speed: 'Same day',
    feeSummary: '0.5% platform fee · escrow protected',
    serverMethod: 'P2P',
    enabled: true,
  },
};

/**
 * Ordered list of method IDs for each ISO 3166-1 alpha-2 country code.
 * Top of the list = recommended/featured option.
 *
 * Any country not listed falls back to DEFAULT_METHODS (international set).
 */
export const COUNTRY_METHODS: Record<string, PaymentMethodId[]> = {
  // ── MENA primary ───────────────────────────────────────────────
  LY: ['LYD_AGENT', 'P2P', 'BANK_TRANSFER'],           // Libya — agent network leads
  EG: ['CARD', 'BANK_TRANSFER', 'P2P'],                // Egypt
  AE: ['APPLE_PAY', 'CARD', 'BANK_TRANSFER', 'P2P'],   // UAE — Apple Pay widely used
  SA: ['APPLE_PAY', 'CARD', 'BANK_TRANSFER', 'P2P'],   // Saudi
  // ── Major fiat ─────────────────────────────────────────────────
  US: ['APPLE_PAY', 'CARD', 'BANK_TRANSFER'],
  GB: ['APPLE_PAY', 'CARD', 'BANK_TRANSFER'],          // UK FPS via bank
  DE: ['CARD', 'BANK_TRANSFER'],                       // SEPA
  FR: ['CARD', 'BANK_TRANSFER'],
  // ── International fallback ─────────────────────────────────────
  // anything else → DEFAULT_METHODS
};

export const DEFAULT_METHODS: PaymentMethodId[] = ['CARD', 'BANK_TRANSFER', 'P2P'];

/**
 * Returns the methods available for a user's verified country, sorted
 * by recommended order, with disabled methods kept at the bottom.
 */
export function methodsForCountry(countryCode: string | null | undefined): PaymentMethod[] {
  const code = (countryCode ?? '').toUpperCase();
  const ids = COUNTRY_METHODS[code] ?? DEFAULT_METHODS;
  const list = ids.map((id) => METHOD_CATALOGUE[id]).filter(Boolean);
  return list.sort((a, b) => Number(b.enabled) - Number(a.enabled));
}

/** Fiat currencies a country can natively deposit in (preferred first). */
export function fiatsForCountry(countryCode: string | null | undefined): Currency[] {
  const methods = methodsForCountry(countryCode);
  const seen = new Set<Currency>();
  const ordered: Currency[] = [];
  for (const m of methods) {
    if (!m.enabled) continue;
    for (const c of m.currencies) {
      if (!seen.has(c)) { seen.add(c); ordered.push(c); }
    }
  }
  return ordered.length ? ordered : ['USD'];
}
