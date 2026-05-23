/**
 * Stripe SDK shim — native only.
 *
 * Metro picks this `.native.ts` file on iOS/Android; the plain
 * `.ts` sibling (web stubs) is used when bundling for web.
 */

import React from 'react';

type InitOpts = {
  merchantDisplayName: string;
  paymentIntentClientSecret: string;
  applePay?: { merchantCountryCode: string };
  googlePay?: { merchantCountryCode: string; currencyCode: string; testEnv?: boolean };
  defaultBillingDetails?: unknown;
};

type Result = { error?: { code?: string; message: string } };

interface StripeApi {
  initPaymentSheet(opts: InitOpts): Promise<Result>;
  presentPaymentSheet(): Promise<Result>;
}

export type PlatformPay = 'apple' | 'google';

let real: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  real = require('@stripe/stripe-react-native');
} catch {
  real = null;
}

const stubStripe: StripeApi = {
  async initPaymentSheet() {
    return { error: { code: 'NotInstalled', message: 'Stripe SDK not installed' } };
  },
  async presentPaymentSheet() {
    return { error: { code: 'NotInstalled', message: 'Stripe SDK not installed' } };
  },
};

export function useStripe(): StripeApi {
  if (real?.useStripe) return real.useStripe();
  return stubStripe;
}

export async function isApplePaySupported(): Promise<boolean> {
  if (!real) return false;
  try {
    if (typeof real.isPlatformPaySupported === 'function') {
      return await real.isPlatformPaySupported();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Provider component. Wraps the app so child components can call
 * `useStripe()`. Falls back to a passthrough `<Fragment>` when the
 * native module isn't installed.
 */
export function StripeProvider({
  publishableKey,
  merchantIdentifier,
  urlScheme,
  children,
}: {
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
  children: React.ReactNode;
}) {
  if (!real?.StripeProvider || !publishableKey) {
    return React.createElement(React.Fragment, null, children);
  }
  const Real = real.StripeProvider;
  return React.createElement(
    Real,
    { publishableKey, merchantIdentifier, urlScheme },
    children,
  );
}
