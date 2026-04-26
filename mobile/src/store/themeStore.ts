/**
 * Theme store. Two modes per the design brief: fully black or fully white.
 * Persists choice to AsyncStorage so it survives reloads.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const KEY = 'promrkts.theme';

export interface Palette {
  bg:        string;   // surface
  bgElev:    string;   // elevated card surface (translucent on dark, gray on light)
  fg:        string;   // primary text
  fgMuted:   string;
  fgFaint:   string;
  border:    string;
  ctaBg:     string;   // primary CTA fill
  ctaFg:     string;   // primary CTA label
  pillBg:    string;   // secondary pill (action buttons)
  greenFg:   string;
  greenBg:   string;
  redFg:     string;
}

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    bg:      '#000000',
    bgElev:  'rgba(255,255,255,0.04)',
    fg:      '#ffffff',
    fgMuted: 'rgba(255,255,255,0.55)',
    fgFaint: 'rgba(255,255,255,0.32)',
    border:  'rgba(255,255,255,0.08)',
    ctaBg:   '#ffffff',
    ctaFg:   '#000000',
    pillBg:  'rgba(255,255,255,0.08)',
    greenFg: '#22c55e',
    greenBg: 'rgba(34,197,94,0.18)',
    redFg:   '#ef4444',
  },
  light: {
    bg:      '#ffffff',
    bgElev:  '#f5f5f7',
    fg:      '#000000',
    fgMuted: 'rgba(0,0,0,0.60)',
    fgFaint: 'rgba(0,0,0,0.35)',
    border:  'rgba(0,0,0,0.08)',
    ctaBg:   '#000000',
    ctaFg:   '#ffffff',
    pillBg:  'rgba(0,0,0,0.06)',
    greenFg: '#15803d',
    greenBg: 'rgba(34,197,94,0.18)',
    redFg:   '#dc2626',
  },
};

interface ThemeState {
  mode: ThemeMode;
  palette: Palette;
  isHydrated: boolean;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  hydrate: () => Promise<void>;
}

export const useTheme = create<ThemeState>((set, get) => ({
  mode: 'dark',
  palette: palettes.dark,
  isHydrated: false,
  toggle: () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: next, palette: palettes[next] });
    AsyncStorage.setItem(KEY, next).catch(() => {});
  },
  setMode: (m) => {
    set({ mode: m, palette: palettes[m] });
    AsyncStorage.setItem(KEY, m).catch(() => {});
  },
  hydrate: async () => {
    try {
      const stored = (await AsyncStorage.getItem(KEY)) as ThemeMode | null;
      if (stored === 'light' || stored === 'dark') {
        set({ mode: stored, palette: palettes[stored] });
      }
    } catch { /* noop */ }
    set({ isHydrated: true });
  },
}));

/** Convenience hook — auto-hydrate on first use. */
export function useThemedPalette(): Palette {
  const { palette, hydrate, isHydrated } = useTheme();
  useEffect(() => { if (!isHydrated) hydrate(); }, [isHydrated, hydrate]);
  return palette;
}
