/**
 * tazdan design tokens — monochrome v1.
 *
 * The visual language is pure grayscale + status (red/green/amber) only.
 * No brand blue, no colored glow shadows, no rainbow card colorways. The
 * mono palette uses an accent that is the inverse of the surface: white in
 * dark mode, black in light mode, so CTAs always have maximum contrast.
 *
 * Mirrors the NativeWind config in `tailwind.config.js`. Use this file from
 * any non-NW context (e.g. LinearGradient `colors`, ShadowOffset).
 */

export const colors = {
  /* ── Monochrome surfaces (dark mode primary) ─────────────────────── */
  mono: {
    // Dark mode — soft charcoal (not pitch black) with a faint cool tilt
    bg:         '#16181C',
    bgElev:     '#1E2127',
    bgRaised:   '#262A31',
    line:       'rgba(255,255,255,0.08)',
    lineStrong: 'rgba(255,255,255,0.14)',
    fg:         '#FAFAFA',
    fgDim:      'rgba(250,250,250,0.72)',
    fgMuted:    'rgba(250,250,250,0.46)',
    fgFaint:    'rgba(250,250,250,0.28)',
    accent:     '#FFFFFF',  // CTA + slide fill in dark mode
    accentFg:   '#0A0A0B',  // text/icon on accent

    // Light mode mirror
    bgL:        '#FAFAF7',
    bgElevL:    '#F1F0EB',
    bgRaisedL:  '#FFFFFF',
    lineL:      'rgba(0,0,0,0.08)',
    lineStrongL:'rgba(0,0,0,0.14)',
    fgL:        '#0A0A0B',
    fgDimL:     'rgba(10,10,11,0.72)',
    fgMutedL:   'rgba(10,10,11,0.46)',
    fgFaintL:   'rgba(10,10,11,0.28)',
    accentL:    '#0A0A0B',  // black CTAs in light mode
    accentFgL:  '#FFFFFF',
  },

  /* ── Brand accent (soft pantone blue #63a1db) ───────────────────────
     Used sparingly as an accent — selected states, focus rings, links,
     the active tab. Not on primary CTAs. The `text` variants are
     contrast-tuned per surface so small blue text stays legible. */
  accent: {
    base:      '#63A1DB',          // dark-surface chip fill
    baseLight: '#4F8BC4',          // light-surface chip fill (deepened)
    text:      '#7DB4E4',          // blue text/icon on dark page bg (AA)
    textLight: '#3E78AE',          // blue text/icon on light page bg (AA)
    soft:      'rgba(99,161,219,0.14)',
    border:    'rgba(99,161,219,0.40)',
  },

  /* ── Status (kept — confirmed by user) ──────────────────────────── */
  status: {
    success:   '#2BB36F',
    successBg: 'rgba(43,179,111,0.14)',
    danger:    '#E5484D',
    dangerBg:  'rgba(229,72,77,0.14)',
    warning:   '#E8A33A',
    warningBg: 'rgba(232,163,58,0.14)',
  },

  /* ── Legacy aliases (delete once all imports updated) ───────────── */
  // These let existing components keep building during the sweep. Each
  // one points at its monochrome replacement so the visual is correct
  // immediately. Migrate call-sites to `colors.mono.*` then delete this
  // block.
  brand: {
    50:  '#F4F4F4',
    100: '#E5E5E5',
    200: '#D4D4D4',
    300: '#A3A3A3',
    400: '#737373',
    500: '#525252',
    600: '#404040',
    700: '#262626',
    800: '#171717',
    900: '#0A0A0B',
  },
  surface: {
    0:   '#000000',
    50:  '#0A0A0B',
    100: '#141416',
    200: '#1C1C1F',
    300: '#26262A',
    400: '#2F2F33',
    500: '#3A3A3F',
  },
  ink: {
    primary:   '#FAFAFA',
    secondary: 'rgba(250,250,250,0.72)',
    tertiary:  'rgba(250,250,250,0.46)',
    muted:     'rgba(250,250,250,0.28)',
  },
  semantic: {
    success: '#2BB36F',
    danger:  '#E5484D',
    warning: '#E8A33A',
  },
  line: 'rgba(255,255,255,0.08)',
} as const;

/**
 * Pre-built linear gradients. All monochrome — no color. The "brand"
 * gradient keys remain so existing imports compile, but they all resolve
 * to subtle grayscale ramps that read as luxury, not flashy.
 *
 *   <LinearGradient colors={gradients.brand} ... />
 */
export const gradients = {
  // Primary CTA / slide fill — solid accent (white in dark, black in light).
  // Kept as an array so LinearGradient consumers don't need to change shape.
  brand:        ['#FFFFFF', '#E5E5E5'],
  brandReverse: ['#E5E5E5', '#FFFFFF'],
  // Background sweep — three-stop charcoal ramp behind the app
  surface:      ['#16181C', '#1E2127', '#262A31'],
  // Card highlights — subtle inner sheen, white on translucent
  cardSheen:    ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.0)'],
  // Glass — semi-transparent for blur cards
  glass:        ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)'],
  // Soft brand-blue glow — a barely-there wash for hero / logo backdrops.
  // Top-stop is deliberately low-alpha so it reads as mist, never a fill.
  accentGlow:   ['rgba(99,161,219,0.16)', 'rgba(99,161,219,0)'],
  // Status fills (kept colored — these are accessibility signals)
  success:      ['#1F8F58', '#2BB36F'],
  danger:       ['#B7373B', '#E5484D'],
  // Card slider — monochrome colorways only. Each is a graphite-family ramp
  // that reads as a metal finish rather than as a colored material.
  cards: {
    sapphire:  ['#2A2A2D', '#0A0A0B'],   // graphite (was navy blue)
    obsidian:  ['#0A0A0B', '#1A1A1D'],   // pure black metal
    rose:      ['#3A3134', '#1A1416'],   // warm dark
    emerald:   ['#1F2624', '#0A0F0D'],   // cool dark
    platinum:  ['#5A5A5F', '#2A2A2F'],   // silver
  },
} as const;

export const radii = {
  none: 0,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const spacing = {
  0:  0,   1: 4,    2: 8,    3: 12,
  4:  16,  5: 20,   6: 24,   7: 28,
  8:  32,  10: 40,  12: 48,  14: 56,
  16: 64,  20: 80,  24: 96,
} as const;

/**
 * Font families:
 *   English / LTR → Outfit (geometric humanist, MENA-leaning proportions)
 *   Arabic  / RTL → IBM Plex Sans Arabic (same density + x-height as Outfit,
 *                   tabular numerals that align perfectly when language switches)
 *
 * Each token is a weight-specific font name matching the key passed to
 * useFonts() in _layout.tsx. In React Native you set `fontFamily` to the
 * exact registered name — you cannot use `fontWeight` to synthesise a bold
 * variant from a variable font; you must reference the correct weight file.
 *
 * Usage:
 *   // English text (LTR)
 *   style={{ fontFamily: F.display, fontSize: 22 }}
 *   // Arabic text (RTL) — same weight scale, different family
 *   style={{ fontFamily: FAR.display, fontSize: 22, writingDirection: 'rtl' }}
 */
export const F = {
  // Outfit weight map
  thin:      'Outfit_300Light',
  regular:   'Outfit_400Regular',
  medium:    'Outfit_500Medium',
  semibold:  'Outfit_600SemiBold',
  bold:      'Outfit_700Bold',
  extrabold: 'Outfit_800ExtraBold',
  black:     'Outfit_900Black',
} as const;

export const FAR = {
  // IBM Plex Sans Arabic weight map — same slots as F for easy swapping
  thin:      'IBMPlexSansArabic_300Light',
  regular:   'IBMPlexSansArabic_400Regular',
  medium:    'IBMPlexSansArabic_500Medium',
  semibold:  'IBMPlexSansArabic_600SemiBold',
  bold:      'IBMPlexSansArabic_700Bold',
  // IBM Plex tops at 700 — map heavier slots to bold
  extrabold: 'IBMPlexSansArabic_700Bold',
  black:     'IBMPlexSansArabic_700Bold',
} as const;

export const typography = {
  // Convenience triplets — fontFamily only; callers set fontSize themselves.
  // fontWeight is intentionally omitted: in RN you pick the weight via the
  // font file name, not the weight prop (which only affects system fonts).
  display: { fontFamily: F.extrabold },
  heading: { fontFamily: F.bold },
  body:    { fontFamily: F.medium },
  caption: { fontFamily: F.regular },
  mono:    { fontFamily: 'Menlo' },
} as const;

/**
 * Locale-aware font hook. Returns the correct family map (F or FAR)
 * based on the currently active language — call this instead of
 * importing F/FAR directly so Arabic users automatically get IBM Plex.
 *
 *   const fonts = useFonts();
 *   <Text style={{ fontFamily: fonts.bold, fontSize: 16 }}>…</Text>
 */
export function useFontFamily() {
  // Lazy import to avoid a circular dependency — i18nStore imports nothing
  // from theme, so this direction is safe.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useI18n } = require('../store/i18nStore') as typeof import('../store/i18nStore');
  const locale = useI18n((s: any) => s.locale) as string;
  return locale === 'ar' ? FAR : F;
}

/**
 * Elevation-only shadows. All black — no colored glow. `ring` replaces the
 * old `glow` token: a soft white-alpha outline that lifts a surface without
 * tinting it.
 */
export const shadows = {
  none:  { shadowOpacity: 0 },
  card:  {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius:  24,
    elevation:     8,
  },
  cardHigh: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius:  40,
    elevation:     16,
  },
  // Subtle outline-ring emphasis (replaces colored glow)
  ring: {
    shadowColor:   '#FFFFFF',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius:  10,
    elevation:     6,
  },
  // Legacy alias — kept so existing imports compile. Points at `ring`.
  glow: {
    shadowColor:   '#FFFFFF',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius:  10,
    elevation:     6,
  },
} as const;

export const motion = {
  // Reanimated easing/timing constants
  fast:  { duration: 180 },
  base:  { duration: 280 },
  slow:  { duration: 480 },
  spring: { damping: 18, stiffness: 220, mass: 0.6 },
} as const;

export type ColorToken = keyof typeof colors;
export type GradientToken = keyof typeof gradients;
