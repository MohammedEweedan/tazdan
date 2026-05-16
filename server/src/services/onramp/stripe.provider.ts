/**
 * Stripe on-ramp implementation.
 *
 * Mode of operation:
 *   1. Client calls /api/deposits/quote which calls quote() — we return
 *      an estimated rate but do NOT yet create a PaymentIntent (saves
 *      idempotent creation if the user backs out).
 *   2. Client confirms — confirm() creates a PaymentIntent against
 *      Stripe and returns the client secret. The mobile app passes
 *      the client_secret to Stripe's PaymentSheet (React Native SDK)
 *      OR opens a Stripe Checkout URL in an in-app browser.
 *   3. Stripe POSTs to /api/deposits/webhook/stripe with a signed
 *      event. We verify the signature with the webhook secret and
 *      then call processDeposit() to credit the user.
 *
 * Crucially: we never see card numbers. Stripe Elements/PaymentSheet
 * tokenises everything client-side, so our PCI scope is SAQ-A (the
 * lightest tier — basically just "use HTTPS and host nothing
 * sensitive"). Document for the auditor.
 */
import crypto from 'crypto';
import type {
  OnRampProvider, OnRampQuote, OnRampQuoteRequest,
  OnRampConfirmRequest, OnRampConfirmResult, OnRampWebhookEvent,
} from './index';

const STRIPE_API = 'https://api.stripe.com/v1';

function authHeader(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error('STRIPE_SECRET_KEY not configured');
  return `Basic ${Buffer.from(`${k}:`).toString('base64')}`;
}

/**
 * Verify a Stripe webhook signature exactly as `stripe-node` does,
 * without pulling in the SDK. Constant-time compare to defeat
 * timing attacks. Signature format reference:
 *   https://docs.stripe.com/webhooks#verify-manually
 */
export function verifyStripeSignature(rawBody: string, header: string | undefined, secret: string, toleranceSec = 300): true {
  if (!header) throw Object.assign(new Error('Missing stripe-signature header'), { statusCode: 400 });
  const pairs = Object.fromEntries(
    header.split(',').map((p) => p.split('=') as [string, string]),
  );
  const ts = parseInt(pairs.t, 10);
  const sig = pairs.v1;
  if (!ts || !sig) throw Object.assign(new Error('Malformed stripe-signature'), { statusCode: 400 });
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) {
    throw Object.assign(new Error('Webhook timestamp outside tolerance'), { statusCode: 400 });
  }
  const payload = `${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw Object.assign(new Error('Bad webhook signature'), { statusCode: 400 });
  }
  return true;
}

export class StripeOnRamp implements OnRampProvider {
  readonly name = 'STRIPE' as const;

  async quote(req: OnRampQuoteRequest): Promise<OnRampQuote> {
    // For fiat→crypto onramp Stripe charges card. Card fees are
    // 2.9% + $0.30 for US cards, higher for international. We quote
    // the conservative number; actual settlement comes from the
    // webhook event amount.
    const feeAmount = req.fiatAmount * 0.029 + 0.30;
    // Settlement rate is the platform's own quote engine result —
    // we just *charge fiat* via Stripe; crypto settlement happens
    // off-Stripe via priceEngine. For an MVP this means: lock the
    // platform's mid-market rate at quote time.
    const ratesVsUSD: Record<string, number> = {
      USD: 1, EUR: 1.08, GBP: 1.25, AED: 0.27, SAR: 0.27, EGP: 0.020, LYD: 0.21,
      USDT: 1, BTC: 65000, ETH: 3200, SOL: 150,
    };
    const fiatUsd = (ratesVsUSD[req.fiatCurrency] ?? 1) * req.fiatAmount;
    const cryptoUsd = ratesVsUSD[req.cryptoCurrency] ?? 1;
    const cryptoAmount = (fiatUsd - feeAmount * (ratesVsUSD[req.fiatCurrency] ?? 1)) / cryptoUsd;

    return {
      providerRef: `stripe_q_${crypto.randomUUID()}`,
      exchangeRate: cryptoUsd / (ratesVsUSD[req.fiatCurrency] ?? 1),
      cryptoAmount: Math.max(0, cryptoAmount),
      feeAmount,
      feeCurrency: req.fiatCurrency,
      expiresAt: new Date(Date.now() + 60_000),
    };
  }

  async confirm(req: OnRampConfirmRequest): Promise<OnRampConfirmResult> {
    // For Stripe, "confirm" means: create the PaymentIntent and hand
    // the client_secret back to the app. The app finalises the charge
    // via PaymentSheet/Elements client-side.
    //
    // The caller must pass the *fiat amount in cents* and *currency*
    // through OnRampConfirmRequest.paymentToken — we re-use that
    // field as JSON to keep the interface stable.
    if (!req.paymentToken) throw new Error('Missing paymentToken (expected JSON: { amountCents, currency, idempotencyKey })');
    const { amountCents, currency, idempotencyKey } = JSON.parse(req.paymentToken) as {
      amountCents: number; currency: string; idempotencyKey?: string;
    };
    if (!Number.isInteger(amountCents) || amountCents <= 50) {
      throw new Error('amountCents must be an integer > 50');
    }

    const body = new URLSearchParams({
      amount: String(amountCents),
      currency: currency.toLowerCase(),
      'automatic_payment_methods[enabled]': 'true',
      'metadata[providerRef]': req.providerRef,
    }).toString();

    const res = await fetch(`${STRIPE_API}/payment_intents`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body,
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Stripe PaymentIntent failed: ${res.status} ${errText.slice(0, 200)}`);
    }
    const pi = await res.json() as { id: string; client_secret: string; status: string };

    return {
      providerRef: pi.id,
      status: 'PENDING',
      // We tunnel the client_secret in redirectUrl so the existing
      // OnRampConfirmResult shape stays valid. The mobile app keys
      // off "stripe:" prefix to know to invoke PaymentSheet.
      redirectUrl: `stripe:client_secret=${encodeURIComponent(pi.client_secret)}`,
    };
  }

  async parseWebhook(headers: Record<string, string>, rawBody: string): Promise<OnRampWebhookEvent> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    verifyStripeSignature(rawBody, headers['stripe-signature'], secret);

    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      data: { object: { id: string; status?: string; metadata?: Record<string, string> } };
    };
    const pi = event.data.object;
    const providerRef = pi.id;

    let status: OnRampWebhookEvent['status'] = 'PROCESSING';
    switch (event.type) {
      case 'payment_intent.succeeded':            status = 'COMPLETED'; break;
      case 'payment_intent.payment_failed':       status = 'FAILED';    break;
      case 'payment_intent.canceled':             status = 'CANCELLED'; break;
      case 'payment_intent.processing':           status = 'PROCESSING'; break;
      case 'charge.refunded':                     status = 'REFUNDED';  break;
      default:                                    status = 'PROCESSING';
    }
    return { providerRef, status, raw: event };
  }
}
