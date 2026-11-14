/**
 * Launch splash — the ن mark from the app icon, drawn on the brand navy.
 *
 * The native launch screen is plain navy (app.json `splash`), so this picks
 * up seamlessly: the lower arc of the ن draws itself, the wallet clasp pops
 * in, then the dot drops onto the gap and "boops" — squash, overshoot,
 * settle — like a cherry on top. Holds until the app is ready, then fades
 * into it. Reduced motion shows the finished mark without the animation.
 *
 * Geometry comes from assets/icon-ios.png (1254 px canvas): stroke 87,
 * corner radius 155.5 on the centreline, dot r 69, clasp 355 × 207.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export const SPLASH_NAVY = '#24384F';
const MARK = '#FFFFFF';

// Icon canvas crop around the mark (x 255–990, y 281–965, plus breathing room).
const VB = { x: 240, y: 266, w: 765, h: 714 };
// Centreline of the bowl, from the left tip round to the right tip.
const BOWL = 'M497 445 L454 445 A155.5 155.5 0 0 0 298.5 600.5 L298.5 766 A155.5 155.5 0 0 0 454 921.5 L765 921.5 A155.5 155.5 0 0 0 920.5 766 L920.5 600.5 A155.5 155.5 0 0 0 765 445 L730 445';
const BOWL_LENGTH = 1700;
const STROKE = 87;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Minimum on-screen time so the mark always finishes drawing. */
export const SPLASH_MIN_MS = 1750;

export function LaunchSplash({ ready, onGone }: { ready: boolean; onGone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const size = Math.min(width, height) * 0.4; // mark width on screen
  const k = size / VB.w;
  const markH = VB.h * k;

  const draw = useSharedValue(reduced ? 1 : 0);
  const claspScale = useSharedValue(reduced ? 1 : 0.4);
  const claspOpacity = useSharedValue(reduced ? 1 : 0);
  const dotY = useSharedValue(reduced ? 0 : -110 * k);
  const dotOpacity = useSharedValue(reduced ? 1 : 0);
  const dotSX = useSharedValue(1);
  const dotSY = useSharedValue(1);
  const press = useSharedValue(0);
  const fade = useSharedValue(1);
  const zoom = useSharedValue(1);
  const [minDone, setMinDone] = useState(reduced);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const ease = Easing.bezier(0.65, 0, 0.35, 1);
    // 1. The lower arc draws itself.
    draw.value = withDelay(120, withTiming(1, { duration: 950, easing: ease }));
    // 2. The clasp pops in as the stroke passes it.
    claspOpacity.value = withDelay(820, withTiming(1, { duration: 160 }));
    claspScale.value = withDelay(820, withSpring(1, { damping: 11, stiffness: 220, mass: 0.7 }));
    // 3. The dot drops and boops: squash on contact, overshoot, settle.
    dotOpacity.value = withDelay(1120, withTiming(1, { duration: 90 }));
    dotY.value = withDelay(1120, withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) }));
    dotSX.value = withDelay(1370, withSequence(
      withTiming(1.28, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(0.92, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 260 }),
    ));
    dotSY.value = withDelay(1370, withSequence(
      withTiming(0.7, { duration: 70, easing: Easing.out(Easing.quad) }),
      withTiming(1.1, { duration: 110 }),
      withSpring(1, { damping: 9, stiffness: 260 }),
    ));
    // The bowl gives a little under the dot.
    press.value = withDelay(1370, withSequence(
      withTiming(1, { duration: 80 }),
      withSpring(0, { damping: 10, stiffness: 220 }),
    ));
    const t = setTimeout(() => setMinDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!ready || !minDone || leaving) return;
    setLeaving(true);
    fade.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.quad) });
    zoom.value = withTiming(1.08, { duration: 380, easing: Easing.out(Easing.quad) });
    const t = setTimeout(() => onGone?.(), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, minDone]);

  const bowlProps = useAnimatedProps(() => ({
    strokeDashoffset: BOWL_LENGTH * (1 - draw.value),
    strokeOpacity: draw.value > 0.001 ? 1 : 0,
  }));
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: press.value * 14 * k }, { scale: zoom.value }],
  }));
  const claspStyle = useAnimatedStyle(() => ({ opacity: claspOpacity.value, transform: [{ scale: claspScale.value }] }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    // Squash from the bottom edge, where the dot meets the bowl.
    transform: [
      { translateY: dotY.value + (1 - dotSY.value) * 69 * k },
      { scaleX: dotSX.value },
      { scaleY: dotSY.value },
    ],
  }));

  const at = (x: number, y: number) => ({ left: (x - VB.x) * k, top: (y - VB.y) * k });

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.root, rootStyle]} pointerEvents="none">
      <Animated.View style={[{ width: size, height: markH }, markStyle]} accessibilityRole="image" accessibilityLabel="tazdan">
        <Svg width={size} height={markH} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
          <AnimatedPath
            d={BOWL}
            stroke={MARK}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={[BOWL_LENGTH, BOWL_LENGTH]}
            animatedProps={bowlProps}
          />
        </Svg>
        {/* Wallet clasp with its hole, over the right side of the bowl */}
        <Animated.View style={[styles.abs, at(635, 584), { width: 355 * k, height: 207 * k, borderRadius: 103.5 * k, backgroundColor: MARK }, claspStyle]}>
          <View style={[styles.abs, { left: 204 * k, top: 64 * k, width: 78 * k, height: 78 * k, borderRadius: 39 * k, backgroundColor: SPLASH_NAVY }]} />
        </Animated.View>
        {/* The dot */}
        <Animated.View style={[styles.abs, at(549, 281), { width: 138 * k, height: 138 * k, borderRadius: 69 * k, backgroundColor: MARK }, dotStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_NAVY, alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  abs: { position: 'absolute' },
});
