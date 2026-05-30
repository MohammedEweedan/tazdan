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

const KEY = 'tazdan.theme';

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
    // Monochrome graphite ramp — pure grayscale, no blue undertone.
    // Step-up tiers stay legible even without color contrast cues.
    bg:        '#0A0A0B',
    bgElev:    '#141416',
    bgRaised:  '#1C1C1F',
    surface:   '#141416',
    fg:        '#FAFAFA',
    fgMuted:   'rgba(250,250,250,0.62)',
    fgFaint:   'rgba(250,250,250,0.36)',
    border:    'rgba(255,255,255,0.08)',
    divider:   'rgba(255,255,255,0.14)',
    // CTA — pure white inverse so primary actions read as urgent without color
    ctaBg:     '#FAFAFA',
    ctaFg:     '#0A0A0B',
    pillBg:    'rgba(255,255,255,0.08)',
    // Semantic — kept (accessibility signals for confirm/decline/warn)
    greenFg:   '#3FCF8E',
    greenBg:   'rgba(63,207,142,0.14)',
    redFg:     '#F87171',
    redBg:     'rgba(248,113,113,0.14)',
    amberFg:   '#FBBF24',
    amberBg:   'rgba(251,191,36,0.14)',
    // Accent is the same off-white as CTA in mono mode — no brand color
    accent:    '#FAFAFA',
    accentFg:  '#0A0A0B',
    shadow:    'rgba(0,0,0,0.55)',
  },
  light: {
    // Paper off-white, cards step UP from page
    bg:        '#FAFAF7',
    bgElev:    '#F1F0EB',
    bgRaised:  '#FFFFFF',
    surface:   '#F1F0EB',
    fg:        '#0A0A0B',
    fgMuted:   'rgba(10,10,11,0.62)',
    fgFaint:   'rgba(10,10,11,0.38)',
    border:    'rgba(10,10,11,0.08)',
    divider:   'rgba(10,10,11,0.14)',
    // CTA — solid black for maximum mono contrast
    ctaBg:     '#0A0A0B',
    ctaFg:     '#FAFAFA',
    pillBg:    'rgba(10,10,11,0.06)',
    greenFg:   '#1F8F58',
    greenBg:   'rgba(31,143,88,0.10)',
    redFg:     '#C0272D',
    redBg:     'rgba(192,39,45,0.10)',
    amberFg:   '#A26B0B',
    amberBg:   'rgba(162,107,11,0.10)',
    // Accent — also black; mono mode has no separate brand color
    accent:    '#0A0A0B',
    accentFg:  '#FAFAFA',
    shadow:    'rgba(10,10,11,0.10)',
  },
};

/**
 * Legacy `brand` token export — kept so existing imports compile. All
 * fields now resolve to monochrome (white in dark contexts, black in
 * light contexts). Migrate call-sites to read from the active palette
 * (`useThemedPalette().accent`) then delete this block.
 */
export const brand = {
  primary:     '#0A0A0B',   // black on light surfaces
  primaryDark: '#FAFAFA',   // white on dark surfaces
  deep:        '#0A0A0B',   // pressed / hover
  softLight:   'rgba(10,10,11,0.08)',
  softDark:    'rgba(255,255,255,0.08)',
  sand:        '#E8DDC7',
  sandDeep:    '#C7B894',
} as const;

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
