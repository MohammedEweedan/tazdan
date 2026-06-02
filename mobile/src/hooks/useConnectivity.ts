/**
 * Connectivity hook — single source of truth for "are we online?".
 *
 * Wraps `@react-native-community/netinfo`, but does so DEFENSIVELY: that package
 * has a native module (`RNCNetInfo`) that only exists after a native rebuild
 * (dev client / EAS build). In Expo Go or before a rebuild the native module is
 * null and importing it eagerly would throw at module-load time and take down
 * the whole app (white screen, "No QueryClient set", etc.). So we:
 *   - require it lazily inside a try/catch, and
 *   - if it's unavailable, treat the user as ONLINE (never block the app).
 *
 * Offline is only declared when NetInfo is present AND confident there's no
 * usable connection — so a healthy network never flashes the disconnected
 * screen, and a missing native module never bricks the app.
 */
import { useEffect, useState } from 'react';

// Lazy, crash-proof access to the native module.
type NetInfoState = { isConnected: boolean | null; isInternetReachable: boolean | null };
type NetInfoModule = {
  fetch: () => Promise<NetInfoState>;
  refresh: () => Promise<NetInfoState>;
  addEventListener: (cb: (s: NetInfoState) => void) => () => void;
};

function loadNetInfo(): NetInfoModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-community/netinfo');
    const NetInfo = mod?.default ?? mod;
    // Touch a method to confirm the native module is actually linked.
    if (NetInfo && typeof NetInfo.addEventListener === 'function') return NetInfo as NetInfoModule;
    return null;
  } catch {
    return null;
  }
}

function deriveOnline(state: NetInfoState | null): boolean {
  if (!state) return true; // unknown → assume online (no false alarms)
  if (state.isConnected === false && state.isInternetReachable !== true) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

export function useConnectivity(): { isOnline: boolean; refresh: () => Promise<void> } {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const NetInfo = loadNetInfo();
    if (!NetInfo) return; // native module not linked yet — stay "online", never crash

    let mounted = true;
    NetInfo.fetch().then((s) => { if (mounted) setIsOnline(deriveOnline(s)); }).catch(() => {});
    const unsub = NetInfo.addEventListener((s) => { if (mounted) setIsOnline(deriveOnline(s)); });
    return () => { mounted = false; try { unsub(); } catch { /* noop */ } };
  }, []);

  const refresh = async () => {
    const NetInfo = loadNetInfo();
    if (!NetInfo) return;
    try { setIsOnline(deriveOnline(await NetInfo.refresh())); } catch { /* keep last state */ }
  };

  return { isOnline, refresh };
}
