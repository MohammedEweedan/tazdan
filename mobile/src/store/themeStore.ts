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

export type ThemeMode = 'dark' | 'light' | 'mono';

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
  // ── Brand accent (soft pantone blue — used sparingly: focus rings,
  //    links, selected states, the active tab. NEVER on primary CTAs in
  //    dark/light; those stay neutral. In `mono` these collapse to grey.)
  accent:       string;   // chip fill / selected surface (the soft blue)
  accentFg:     string;   // text/icon sitting ON the accent fill
  accentSoft:   string;   // translucent blue wash for selected backgrounds
  accentBorder: string;   // translucent blue hairline for selected outlines
  accentText:   string;   // contrast-tuned blue for text/icons on the page bg
  // ── Shadow color tuned to the surface so cards look planted, not
  //    glued — soft black on light, pure black on dark.
  shadow:    string;
}

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    // Warm charcoal ramp — NOT pitch black. Pure black (#0A0A0B) punished
    // the eyes and made card edges vanish; this lifts the base to a soft
    // charcoal with a faint cool tilt that pairs with the brand blue, and
    // steps each elevation tier up so depth reads cleanly.
    bg:        '#16181C',   // base — soft charcoal (was near-black #0A0A0B)
    bgElev:    '#1E2127',   // cards / sheets
    bgRaised:  '#262A31',   // popovers / hovered rows
    surface:   '#1E2127',
    fg:        '#F4F5F7',
    fgMuted:   '#AEB6C3',
    fgFaint:   '#8C96A6',
    border:    'rgba(255,255,255,0.09)',
    divider:   'rgba(255,255,255,0.15)',
    // CTA — bright near-white inverse so primary actions read as urgent
    ctaBg:     '#F4F5F7',
    ctaFg:     '#16181C',
    pillBg:    'rgba(255,255,255,0.07)',
    // Semantic — kept (accessibility signals for confirm/decline/warn)
    greenFg:   '#3FCF8E',
    greenBg:   'rgba(63,207,142,0.14)',
    redFg:     '#F87171',
    redBg:     'rgba(248,113,113,0.14)',
    amberFg:   '#FBBF24',
    amberBg:   'rgba(251,191,36,0.14)',
    // Brand accent — soft pantone blue (#63a1db). Reads calm on the dark
    // charcoal bg. `accentText` is lifted to #7DB4E4 so small blue text /
    // icons clear AA contrast on the charcoal surface.
    accent:       '#63A1DB',
    accentFg:     '#16181C',
    accentSoft:   'rgba(99,161,219,0.16)',
    accentBorder: 'rgba(99,161,219,0.42)',
    accentText:   '#8BBCE8',
    shadow:    'rgba(0,0,0,0.5)',
  },
  light: {
    // Paper off-white, cards step UP from page
    bg:        '#F6F7FA',
    bgElev:    '#FFFFFF',
    bgRaised:  '#EEF1F6',
    surface:   '#FFFFFF',
    fg:        '#0A0A0B',
    fgMuted:   '#586579',
    fgFaint:   '#697589',
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
    // Brand accent — the blue, slightly deepened to #4F8BC4 so the chip
    // fill holds its own against the paper-white bg. `accentText` darkens
    // further (#3E78AE) so links/labels clear AA on the off-white page.
    accent:       '#4F8BC4',
    accentFg:     '#FFFFFF',
    accentSoft:   'rgba(79,139,196,0.12)',
    accentBorder: 'rgba(79,139,196,0.38)',
    accentText:   '#3E78AE',
    shadow:    'rgba(10,10,11,0.10)',
  },
  // Monochrome — greyscale only. Softened off the old pitch-black so it's
  // easier on the eyes: the base is a deep charcoal rather than #000, cards
  // sit a touch above it, and the foreground is a near-white (not glaring
  // pure white). Semantic up/down signals still collapse to greyscale.
  mono: {
    // Soft charcoal base — eases eye strain vs. pure black, with cards a
    // step above so elevation reads without harsh OLED contrast.
    bg:        '#0C0C0D',
    bgElev:    '#161617',
    bgRaised:  '#1E1E20',
    surface:   '#161617',
    fg:        '#F5F5F5',                  // near-white, less glare than #FFF
    fgMuted:   '#B3B3B8',
    fgFaint:   '#94949C',
    border:    'rgba(255,255,255,0.12)',
    divider:   'rgba(255,255,255,0.18)',
    ctaBg:     '#F5F5F5',
    ctaFg:     '#0C0C0D',
    pillBg:    'rgba(255,255,255,0.09)',
    // Semantic → greyscale. Positive reads bright/white, negative reads dim grey.
    greenFg:   '#F5F5F5',
    greenBg:   'rgba(245,245,245,0.12)',
    redFg:     'rgba(245,245,245,0.55)',
    redBg:     'rgba(245,245,245,0.06)',
    amberFg:   'rgba(245,245,245,0.80)',
    amberBg:   'rgba(245,245,245,0.08)',
    // Mono stays pure grayscale by design — the blue accent tokens collapse
    // to the existing greyscale ramp so a `mono` user sees zero colour.
    accent:       '#F5F5F5',
    accentFg:     '#0C0C0D',
    accentSoft:   'rgba(255,255,255,0.09)',
    accentBorder: 'rgba(255,255,255,0.18)',
    accentText:   '#F5F5F5',
    shadow:    'rgba(0,0,0,0.7)',
  },
};

/** True when the active theme is the pure-monochrome variant. Components that
 *  pull in external colour (coin avatars, chart strokes) should desaturate. */
export function isMonochrome(mode: ThemeMode): boolean {
  return mode === 'mono';
}

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
    // Cycle dark → light → mono → dark.
    const order: ThemeMode[] = ['dark', 'light', 'mono'];
    const next = order[(order.indexOf(get().mode) + 1) % order.length];
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
      if (stored === 'light' || stored === 'dark' || stored === 'mono') {
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
