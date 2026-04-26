/**
 * Off-ramp provider abstraction.
 *
 * Mirrors `services/onramp` but in reverse — user sells crypto, receives fiat.
 * Real providers: MoonPay, Transak, Sardine, Stripe Treasury, Revolut Business.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  RampProvider as RampProviderEnum,
  RampPaymentMethod,
  Currency,
} from '@prisma/client';

export interface OffRampQuoteRequest {
  cryptoCurrency: Currency;
  cryptoAmount: number;
  fiatCurrency: Currency;
  payoutMethod: RampPaymentMethod;
  payoutBankAccountId?: string;     // required for BANK_TRANSFER / SEPA / ACH
  payoutAddress?: string;           // required for CRYPTO send
  userId: string;
  userIp?: string;
}

export interface OffRampQuote {
  providerRef: string;
  exchangeRate: number;
  fiatAmount: number;
  feeAmount: number;
  feeCurrency: Currency;
  expiresAt: Date;
}

export interface OffRampConfirmRequest {
  providerRef: string;
}

export interface OffRampConfirmResult {
  providerRef: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failureReason?: string;
}

export interface OffRampWebhookEvent {
  providerRef: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  raw: unknown;
}

export interface OffRampProvider {
  readonly name: RampProviderEnum;
  quote(req: OffRampQuoteRequest): Promise<OffRampQuote>;
  confirm(req: OffRampConfirmRequest): Promise<OffRampConfirmResult>;
  parseWebhook(headers: Record<string, string>, rawBody: string): Promise<OffRampWebhookEvent>;
}

class MockOffRampProvider implements OffRampProvider {
  readonly name = 'MOCK' as const;

  async quote(req: OffRampQuoteRequest): Promise<OffRampQuote> {
    const ratesVsUSD: Record<string, number> = {
      USDT: 1, USD: 1, EUR: 1.08, GBP: 1.25, AED: 0.27, SAR: 0.27, EGP: 0.020, LYD: 0.21,
      BTC: 65000, ETH: 3200, SOL: 150, BNB: 600, XRP: 0.55, ADA: 0.45,
      DOGE: 0.15, MATIC: 0.7, DOT: 7, AVAX: 35,
    };
    const cryptoUsd = (ratesVsUSD[req.cryptoCurrency] ?? 1) * req.cryptoAmount;
    const fiatUsd   = ratesVsUSD[req.fiatCurrency] ?? 1;
    const fiatGross = cryptoUsd / fiatUsd;
    const feeFiat   = fiatGross * 0.015;                // 1.5% off-ramp fee
    return {
      providerRef: `mock_${uuidv4()}`,
      exchangeRate: cryptoUsd / req.cryptoAmount,
      fiatAmount: Math.max(0, fiatGross - feeFiat),
      feeAmount: feeFiat,
      feeCurrency: req.fiatCurrency,
      expiresAt: new Date(Date.now() + 60 * 1000),
    };
  }

  async confirm(req: OffRampConfirmRequest): Promise<OffRampConfirmResult> {
    return { providerRef: req.providerRef, status: 'COMPLETED' };
  }

  async parseWebhook(_h: Record<string, string>, rawBody: string): Promise<OffRampWebhookEvent> {
    const parsed = JSON.parse(rawBody);
    return { providerRef: parsed.providerRef ?? 'unknown', status: parsed.status ?? 'COMPLETED', raw: parsed };
  }
}

// Stubs — real integrations live behind these
class MoonPayOffRampProvider implements OffRampProvider {
  readonly name = 'MOONPAY' as const;
  async quote(_: OffRampQuoteRequest): Promise<OffRampQuote> { throw new Error('MoonPay off-ramp not configured.'); }
  async confirm(_: OffRampConfirmRequest): Promise<OffRampConfirmResult> { throw new Error('MoonPay off-ramp not configured.'); }
  async parseWebhook(): Promise<OffRampWebhookEvent> { throw new Error('MoonPay off-ramp not configured.'); }
}

let cached: OffRampProvider | null = null;

export function getOffRampProvider(): OffRampProvider {
  if (cached) return cached;
  const name = (process.env.OFFRAMP_PROVIDER || 'MOCK').toUpperCase();
  switch (name) {
    case 'MOONPAY': cached = new MoonPayOffRampProvider(); break;
    case 'MOCK':
    default:        cached = new MockOffRampProvider();    break;
  }
  return cached;
}

export function __resetOffRampProvider() { cached = null; }
