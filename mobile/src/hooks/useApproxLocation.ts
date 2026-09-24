/**
 * Approximate location for "near me" P2P discovery.
 *
 *  - Asks for permission only when the user turns the feature on, never on
 *    screen open.
 *  - Coordinates are rounded to 2 decimals (~1 km) before they leave this
 *    module, kept in memory only (never persisted), and dropped on sign-out.
 *  - The native module is loaded lazily so an older dev build without
 *    expo-location reports "unavailable" instead of crashing.
 */
import { create } from 'zustand';
import { Linking } from 'react-native';
import { useAuthStore } from '@/store/authStore';

export interface ApproxCoords { lat: number; lng: number }
export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

interface LocationState {
  status: LocationStatus;
  coords: ApproxCoords | null;
  /** False once the OS will no longer show the prompt — send people to Settings. */
  canAskAgain: boolean;
  request: () => Promise<ApproxCoords | null>;
  clear: () => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Reuse a fix this recent instead of waking the GPS again. */
const MAX_AGE_MS = 10 * 60_000;

function loadModule(): typeof import('expo-location') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-location');
  } catch {
    return null;
  }
}

export const useApproxLocation = create<LocationState>((set, get) => ({
  status: 'idle',
  coords: null,
  canAskAgain: true,

  request: async () => {
    const Location = loadModule();
    if (!Location) { set({ status: 'unavailable' }); return null; }
    set({ status: 'locating' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        set({ status: 'denied', canAskAgain: perm.canAskAgain });
        return null;
      }
      const pos = (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS }))
        ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      const coords = { lat: round2(pos.coords.latitude), lng: round2(pos.coords.longitude) };
      set({ status: 'granted', coords, canAskAgain: true });
      return coords;
    } catch {
      // Services off, timeout, or no fix — treat as unavailable for now.
      set({ status: get().coords ? 'granted' : 'unavailable' });
      return get().coords;
    }
  },

  clear: () => set({ status: 'idle', coords: null }),
}));

export const openLocationSettings = () => { Linking.openSettings().catch(() => {}); };

// Forget the position when the session ends.
useAuthStore.subscribe((s, prev) => {
  if (prev.isAuthenticated && !s.isAuthenticated) useApproxLocation.getState().clear();
});
