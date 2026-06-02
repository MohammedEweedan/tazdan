/**
 * Expo push notification registration + tap-deep-link routing.
 *
 * Call `registerPushToken()` after a successful login to store the
 * device's Expo push token on the server. The server uses it to send
 * transactional confirmations (buy/sell/swap/send/receive/deposit/
 * withdrawal), P2P trade updates, and KYC status changes.
 *
 * Mount `usePushDeepLink()` once in the root layout — it subscribes
 * to taps on push banners and routes to the correct in-app screen.
 */
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return; // simulators can't receive push

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'tazdan',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFFFFF',
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;

  try {
    await api.post('/notifications/register-token', { token });
  } catch {
    // Non-fatal — the app works without push; retry on next login
  }
}

export async function unregisterPushToken(): Promise<void> {
  try {
    await api.delete('/notifications/register-token');
  } catch {
    // Non-fatal
  }
}

/**
 * Routes a push notification's data payload to the correct in-app
 * screen. Called from both the cold-start (last response) and warm-tap
 * (live listener) code paths. Safe to call repeatedly — routes are
 * idempotent and Expo Router de-dupes navigation to the same target.
 */
function routeFromPayload(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const d = data as Record<string, unknown>;
  const kind = typeof d.kind === 'string' ? d.kind : (typeof d.type === 'string' ? d.type : '');
  const id   = typeof d.id   === 'string' ? d.id   : (typeof d.tradeId === 'string' ? d.tradeId : '');

  // Defer routing one tick so Expo Router has its layout mounted (cold
  // start). Same call works fine warm — `router.push` from inside the
  // first frame is also fine.
  setTimeout(() => {
    try {
      switch (kind) {
        case 'tx':
          if (id) router.push(`/history/${id}` as any);
          else    router.push('/history' as any);
          break;
        case 'deposit_confirmed':
          router.push('/(tabs)/wallet' as any);
          break;
        case 'withdrawal_sent':
          router.push('/history' as any);
          break;
        case 'p2p_trade':
          if (id) router.push(`/chat/${id}` as any);
          else    router.push('/(tabs)/p2p' as any);
          break;
        case 'kyc_update':
          router.push('/kyc' as any);
          break;
        default:
          // Unknown — open notifications screen so the user sees context.
          router.push('/notifications' as any);
      }
    } catch {
      // Routing during early boot can throw if Expo Router isn't ready;
      // a silent failure is correct — the notification is still in the
      // tray for the user to revisit.
    }
  }, 0);
}

/**
 * Hook to mount once in the app root. Wires up:
 *  • Cold-start: if the app was launched by a push tap, routes from
 *    the last response payload immediately.
 *  • Warm-tap:    subscribes for the duration of the app session.
 */
export function usePushDeepLink(): void {
  useEffect(() => {
    let cancelled = false;

    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (cancelled || !resp) return;
      routeFromPayload(resp.notification.request.content.data);
    }).catch(() => { /* noop */ });

    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      routeFromPayload(resp.notification.request.content.data);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
