/**
 * Expo push notification registration.
 *
 * Call `registerPushToken()` after a successful login to store the
 * device's Expo push token on the server. The server uses it to send
 * deposit confirmations, withdrawal alerts, P2P trade updates, and
 * KYC status changes.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
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
      name: 'fortuni',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#7B5CF0',
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
