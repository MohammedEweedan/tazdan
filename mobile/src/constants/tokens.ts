/**
 * Design tokens — motion, spacing, accessibility, haptics.
 * Award-winning apps choreograph every interaction.
 */

export const MOTION = {
  instant: 0,
  fast: 150,     // Micro-interactions: button press, toggle
  normal: 250,   // Standard transitions: screen changes, modals
  slow: 400,     // Emphasis: success states, page transitions
  dramatic: 600, // Onboarding reveals, hero animations
} as const;

export const EASING = {
  default: [0.4, 0, 0.2, 1] as [number, number, number, number],     // Material standard
  enter:   [0, 0, 0.2, 1] as [number, number, number, number],        // Decelerate (elements arriving)
  exit:    [0.4, 0, 1, 1] as [number, number, number, number],        // Accelerate (elements leaving)
  bounce:  [0.34, 1.56, 0.64, 1] as [number, number, number, number],// Playful spring-like
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const A11Y = {
  minTouchTarget: 44,        // iOS Human Interface Guidelines
  minTouchTargetAndroid: 48, // Material Design
  maxContrastRatio: 7,       // WCAG AAA where possible
  screenReaderDelay: 250,    // Wait for layout before focus
} as const;

export const HAPTIC = {
  press: 'light',
  confirm: 'medium',
  success: 'success',
  error: 'error',
  warning: 'warning',
  toggle: 'light',
  scrollSnap: 'medium',
  delete: 'heavy',
} as const;

export type HapticType = keyof typeof HAPTIC;
