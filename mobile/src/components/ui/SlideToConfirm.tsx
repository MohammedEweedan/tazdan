/**
 * SlideToConfirm — premium slide-to-confirm action.
 *
 * Design overhaul (v2):
 *  • Larger, taller track with rounded-pill geometry that feels iOS-native.
 *  • Brand-gradient progress fill that follows the thumb (not just a glow).
 *  • Continuous shimmer streak across the idle label so users see "swipe me".
 *  • Refined drag physics: rubber-band on overshoot, snappy spring return,
 *    haptic tick on approach to the commit threshold.
 *  • Larger circular thumb with a subtle inner ring + dual chevron stack.
 *  • Countdown badge stays, but the danger-overlay now blends a brand-red
 *    tint *only* at <10s, not a solid wash.
 *  • Success/error states show a centered icon + label, no emoji.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type SlideStatus = 'idle' | 'loading' | 'success' | 'error';

const TRACK_H        = 64;
const THUMB          = 56;
const PAD            = 4;
const DANGER_CUTOFF  = 10;
const COMMIT_RATIO   = 0.80;
const TICK_RATIO     = 0.55;

interface Props {
  label:        string;
  onConfirm:    () => void;
  enabled?:     boolean;
  status?:      SlideStatus;
  successLabel?: string;
  errorLabel?:   string;
  seconds?:      number;
  totalSeconds?: number;
  // ── theme tokens ──────────────────────────────────────────────────
  accent:   string;
  accentFg: string;
  trackBg:  string;
  trackFg:  string;
  border:   string;
  greenBg:  string; greenFg: string;
  redBg:    string; redFg:   string;
  /** Optional second accent for the gradient fill (defaults to accent). */
  accentEnd?: string;
}

export function SlideToConfirm({
  label, onConfirm, enabled = true, status = 'idle',
  successLabel, errorLabel,
  seconds, totalSeconds = 30,
  accent, accentFg, accentEnd, trackBg, trackFg, border,
  greenBg, greenFg, redBg, redFg,
}: Props) {
  const [w, setW] = useState(0);
  const travel = Math.max(0, w - THUMB - PAD * 2);
  const fillEnd = accentEnd ?? accent;

  // ── Shared values ────────────────────────────────────────────────
  const x          = useSharedValue(0);
  const startX     = useSharedValue(0);
  const tickFired  = useSharedValue(0);
  const thumbScale = useSharedValue(1);
  const shimmer    = useSharedValue(-1);
  const dangerV    = useSharedValue(0);
  const timerPulse = useSharedValue(1);

  const onLayout = useCallback((e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width), []);

  const fire = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  }, [onConfirm]);

  const tick = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const canDrag = enabled && status === 'idle' && travel > 0;
  const done    = status === 'success';
  const err     = status === 'error';

  // Danger overlay opacity grows toward expiry
  useEffect(() => {
    if (seconds === undefined || seconds <= 0) return;
    const ratio = Math.max(0, Math.min(1, 1 - seconds / totalSeconds));
    dangerV.value = withTiming(ratio, { duration: 600 });
  }, [seconds, totalSeconds, dangerV]);

  // Timer badge pulse (faster in last 10s)
  useEffect(() => {
    if (seconds === undefined || seconds <= 0 || done || err) {
      timerPulse.value = withTiming(1, { duration: 200 });
      return;
    }
    const dur = seconds <= DANGER_CUTOFF ? 380 : 900;
    timerPulse.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: dur }),
        withTiming(1.00, { duration: dur }),
      ),
      -1, true,
    );
  }, [seconds, done, err, timerPulse]);

  // Continuous shimmer streak — runs whenever the slider is idle + enabled
  useEffect(() => {
    if (status === 'idle' && enabled) {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 2400, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
          withTiming(-1,  { duration: 0 }),
        ),
        -1, false,
      );
      thumbScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.quad) }),
          withTiming(1.00, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        ),
        -1, true,
      );
    } else {
      shimmer.value = withTiming(-1, { duration: 200 });
      thumbScale.value = withTiming(1, { duration: 200 });
    }
  }, [status, enabled, shimmer, thumbScale]);

  // Parent-driven thumb position
  useEffect(() => {
    if (status === 'loading') {
      x.value = withTiming(travel, { duration: 200 });
    } else if (status === 'success') {
      x.value = withSequence(
        withTiming(travel,     { duration: 180 }),
        withSpring(travel - 6, { damping: 12, stiffness: 260 }),
        withSpring(travel,     { damping: 18, stiffness: 200 }),
      );
    } else {
      x.value = withSpring(0, { damping: 22, stiffness: 260 });
      tickFired.value = 0;
    }
  }, [status, travel, x, tickFired]);

  // ── Pan gesture ──────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .enabled(canDrag)
    .onBegin(() => {
      startX.value = x.value;
      thumbScale.value = withSpring(1.10, { damping: 14, stiffness: 320 });
    })
    .onUpdate((e) => {
      const raw = startX.value + e.translationX;
      // Rubber-band beyond travel
      let next = raw;
      if (raw < 0) next = raw * 0.25;
      else if (raw > travel) next = travel + (raw - travel) * 0.18;
      x.value = next;

      // Light haptic when crossing TICK_RATIO threshold (only once per drag)
      if (tickFired.value === 0 && raw >= travel * TICK_RATIO) {
        tickFired.value = 1;
        runOnJS(tick)();
      }
    })
    .onEnd(() => {
      thumbScale.value = withSpring(1.00, { damping: 18, stiffness: 240 });
      if (x.value >= travel * COMMIT_RATIO) {
        x.value = withSequence(
          withSpring(travel,     { damping: 20, stiffness: 320 }),
          withSpring(travel - 3, { damping: 12, stiffness: 300 }),
          withSpring(travel,     { damping: 22, stiffness: 220 }),
        );
        runOnJS(fire)();
      } else {
        x.value = withSpring(0, { damping: 22, stiffness: 260 });
        tickFired.value = 0;
      }
    });

  // ── Animated styles ──────────────────────────────────────────────
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: thumbScale.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(THUMB + PAD * 2, x.value + THUMB + PAD * 2),
  }));

  const fillOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      x.value,
      [0, travel * 0.1, travel],
      [0.65, 0.85, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(shimmer.value, [-1, 1.4], [-120, w + 120]) },
      { skewX: '-18deg' },
    ],
    opacity: interpolate(shimmer.value, [-1, 0.1, 1.0, 1.4], [0, 0.45, 0.45, 0]),
  }));

  const dangerOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dangerV.value,
      [0, 0.6, 0.85, 1],
      [0, 0.0, 0.12, 0.32],
      Extrapolation.CLAMP,
    ),
  }));

  const timerBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, travel * 0.45], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(x.value, [0, travel], [0, 16], Extrapolation.CLAMP) }],
  }));

  // ── Derived values ───────────────────────────────────────────────
  const trackColor = done ? greenBg : err ? redBg : trackBg;
  const textColor  = done ? greenFg : err ? redFg : trackFg;
  const showTimer  = !done && !err && seconds !== undefined && seconds > 0;
  const timerCritical = (seconds ?? 999) <= DANGER_CUTOFF;

  const timerBadgeBg = timerCritical
    ? 'rgba(248,113,113,0.22)'
    : 'rgba(255,255,255,0.16)';

  const displayText = done
    ? (successLabel ?? label)
    : err
    ? (errorLabel ?? 'Something went wrong')
    : label;

  return (
    <View
      onLayout={onLayout}
      style={{
        height: TRACK_H,
        borderRadius: TRACK_H / 2,
        backgroundColor: trackColor,
        borderWidth: done || err ? 0 : 1,
        borderColor: timerCritical && !done && !err ? 'rgba(248,113,113,0.45)' : border,
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: enabled || done || err ? 1 : 0.55,
      }}
    >
      {/* ── Brand-gradient progress fill (idle) ─────────────────── */}
      {status === 'idle' && (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: TRACK_H / 2 },
            fillStyle,
            fillOpacityStyle,
          ]}
        >
          <LinearGradient
            colors={[accent, fillEnd]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, borderRadius: TRACK_H / 2 }}
          />
        </Animated.View>
      )}

      {/* ── Shimmer streak across the idle track ────────────────── */}
      {status === 'idle' && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute', top: -10, bottom: -10, width: 60,
              backgroundColor: 'rgba(255,255,255,0.35)',
            },
            shimmerStyle,
          ]}
        />
      )}

      {/* ── Subtle danger tint (last 10s only) ──────────────────── */}
      {!done && !err && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
              borderRadius: TRACK_H / 2,
              backgroundColor: '#ef4444',
            },
            dangerOverlayStyle,
          ]}
        />
      )}

      {/* ── Centred label ─────────────────────────────────────── */}
      <Animated.View
        style={[
          { alignItems: 'center', justifyContent: 'center', paddingHorizontal: THUMB + PAD * 2 + 12, flexDirection: 'row', gap: 8 },
          labelStyle,
        ]}
      >
        {done && <Ionicons name="checkmark-circle" size={20} color={textColor} />}
        {err  && <Ionicons name="alert-circle" size={20} color={textColor} />}
        <Text
          style={{
            color: textColor,
            fontSize: 15,
            fontWeight: '600',
            letterSpacing: 0.1,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayText}
        </Text>
      </Animated.View>

      {/* ── Countdown badge ───────────────────────────────────── */}
      {showTimer && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute', right: 14,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: timerBadgeBg,
              borderRadius: 11,
              paddingHorizontal: 9, paddingVertical: 4,
              zIndex: 2,
            },
            timerBadgeStyle,
          ]}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: timerCritical ? 13 : 12,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              letterSpacing: 0.3,
            }}
          >
            {seconds}s
          </Text>
        </Animated.View>
      )}

      {/* ── Draggable thumb ───────────────────────────────────── */}
      {!done && !err && (
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                position: 'absolute', left: PAD, top: PAD,
                width: THUMB, height: THUMB, borderRadius: THUMB / 2,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: accent,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.55,
                shadowRadius: 12,
                elevation: 8,
                zIndex: 3,
              },
              thumbStyle,
            ]}
          >
            <LinearGradient
              colors={[fillEnd, accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ ...StyleSheetAbsoluteFill, borderRadius: THUMB / 2 }}
            />
            {/* Inner ring for the premium "captured" feel */}
            <View
              style={{
                position: 'absolute', left: 4, top: 4, right: 4, bottom: 4,
                borderRadius: (THUMB - 8) / 2,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            />
            {status === 'loading'
              ? <ActivityIndicator color={accentFg} size="small" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -4 }}>
                  <Ionicons name="chevron-forward" size={20} color={accentFg} style={{ marginRight: -10, opacity: 0.55 }} />
                  <Ionicons name="chevron-forward" size={22} color={accentFg} />
                </View>
              )}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}

// LinearGradient as a sibling needs absolute fill — inline so we don't
// import StyleSheet just for one constant.
const StyleSheetAbsoluteFill = {
  position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0,
};
