/**
 * ShimmerBackdrop — the full-bleed gradient behind Home's top section.
 * Fills its parent edge to edge (under the status bar) and dissolves into
 * the page colour at the bottom, so there is no box or hard edge.
 *
 *  - Base: a deep navy → brand-blue diagonal gradient (soft sky on light,
 *    greyscale on mono).
 *  - Glow: a brand-blue bloom from the top-right that slowly breathes.
 *  - Sheen: a narrow band of light that sweeps across every few seconds.
 *
 * All motion runs on the native driver and stops under reduced motion.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/store/themeStore';

const LOOKS = {
  dark: {
    base: ['#0E1A2C', '#132C4D', '#0C1726'] as const,
    glow: ['rgba(99,161,219,0.55)', 'rgba(99,161,219,0.12)', 'rgba(99,161,219,0)'] as const,
    sheen: 'rgba(255,255,255,0.10)',
    edge: 'rgba(255,255,255,0.10)',
  },
  light: {
    base: ['#E4F0FB', '#CFE3F6', '#EEF5FC'] as const,
    glow: ['rgba(79,139,196,0.42)', 'rgba(79,139,196,0.10)', 'rgba(79,139,196,0)'] as const,
    sheen: 'rgba(255,255,255,0.55)',
    edge: 'rgba(10,10,11,0.06)',
  },
  mono: {
    base: ['#1C1C1E', '#232325', '#141415'] as const,
    glow: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0)'] as const,
    sheen: 'rgba(255,255,255,0.07)',
    edge: 'rgba(255,255,255,0.12)',
  },
};

const SHEEN_WIDTH = 110;

export function ShimmerBackdrop({ pageColor }: { pageColor: string }) {
  const mode = useTheme((s) => s.mode);
  const look = LOOKS[mode];
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const breathe = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const s = Animated.loop(Animated.sequence([
      Animated.delay(3600),
      Animated.timing(sweep, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    b.start(); s.start();
    return () => { b.stop(); s.stop(); };
  }, [reduceMotion, breathe, sweep]);

  const glowOpacity = reduceMotion ? 0.85 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const sheenX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-SHEEN_WIDTH * 2, width + SHEEN_WIDTH] });

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}
    >
      <LinearGradient colors={look.base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity }]}>
        <LinearGradient colors={look.glow} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 0.9 }} style={StyleSheet.absoluteFill} />
      </Animated.View>


      {!reduceMotion && width > 0 && (
        <Animated.View style={{ position: 'absolute', top: -80, bottom: -80, width: SHEEN_WIDTH, transform: [{ translateX: sheenX }, { rotate: '18deg' }] }}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', look.sheen, 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* Dissolve into the page — no hard bottom edge. */}
      <LinearGradient
        colors={[`${pageColor}00`, pageColor]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '38%' }}
      />
    </View>
  );
}

/** Colours for controls sitting on the backdrop (glass circles). */
export function useShimmerInk() {
  const mode = useTheme((s) => s.mode);
  return mode === 'light'
    ? { glass: 'rgba(255,255,255,0.72)', glassBorder: 'rgba(10,10,11,0.06)', rule: 'rgba(10,10,11,0.08)' }
    : { glass: 'rgba(255,255,255,0.10)', glassBorder: 'rgba(255,255,255,0.14)', rule: 'rgba(255,255,255,0.10)' };
}
