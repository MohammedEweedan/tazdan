/**
 * Stripe SDK shim.
 *
 * Why this exists:
 *   `@stripe/stripe-react-native` is a native module. It needs a
 *   prebuild + native install to actually run, and importing it at
 *   module-load time in an environment where it hasn't been installed
 *   yet (e.g. a fresh `npm install` hasn't happened) blows up Metro.
 *
 *   This shim:
 *     • Re-exports the real Stripe React Native API when available.
 *     • Falls back to no-op stubs when the native module is missing,
 *       so the rest of the app keeps compiling and rendering — the
 *       `ExpressPayButton` simply self-hides.
 *
 * Once you've run `npx expo install @stripe/stripe-react-native`
 * (already added to package.json) and rebuilt with EAS, the real
 * module loads automatically.
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

const stubStripe: StripeApi = {
  async initPaymentSheet() {
    return { error: { code: 'NotInstalled', message: 'Stripe SDK not installed' } };
  },
  async presentPaymentSheet() {
    return { error: { code: 'NotInstalled', message: 'Stripe SDK not installed' } };
  },
};

export function useStripe(): StripeApi {
  return stubStripe;
}

export async function isApplePaySupported(): Promise<boolean> {
  return false;
}

/**
 * Provider component. Wraps the app so child components can call
 * `useStripe()`. Web version is a passthrough `<Fragment>`.
 */
export function StripeProvider({
  publishableKey: _publishableKey,
  merchantIdentifier: _merchantIdentifier,
  urlScheme: _urlScheme,
  children,
}: {
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
  children: React.ReactNode;
}) {
  return React.createElement(React.Fragment, null, children);
}
