/**
 * ExpressPayButton — Apple Pay on iOS, Google Pay on Android, hidden on
 * web/unsupported platforms.
 *
 * Flow:
 *  1. Caller passes amount + currency.
 *  2. We hit `/api/deposits/gateway/quote` and `/api/deposits/gateway/confirm`
 *     to get a Stripe PaymentIntent client_secret (server already wired).
 *  3. We initialise Stripe's PaymentSheet with Apple/Google Pay enabled
 *     and present it. Stripe handles the native sheet.
 *  4. On success, the server's Stripe webhook credits the user wallet.
 *     We just notify the caller so they can refresh UI state.
 *
 * If `STRIPE.publishableKey` is missing, the button hides itself — the
 * regular "Pay with card" flow remains untouched.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useStripe, isApplePaySupported, type PlatformPay } from '@/lib/stripeShim';
import { depositService } from '@/services';
import { STRIPE } from '@/constants';

interface Props {
  /** Fiat amount, e.g. 50.00 */
  amount: number;
  /** ISO currency code, e.g. USD */
  currency: string;
  /** Optional crypto destination (defaults to USDT for direct top-up). */
  cryptoCurrency?: string;
  /** Enable/disable the button (e.g. while a quote is still loading). */
  enabled?: boolean;
  /** Override button label. Defaults to "Apple Pay"/"Google Pay". */
  label?: string;
  /** Called when the Apple/Google Pay sheet completes successfully. */
  onSuccess?: () => void;
  /** Called when the sheet errors out. */
  onError?: (message: string) => void;
}

export function ExpressPayButton({
  amount, currency, cryptoCurrency = 'USDT',
  enabled = true, label, onSuccess, onError,
}: Props) {
  const stripe = useStripe();
  const [available, setAvailable] = useState(Platform.OS === 'android');
  const [busy, setBusy] = useState(false);

  const platformName = Platform.OS === 'ios' ? 'Apple Pay' : Platform.OS === 'android' ? 'Google Pay' : null;

  // Probe Apple Pay availability on iOS (Android always reports true if Play Services present)
  useEffect(() => {
    let mounted = true;
    if (Platform.OS === 'ios') {
      isApplePaySupported().then((ok) => { if (mounted) setAvailable(ok); }).catch(() => {});
    }
    return () => { mounted = false; };
  }, []);

  const onPress = useCallback(async () => {
    if (!stripe || busy || amount <= 0) return;
    setBusy(true);
    Haptics.selectionAsync();
    try {
      // 1. Get a quote so the server can pre-create the on-ramp txn record
      const { quote } = await depositService.gatewayQuote({
        fiatCurrency: currency,
        fiatAmount: amount,
        cryptoCurrency,
        paymentMethod: 'CARD',
      });

      // 2. Confirm → server creates PaymentIntent, returns client_secret
      //    (server tunnels it as `redirectUrl: stripe:client_secret=...`)
      const confirm = await depositService.gatewayConfirm({
        providerRef: quote.providerRef,
        fiatCurrency: currency,
        fiatAmount: amount,
        cryptoCurrency,
        idempotencyKey: `pay_${Date.now()}`,
      });

      const m = /stripe:client_secret=([^&]+)/.exec(confirm.redirectUrl ?? '');
      const clientSecret = m ? decodeURIComponent(m[1]) : null;
      if (!clientSecret) throw new Error('No client_secret returned from server');

      // 3. Initialise PaymentSheet with platform pay enabled
      const init = await stripe.initPaymentSheet({
        merchantDisplayName: STRIPE.merchantDisplayName,
        paymentIntentClientSecret: clientSecret,
        applePay: { merchantCountryCode: STRIPE.merchantCountryCode },
        googlePay: {
          merchantCountryCode: STRIPE.merchantCountryCode,
          currencyCode: currency,
          testEnv: __DEV__,
        },
        // We want the native Apple/Google Pay sheet first, not a card form
        defaultBillingDetails: undefined,
      });
      if (init.error) throw new Error(init.error.message);

      // 4. Present the sheet
      const result = await stripe.presentPaymentSheet();
      if (result.error) {
        if (result.error.code === 'Canceled') return;
        throw new Error(result.error.message);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess?.();
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      onError?.(e?.message ?? 'Payment failed');
    } finally {
      setBusy(false);
    }
  }, [stripe, busy, amount, currency, cryptoCurrency, onSuccess, onError]);

  if (!platformName || !available || !STRIPE.publishableKey) return null;

  const isApple  = Platform.OS === 'ios';
  const bg       = isApple ? '#000000' : '#ffffff';
  const fg       = isApple ? '#ffffff' : '#202124';
  const display  = label ?? platformName;

  return (
    <Pressable
      onPress={onPress}
      disabled={!enabled || busy}
      style={({ pressed }) => ({
        alignSelf: 'stretch',
        width: '100%',
        height: 56,
        borderRadius: 28,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed || busy ? 0.85 : 1,
        borderWidth: isApple ? 0 : 1,
        borderColor: 'rgba(0,0,0,0.12)',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 4,
      })}
    >
      {busy
        ? <ActivityIndicator color={fg} />
        : (
          <>
            <Ionicons
              name={isApple ? 'logo-apple' : 'logo-google'}
              size={isApple ? 17 : 16}
              color={fg}
              style={{ marginTop: isApple ? -2 : 0 }}
            />
            <Text style={{ color: fg, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 }}>
              Pay with {display}
            </Text>
          </>
        )}
    </Pressable>
  );
}
