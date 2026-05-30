/**
 * Wrapper around expo-secure-store.
 *
 * On native (iOS / Android), tokens go into the OS keychain via
 * expo-secure-store with WHEN_UNLOCKED_THIS_DEVICE_ONLY — encrypted
 * at rest, not included in iCloud backups, requires unlocked device.
 *
 * On web, we use an IN-MEMORY map.  The previous implementation
 * persisted to `localStorage`, which is readable by any JavaScript
 * that runs on the origin — i.e. one reflected/stored XSS on the
 * web app meant the attacker exfiltrated the bearer + refresh token
 * and took over the account.  Memory-only means refreshing the web
 * tab logs the user out, which is the correct tradeoff for a fintech
 * (web sessions should be short).  When we ship a proper web app
 * with httpOnly + Secure + SameSite cookies, that flow replaces this
 * entirely.
 *
 * Tokens are sensitive — never log or expose them.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

// Module-scoped, per-tab memory store.  Survives in-tab navigation
// (the module is cached) but not page reloads or closing the tab —
// which is what we want.  Never persisted to disk.
const webMemoryStore = new Map<string, string>();

export const secureStore = {
  async get(key: string): Promise<string | null> {
    if (isWeb) {
      return webMemoryStore.get(key) ?? null;
    }
    return SecureStore.getItemAsync(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (isWeb) {
      webMemoryStore.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async remove(key: string): Promise<void> {
    if (isWeb) {
      webMemoryStore.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
