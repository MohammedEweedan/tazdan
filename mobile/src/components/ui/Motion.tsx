/**
 * Motion primitives. Use these instead of bare <Pressable> or <View>
 * so transitions stay consistent across the app.
 *
 * - PressableScale  : tap feedback (subtle scale-down + opacity)
 * - FadeIn          : mount animation for screens / sheets
 * - SlideUp         : sheet-style mount
 * - AnimatedPalette : crossfades children when the theme switches
 *
 * Durations come from src/theme/index.ts so they stay tunable from
 * one place. Springs use Reanimated; tap/fade use Animated (lighter,
 * no worklet overhead for trivial cases).
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, type PressableProps, type ViewStyle } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { motion } from '@/theme';

type Style = ViewStyle | AnimatedStyle<ViewStyle>;

/* ────────────────────────────────────────────────────────────────── */

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  style?: Style | Style[];
  /** How far to scale down on press. 0.97 by default — barely visible
   *  but reads as physical. Set 0.94 for big CTAs. */
  scale?: number;
  /** Whether to dim on press. Default true. */
  dim?: boolean;
  children: ReactNode;
}

/**
 * Pressable with the "tactile" feedback every premium fintech uses —
 * scales down slightly + dims. Spring on release for that liquid feel.
 */
export function PressableScale({
  style, scale = 0.97, dim = true, children, disabled, ...rest
}: PressableScaleProps) {
  const s = useSharedValue(1);
  const o = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: o.value,
  }));

  return (
    <Reanimated.View style={animated}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(e) => {
          s.value = withSpring(scale, motion.spring);
          if (dim) o.value = withTiming(0.82, { duration: motion.fast.duration });
          rest.onPressIn?.(e);
        }}
        onPressOut={(e) => {
          s.value = withSpring(1, motion.spring);
          o.value = withTiming(1, { duration: motion.fast.duration });
          rest.onPressOut?.(e);
        }}
        style={style as any}
      >
        {children}
      </Pressable>
    </Reanimated.View>
  );
}

/* ────────────────────────────────────────────────────────────────── */

interface FadeInProps {
  children: ReactNode;
  /** Milliseconds. */
  duration?: number;
  /** Delay before the animation kicks. Useful for staggered lists. */
  delay?: number;
  /** Slide up from this many pixels (0 = pure fade). Default 8. */
  fromY?: number;
  style?: ViewStyle;
}

/**
 * Lightweight mount animation — opacity 0→1, optional Y translation.
 * Uses RN's native Animated (no worklet) so it's safe inside
 * FlatList renderItem without ramming the JS bridge.
 */
export function FadeIn({
  children, duration = motion.base.duration, delay = 0, fromY = 8, style,
}: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, duration, delay]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/* ────────────────────────────────────────────────────────────────── */

interface SlideUpProps {
  children: ReactNode;
  visible: boolean;
  /** Distance to slide from. Default 24px. */
  fromY?: number;
  duration?: number;
  style?: ViewStyle;
}

/**
 * Bottom-anchored slide-up sheet animator. Wrap your sheet content;
 * toggle `visible` to animate in/out.
 */
export function SlideUp({
  children, visible, fromY = 24, duration = motion.base.duration, style,
}: SlideUpProps) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : fromY,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY, duration, fromY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
