/**
 * Theme store. Two modes, but neither is "pure" — design intent:
 *  - Dark mode is a refined warm charcoal (not black) so OLED contrast
 *    doesn't punch your eyes out and card edges stay legible.
 *  - Light mode is a paper-off-white (not pure white) for the same
 *    reason in reverse — softens whites and lets neutrals breathe.
 *
 * Palette grows by elevation tier: bg < bgElev < bgRaised. Components
 * stacked above each other use the next tier so depth reads even
 * without shadows.
 *
 * Persists choice to AsyncStorage so it survives reloads.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const KEY = 'promrkts.theme';

export interface Palette {
  // ── Surfaces (elevation tiers) ──────────────────────────────────
  bg:        string;   // base — the screen itself
  bgElev:    string;   // cards / sheets
  bgRaised:  string;   // tooltips, popovers, hovered rows
  surface:   string;   // alias for bgElev (legacy)
  // ── Text ────────────────────────────────────────────────────────
  fg:        string;   // primary text
  fgMuted:   string;   // secondary
  fgFaint:   string;   // captions, placeholders
  // ── Lines ───────────────────────────────────────────────────────
  border:    string;   // standard 1px hairline
  divider:   string;   // 1px on bgElev (slightly stronger)
  // ── Primary call-to-action ──────────────────────────────────────
  ctaBg:     string;
  ctaFg:     string;
  // ── Secondary surface chip ──────────────────────────────────────
  pillBg:    string;
  // ── Semantic ────────────────────────────────────────────────────
  greenFg:   string;
  greenBg:   string;
  redFg:     string;
  redBg:     string;
  amberFg:   string;
  amberBg:   string;
  // ── Brand accent (used sparingly — focus rings, link, hot states)
  accent:    string;
  accentFg:  string;
  // ── Shadow color tuned to the surface so cards look planted, not
  //    glued — soft black on light, pure black on dark.
  shadow:    string;
}

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    // Surfaces — warm charcoal ramp. The "raised" tier shifts hue
    // slightly cooler so depth is perceptible without harsh edges.
    bg:        '#141518',
    bgElev:    '#1c1d22',
    bgRaised:  '#24262d',
    surface:   '#1c1d22',
    // Text — soft white, never pure. Easier on eyes for long sessions.
    fg:        '#f5f5f7',
    fgMuted:   'rgba(245,245,247,0.62)',
    fgFaint:   'rgba(245,245,247,0.36)',
    // Lines
    border:    'rgba(255,255,255,0.08)',
    divider:   'rgba(255,255,255,0.12)',
    // CTA — inverted, but slightly off-white so it doesn't glow
    ctaBg:     '#f5f5f7',
    ctaFg:     '#141518',
    pillBg:    'rgba(255,255,255,0.08)',
    // Semantic — desaturated greens/reds against warm bg
    greenFg:   '#4ade80',
    greenBg:   'rgba(74,222,128,0.16)',
    redFg:     '#f87171',
    redBg:     'rgba(248,113,113,0.16)',
    amberFg:   '#fbbf24',
    amberBg:   'rgba(251,191,36,0.16)',
    // Accent — promrkts brand blue, lifted for dark use
    accent:    '#4A8FE0',
    accentFg:  '#ffffff',
    // Shadow — deep cold black; on warm chrome it reads as "lifted"
    shadow:    'rgba(0,0,0,0.45)',
  },
  light: {
    // Paper off-white ramp. Cards step DOWN from the page so they
    // read as recessed surfaces (Apple-style), not floating tiles.
    bg:        '#f5f4f0',
    bgElev:    '#fbfaf6',
    bgRaised:  '#ffffff',
    surface:   '#fbfaf6',
    // Text — never pure black; reads as ink, not stamp.
    fg:        '#1a1a1f',
    fgMuted:   'rgba(26,26,31,0.62)',
    fgFaint:   'rgba(26,26,31,0.38)',
    // Lines
    border:    'rgba(26,26,31,0.10)',
    divider:   'rgba(26,26,31,0.14)',
    // CTA
    ctaBg:     '#1a1a1f',
    ctaFg:     '#fbfaf6',
    pillBg:    'rgba(26,26,31,0.06)',
    // Semantic — saturated for light bg
    greenFg:   '#15803d',
    greenBg:   'rgba(21,128,61,0.10)',
    redFg:     '#dc2626',
    redBg:     'rgba(220,38,38,0.10)',
    amberFg:   '#b45309',
    amberBg:   'rgba(180,83,9,0.10)',
    // Accent
    accent:    '#0057B8',
    accentFg:  '#ffffff',
    // Shadow — warm grey, low opacity
    shadow:    'rgba(26,26,31,0.10)',
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

/**
 * Standard elevation shadows that adapt to the active palette. Use
 * via `style={[..., elevation(p, 'sm')]}` — keeps shadow color in
 * sync with the theme so dark-mode shadows don't show up as gray
 * fuzz on a warm background.
 */
export function elevation(p: Palette, level: 'sm' | 'md' | 'lg' = 'md') {
  const base = {
    shadowColor: p.shadow,
    shadowOffset: { width: 0, height: level === 'sm' ? 2 : level === 'md' ? 8 : 18 },
    shadowOpacity: 1,             // opacity already in p.shadow rgba
    shadowRadius: level === 'sm' ? 6 : level === 'md' ? 18 : 32,
    elevation: level === 'sm' ? 2 : level === 'md' ? 6 : 12,
  } as const;
  return base;
}
