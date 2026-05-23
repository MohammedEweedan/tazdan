/**
 * fortuni design tokens.
 * Mirrors the Tailwind/NativeWind config in `tailwind.config.js`. Use this
 * file from any non-NW context (e.g. LinearGradient `colors`, ShadowOffset).
 */

export const colors = {
  brand: {
    50:  '#e8f0fc',
    100: '#c4d8f7',
    200: '#9cbef0',
    300: '#73a4e9',
    400: '#226dff',
    500: '#2477d3',
    600: '#1a52cc',
    700: '#00408a',
    800: '#002a5c',
    900: '#00152e',
  },
  surface: {
    0:   '#000206',
    50:  '#030818',
    100: '#070d22',
    200: '#0c1430',
    300: '#121c44',
    400: '#1a2658',
    500: '#243366',
  },
  ink: {
    primary:   '#ffffff',
    secondary: 'rgba(255,255,255,0.72)',
    tertiary:  'rgba(255,255,255,0.48)',
    muted:     'rgba(255,255,255,0.32)',
  },
  semantic: {
    success: '#22c55e',
    danger:  '#ef4444',
    warning: '#f59e0b',
  },
  line: 'rgba(255,255,255,0.08)',
} as const;

/**
 * Pre-built linear gradients. Use:
 *   <LinearGradient colors={gradients.brand} ... />
 */
export const gradients = {
  // Hero — luxury blue, top-to-bottom
  brand:    ['#226dff', '#1a52cc'],
  brandReverse: ['#1a52cc', '#226dff'],
  // Background sweep — used behind the entire app
  surface:  ['#030818', '#070d22', '#0c1430'],
  // Card highlights — subtle inner sheen
  cardSheen: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)'],
  // Glass — semi-transparent for blur cards
  glass:    ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.04)'],
  // Success / danger fills
  success:  ['#16a34a', '#22c55e'],
  danger:   ['#dc2626', '#ef4444'],
  // Card slider — five distinct premium card colorways
  cards: {
    sapphire:  ['#1a52cc', '#001f4f'],   // standard
    obsidian:  ['#0a0a0a', '#1a1a1a'],   // black metal
    rose:      ['#9b1d4d', '#3a0a1d'],   // rose gold
    emerald:   ['#0a5d4a', '#022019'],   // green
    platinum:  ['#5a6478', '#2a2f3a'],   // silver
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

/** iOS-style soft shadows. Pass to RN `style={{ ...shadows.card }}`. */
export const shadows = {
  none:  { shadowOpacity: 0 },
  card:  {
    shadowColor:   '#1a52cc',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius:  20,
    elevation:     8,
  },
  cardHigh: {
    shadowColor:   '#1a52cc',
    shadowOffset:  { width: 0, height: 24 },
    shadowOpacity: 0.30,
    shadowRadius:  40,
    elevation:     16,
  },
  glow: {
    shadowColor:   '#226dff',
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius:  18,
    elevation:     12,
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
