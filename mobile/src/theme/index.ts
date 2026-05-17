/**
 * promrkts design tokens.
 * Mirrors the Tailwind/NativeWind config in `tailwind.config.js`. Use this
 * file from any non-NW context (e.g. LinearGradient `colors`, ShadowOffset).
 */

export const colors = {
  brand: {
    50:  '#e8f0fc',
    100: '#c4d8f7',
    200: '#9cbef0',
    300: '#73a4e9',
    400: '#4A8FE0',
    500: '#2477d3',
    600: '#0057B8',
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
  brand:    ['#4A8FE0', '#0057B8'],
  brandReverse: ['#0057B8', '#4A8FE0'],
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
    sapphire:  ['#0057B8', '#001f4f'],   // standard
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

export const typography = {
  // RN doesn't support a single token, so we expose family + weight + size triplets
  display: { fontFamily: 'System', fontWeight: '800' as const },
  heading: { fontFamily: 'System', fontWeight: '700' as const },
  body:    { fontFamily: 'System', fontWeight: '500' as const },
  caption: { fontFamily: 'System', fontWeight: '500' as const },
  mono:    { fontFamily: 'Menlo',  fontWeight: '600' as const },
} as const;

/** iOS-style soft shadows. Pass to RN `style={{ ...shadows.card }}`. */
export const shadows = {
  none:  { shadowOpacity: 0 },
  card:  {
    shadowColor:   '#0057B8',
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius:  20,
    elevation:     8,
  },
  cardHigh: {
    shadowColor:   '#0057B8',
    shadowOffset:  { width: 0, height: 24 },
    shadowOpacity: 0.30,
    shadowRadius:  40,
    elevation:     16,
  },
  glow: {
    shadowColor:   '#4A8FE0',
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
