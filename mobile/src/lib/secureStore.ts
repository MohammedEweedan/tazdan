/**
 * Wrapper around expo-secure-store with a graceful web fallback (localStorage).
 * Tokens are stored encrypted on device — never log or expose them.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const secureStore = {
  async get(key: string): Promise<string | null> {
    if (isWeb) {
      try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (isWeb) {
      try { globalThis.localStorage?.setItem(key, value); } catch { /* noop */ }
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async remove(key: string): Promise<void> {
    if (isWeb) {
      try { globalThis.localStorage?.removeItem(key); } catch { /* noop */ }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
