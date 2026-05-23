/**
 * Checkout.com Unified Payments on-ramp implementation.
 *
 * Well-suited for MENA markets (AED, SAR, EGP, LYD).
 *
 * Environment variables required:
 *   CHECKOUT_SECRET_KEY             — API secret key
 *   CHECKOUT_PROCESSING_CHANNEL_ID  — processing channel identifier
 *   CHECKOUT_WEBHOOK_SECRET         — HMAC secret for verifying webhooks
 *   CLIENT_URL                      — front-end base URL for redirect links
 */
import crypto from 'node:crypto';
import axios from 'axios';
import { AppError } from '../../middleware/errorHandler';
import type {
  OnRampProvider,
  OnRampQuote,
  OnRampQuoteRequest,
  OnRampConfirmRequest,
  OnRampConfirmResult,
  OnRampWebhookEvent,
} from './index';

const CHECKOUT_API = 'https://api.checkout.com';
const CRYPTO_COMPARE_API = 'https://min-api.cryptocompare.com/data/price';

export class CheckoutOnRamp implements OnRampProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly name = 'CHECKOUT' as any;

  async quote(req: OnRampQuoteRequest): Promise<OnRampQuote> {
    // Checkout.com has no quote API — compute the rate from live prices.
    const feeAmount = req.fiatAmount * 0.029 + 0.30;

    // Fetch live price of the crypto in both USD and the fiat currency.
    // CryptoCompare returns: { USD: <number>, <fiatCurrency>: <number> }
    let cryptoPriceInFiat: number;
    try {
      const resp = await axios.get<Record<string, number>>(CRYPTO_COMPARE_API, {
        params: {
          fsym: req.cryptoCurrency,
          tsyms: `USD,${req.fiatCurrency}`,
        },
        timeout: 5000,
      });
      const data = resp.data;
      // Prefer a direct quote; fall back to USD cross-rate.
      if (data[req.fiatCurrency] && data[req.fiatCurrency] > 0) {
        cryptoPriceInFiat = data[req.fiatCurrency];
      } else if (data['USD'] && data['USD'] > 0) {
        // Rough cross-rate — better than nothing for unsupported pairs.
        cryptoPriceInFiat = data['USD'];
      } else {
        throw new Error('No usable price returned');
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? `CryptoCompare price fetch failed: ${err.response?.status}`
        : `CryptoCompare price fetch error: ${String(err)}`;
      throw new AppError(msg, 502);
    }

    const netFiatAmount = req.fiatAmount - feeAmount;
    const cryptoAmount = Math.max(0, netFiatAmount / cryptoPriceInFiat);
    // Exchange rate: how many crypto units per 1 fiat unit.
    const exchangeRate = cryptoPriceInFiat > 0 ? 1 / cryptoPriceInFiat : 0;

    return {
      providerRef: `checkout_q_${crypto.randomUUID()}`,
      exchangeRate,
      cryptoAmount,
      feeAmount,
      feeCurrency: req.fiatCurrency,
      expiresAt: new Date(Date.now() + 60_000), // 60 seconds
    };
  }

  async confirm(req: OnRampConfirmRequest): Promise<OnRampConfirmResult> {
    const secretKey = process.env.CHECKOUT_SECRET_KEY;
    const processingChannelId = process.env.CHECKOUT_PROCESSING_CHANNEL_ID;
    const clientUrl = process.env.CLIENT_URL;

    if (!secretKey) throw new AppError('CHECKOUT_SECRET_KEY not configured', 500);
    if (!processingChannelId) throw new AppError('CHECKOUT_PROCESSING_CHANNEL_ID not configured', 500);
    if (!clientUrl) throw new AppError('CLIENT_URL not configured', 500);

    // The caller passes { amountCents, currency } as JSON in paymentToken.
    if (!req.paymentToken) {
      throw new AppError('Missing paymentToken (expected JSON: { amountCents, currency })', 400);
    }
    const { amountCents, currency } = JSON.parse(req.paymentToken) as {
      amountCents: number;
      currency: string;
    };

    const payload = {
      amount: amountCents,
      currency: currency.toUpperCase(),
      payment_type: 'Regular',
      description: 'fortuni onramp',
      reference: req.providerRef,
      processing_channel_id: processingChannelId,
      '3ds': { enabled: true },
      success_url: `${clientUrl}/onramp/success`,
      failure_url: `${clientUrl}/onramp/failure`,
    };

    try {
      const resp = await axios.post<{ _links?: { redirect?: { href: string } } }>(
        `${CHECKOUT_API}/payments`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const redirectUrl = resp.data._links?.redirect?.href;
      return {
        providerRef: req.providerRef,
        status: 'PENDING',
        redirectUrl,
      };
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? `Checkout.com payment failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`
        : `Checkout.com payment error: ${String(err)}`;
      throw new AppError(msg, 502);
    }
  }

  async parseWebhook(headers: Record<string, string>, rawBody: string): Promise<OnRampWebhookEvent> {
    const webhookSecret = process.env.CHECKOUT_WEBHOOK_SECRET;
    if (!webhookSecret) throw new AppError('CHECKOUT_WEBHOOK_SECRET not configured', 500);

    const receivedSig = headers['cko-signature'];
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!receivedSig || receivedSig !== expectedSig) {
      throw new AppError('Invalid Checkout.com webhook signature', 400);
    }

    const event = JSON.parse(rawBody) as {
      type: string;
      data?: { id?: string; reference?: string };
    };

    const providerRef = event.data?.reference ?? event.data?.id ?? 'unknown';

    let status: OnRampWebhookEvent['status'];
    switch (event.type) {
      case 'payment.approved':
        status = 'COMPLETED';
        break;
      case 'payment.declined':
        status = 'FAILED';
        break;
      default:
        status = 'PROCESSING';
    }

    return { providerRef, status, raw: event };
  }
}
