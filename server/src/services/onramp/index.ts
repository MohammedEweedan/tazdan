/**
 * On-ramp provider abstraction.
 *
 * Every provider (MoonPay, Transak, Sardine, Stripe, Revolut) implements the
 * same `OnRampProvider` interface. Route handlers should never import a
 * provider directly — they must call `getOnRampProvider()` so the active
 * implementation can be swapped via env without touching business logic.
 *
 * The current default is `MockOnRampProvider`, which fakes a successful
 * quote + settlement. Replace with a real provider once API keys are wired.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RampProvider as RampProviderEnum,
  RampPaymentMethod,
  Currency,
} from '@prisma/client';

export interface OnRampQuoteRequest {
  fiatCurrency: Currency;
  fiatAmount: number;
  cryptoCurrency: Currency;
  paymentMethod: RampPaymentMethod;
  network?: string;
  userId: string;
  userIp?: string;
}

export interface OnRampQuote {
  providerRef: string;            // provider's quote id
  exchangeRate: number;
  cryptoAmount: number;
  feeAmount: number;
  feeCurrency: Currency;
  expiresAt: Date;
}

export interface OnRampConfirmRequest {
  providerRef: string;
  paymentToken?: string;          // Stripe PI / MoonPay session token / etc.
  redirectUrl?: string;
}

export interface OnRampConfirmResult {
  providerRef: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  redirectUrl?: string;
  failureReason?: string;
}

export interface OnRampWebhookEvent {
  providerRef: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  raw: unknown;
}

export interface OnRampProvider {
  readonly name: RampProviderEnum;
  quote(req: OnRampQuoteRequest): Promise<OnRampQuote>;
  confirm(req: OnRampConfirmRequest): Promise<OnRampConfirmResult>;
  parseWebhook(headers: Record<string, string>, rawBody: string): Promise<OnRampWebhookEvent>;
}

// ─── Mock implementation ─────────────────────────────────────────────
//
// Returns a deterministic "1 fiat unit = 0.000016 BTC" style quote and
// instantly marks anything confirmed as COMPLETED. Useful for dev / tests.
class MockOnRampProvider implements OnRampProvider {
  readonly name = 'MOCK' as const;

  async quote(req: OnRampQuoteRequest): Promise<OnRampQuote> {
    const ratesVsUSD: Record<string, number> = {
      USDT: 1, USD: 1, EUR: 1.08, GBP: 1.25, AED: 0.27, SAR: 0.27, EGP: 0.020, LYD: 0.21,
      BTC: 65000, ETH: 3200, SOL: 150, BNB: 600, XRP: 0.55, ADA: 0.45,
      DOGE: 0.15, MATIC: 0.7, DOT: 7, AVAX: 35,
    };
    const fiatUsd = (ratesVsUSD[req.fiatCurrency] ?? 1) * req.fiatAmount;
    const cryptoUsd = ratesVsUSD[req.cryptoCurrency] ?? 1;
    const feeFiat = req.fiatAmount * 0.029 + 0.30;     // 2.9% + 0.30 fixed (Stripe-ish)
    const cryptoAmount = (fiatUsd - feeFiat * (ratesVsUSD[req.fiatCurrency] ?? 1)) / cryptoUsd;
    return {
      providerRef: `mock_${uuidv4()}`,
      exchangeRate: cryptoUsd / (ratesVsUSD[req.fiatCurrency] ?? 1),
      cryptoAmount: Math.max(0, cryptoAmount),
      feeAmount: feeFiat,
      feeCurrency: req.fiatCurrency,
      expiresAt: new Date(Date.now() + 60 * 1000),     // quote good for 60s
    };
  }

  async confirm(req: OnRampConfirmRequest): Promise<OnRampConfirmResult> {
    return { providerRef: req.providerRef, status: 'COMPLETED' };
  }

  async parseWebhook(_headers: Record<string, string>, rawBody: string): Promise<OnRampWebhookEvent> {
    const parsed = JSON.parse(rawBody);
    return {
      providerRef: parsed.providerRef ?? 'unknown',
      status: parsed.status ?? 'COMPLETED',
      raw: parsed,
    };
  }
}

// ─── Stub implementations (TODO: real integrations) ──────────────────
class MoonPayOnRampProvider implements OnRampProvider {
  readonly name = 'MOONPAY' as const;
  async quote(_: OnRampQuoteRequest): Promise<OnRampQuote> { throw new Error('MoonPay not configured. Set MOONPAY_API_KEY and implement.'); }
  async confirm(_: OnRampConfirmRequest): Promise<OnRampConfirmResult> { throw new Error('MoonPay not configured.'); }
  async parseWebhook(): Promise<OnRampWebhookEvent> { throw new Error('MoonPay not configured.'); }
}

// Real Stripe implementation lives in ./stripe.provider.ts. Imported
// lazily inside the factory so MOCK deployments don't need
// STRIPE_SECRET_KEY at startup.

// ─── Factory ──────────────────────────────────────────────────────────
let cached: OnRampProvider | null = null;

export function getOnRampProvider(): OnRampProvider {
  if (cached) return cached;
  const name = (process.env.ONRAMP_PROVIDER || 'MOCK').toUpperCase();
  switch (name) {
    case 'MOONPAY': cached = new MoonPayOnRampProvider(); break;
    case 'STRIPE': {
      // Lazy require so MOCK builds don't need stripe env vars.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { StripeOnRamp } = require('./stripe.provider') as typeof import('./stripe.provider');
      cached = new StripeOnRamp();
      break;
    }
    case 'MOCK':
    default:        cached = new MockOnRampProvider();    break;
  }
  return cached;
}

// Reset cache (test helper)
export function __resetOnRampProvider() { cached = null; }
