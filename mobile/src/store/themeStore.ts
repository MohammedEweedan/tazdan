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

const KEY = 'fortuni.theme';

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
    // Warm charcoal ramp — kept from your draft, refined slightly
    bg:        '#141518',
    bgElev:    '#1C1D22',
    bgRaised:  '#24262D',
    surface:   '#1C1D22',
    fg:        '#F5F5F7',
    fgMuted:   'rgba(245,245,247,0.62)',
    fgFaint:   'rgba(245,245,247,0.36)',
    border:    'rgba(255,255,255,0.08)',
    divider:   'rgba(255,255,255,0.12)',
    // CTA — invert to off-white so it doesn't glow
    ctaBg:     '#F5F5F7',
    ctaFg:     '#141518',
    pillBg:    'rgba(255,255,255,0.08)',
    // Semantic — bright on warm charcoal, AA on bg
    greenFg:   '#4ADE80',
    greenBg:   'rgba(74,222,128,0.16)',
    redFg:     '#F87171',
    redBg:     'rgba(248,113,113,0.16)',
    amberFg:   '#FBBF24',
    amberBg:   'rgba(251,191,36,0.16)',
    // Brand — lifted periwinkle, AA on #141518
    accent:    '#5b8cff',
    accentFg:  '#0A0D1A',
    shadow:    'rgba(0,0,0,0.45)',
  },
  light: {
    // Paper off-white, cards step UP from page (more standard than recessed)
    bg:        '#F5F4F0',
    bgElev:    '#FBFAF6',
    bgRaised:  '#FFFFFF',
    surface:   '#FBFAF6',
    fg:        '#1A1A1F',
    fgMuted:   'rgba(26,26,31,0.62)',
    fgFaint:   'rgba(26,26,31,0.38)',
    border:    'rgba(26,26,31,0.10)',
    divider:   'rgba(26,26,31,0.14)',
    ctaBg:     '#1A1A1F',
    ctaFg:     '#FBFAF6',
    pillBg:    'rgba(26,26,31,0.06)',
    greenFg:   '#15803D',
    greenBg:   'rgba(21,128,61,0.10)',
    redFg:     '#DC2626',
    redBg:     'rgba(220,38,38,0.10)',
    amberFg:   '#B45309',
    amberBg:   'rgba(180,83,9,0.10)',
    // Brand — periwinkle, AAA on paper
    accent:    '#226dff',
    accentFg:  '#FFFFFF',
    shadow:    'rgba(26,26,31,0.10)',
  },
};

export const brand = {
  primary:     '#226dff',   // use on light surfaces — periwinkle
  primaryDark: '#5b8cff',   // use on dark surfaces
  deep:        '#1a52cc',   // pressed / hover
  softLight:   '#dde7ff',   // chip bg on light
  softDark:    'rgba(34,109,255,0.14)',  // chip bg on dark
  sand:        '#E8DDC7',   // warm secondary, MENA accent
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
