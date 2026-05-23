/**
 * SlideToConfirm — MoonPay-style slide-to-confirm action.
 *
 * Features:
 *  • Drag the thumb to the right to confirm — springs back if dropped early.
 *  • Animated countdown badge on the slider surface (white → red).
 *  • Entire slider tints red in the last 10 seconds via a blended overlay.
 *  • Success/error states swap the track colour and show emoji feedback.
 *  • Idle thumb pulses so users know it's interactive.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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
} from 'react-native-reanimated';

export type SlideStatus = 'idle' | 'loading' | 'success' | 'error';

const TRACK_H       = 58;
const THUMB         = 50;
const PAD           = 4;
const DANGER_CUTOFF = 10; // seconds at which red kicks in hard

interface Props {
  label:        string;
  onConfirm:    () => void;
  enabled?:     boolean;
  status?:      SlideStatus;
  successLabel?: string;
  errorLabel?:   string;
  /** Optional live countdown to show on the slider surface */
  seconds?:      number;
  /** Total seconds for the quote (default 30) — used to compute danger ratio */
  totalSeconds?: number;
  // ── theme tokens ──────────────────────────────────────────────────
  accent:   string;   // thumb + fill colour
  accentFg: string;   // icons on thumb
  trackBg:  string;
  trackFg:  string;
  border:   string;
  greenBg:  string; greenFg: string;
  redBg:    string; redFg:   string;
}

export function SlideToConfirm({
  label, onConfirm, enabled = true, status = 'idle',
  successLabel, errorLabel,
  seconds, totalSeconds = 30,
  accent, accentFg, trackBg, trackFg, border,
  greenBg, greenFg, redBg, redFg,
}: Props) {
  const [w, setW] = useState(0);
  const travel  = Math.max(0, w - THUMB - PAD * 2);

  // ── Shared values ────────────────────────────────────────────────
  const x          = useSharedValue(0);
  const startX     = useSharedValue(0);
  const thumbPulse = useSharedValue(1);     // idle heartbeat scale
  const fillOpacity= useSharedValue(0.12);  // progress fill glow
  const dangerV    = useSharedValue(0);     // 0 = safe, 1 = critical (drives red overlay)
  const timerPulse = useSharedValue(1);     // countdown badge scale

  const onLayout = useCallback((e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width), []);

  const fire = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
  }, [onConfirm]);

  const canDrag = enabled && status === 'idle' && travel > 0;
  const done    = status === 'success';
  const err     = status === 'error';

  // ── Danger level: drives red overlay opacity + badge colour ─────
  useEffect(() => {
    if (seconds === undefined || seconds <= 0) return;
    const ratio = Math.max(0, Math.min(1, 1 - seconds / totalSeconds));
    dangerV.value = withTiming(ratio, { duration: 600 });
  }, [seconds, totalSeconds, dangerV]);

  // ── Timer badge pulse — speeds up in last 10 s ──────────────────
  useEffect(() => {
    if (seconds === undefined || seconds <= 0 || done || err) {
      timerPulse.value = withTiming(1, { duration: 200 });
      return;
    }
    const dur = seconds <= DANGER_CUTOFF ? 380 : 900;
    timerPulse.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: dur }),
        withTiming(1.00, { duration: dur }),
      ),
      -1, true,
    );
  }, [seconds, done, err, timerPulse]);

  // ── Thumb idle pulse ─────────────────────────────────────────────
  useEffect(() => {
    if (status === 'idle' && enabled) {
      thumbPulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 700 }),
          withTiming(1.00, { duration: 700 }),
        ),
        -1, true,
      );
      fillOpacity.value = withRepeat(
        withSequence(
          withTiming(0.22, { duration: 900 }),
          withTiming(0.08, { duration: 900 }),
        ),
        -1, true,
      );
    } else {
      thumbPulse.value  = withTiming(1,    { duration: 200 });
      fillOpacity.value = withTiming(0.14, { duration: 200 });
    }
  }, [status, enabled, thumbPulse, fillOpacity]);

  // ── Thumb position driven by parent status ───────────────────────
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
      x.value = withSpring(0, { damping: 20, stiffness: 240 });
    }
  }, [status, travel, x]);

  // ── Pan gesture ──────────────────────────────────────────────────
  const pan = Gesture.Pan()
    .enabled(canDrag)
    .onBegin(() => { startX.value = x.value; })
    .onUpdate((e) => {
      const next = startX.value + e.translationX;
      x.value = Math.min(travel, Math.max(0, next));
    })
    .onEnd(() => {
      if (x.value >= travel * 0.82) {
        x.value = withSequence(
          withTiming(travel,     { duration: 100 }),
          withSpring(travel - 4, { damping: 14, stiffness: 280 }),
          withSpring(travel,     { damping: 20, stiffness: 220 }),
        );
        runOnJS(fire)();
      } else {
        x.value = withSpring(0, { damping: 20, stiffness: 240 });
      }
    });

  // ── Animated styles ──────────────────────────────────────────────
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: thumbPulse.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width:   x.value + THUMB + PAD,
    opacity: fillOpacity.value,
  }));

  // Red danger overlay — invisible at t=0, solid at t=1 (last 5 s)
  const dangerOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      dangerV.value,
      [0, 0.5, 0.75, 1],
      [0, 0.06, 0.28, 0.60],
      Extrapolation.CLAMP,
    ),
  }));

  // Countdown badge scale
  const timerBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: timerPulse.value }],
  }));

  // Label fades as thumb slides right
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, travel * 0.45], [1, 0], Extrapolation.CLAMP),
  }));

  // ── Derived values ───────────────────────────────────────────────
  const trackColor = done ? greenBg : err ? redBg : trackBg;
  const textColor  = done ? greenFg : err ? redFg : trackFg;

  const showTimer = !done && !err && seconds !== undefined && seconds > 0;
  const timerCritical = (seconds ?? 999) <= DANGER_CUTOFF;

  // Timer badge colour: white → orange → red (purely JS, changes once/second)
  const timerTextColor = timerCritical
    ? '#ffffff'
    : '#ffffff';
  const timerBadgeBg = timerCritical
    ? 'rgba(239,68,68,0.25)'
    : 'rgba(255,255,255,0.14)';

  const displayText = done
    ? `✅  ${successLabel ?? label}  :)`
    : err
    ? `❌  ${errorLabel ?? 'Something went wrong'}  :(`
    : label;

  return (
    <View
      onLayout={onLayout}
      style={{
        height: TRACK_H, borderRadius: 18,
        backgroundColor: trackColor,
        borderWidth: done || err ? 0 : 1,
        borderColor: timerCritical && !done && !err ? 'rgba(239,68,68,0.55)' : border,
        justifyContent: 'center', overflow: 'hidden',
        opacity: enabled || done || err ? 1 : 0.55,
      }}
    >
      {/* ── Progress fill glow (idle only) ─────────────────────── */}
      {status === 'idle' && (
        <Animated.View
          style={[
            {
              position: 'absolute', left: 0, top: 0, bottom: 0,
              borderRadius: 18, backgroundColor: accent,
            },
            fillStyle,
          ]}
        />
      )}

      {/* ── Danger red overlay — bleeds in from 0→1 danger level ─ */}
      {!done && !err && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute', inset: 0, borderRadius: 18,
              backgroundColor: '#ef4444',
            },
            dangerOverlayStyle,
          ]}
        />
      )}

      {/* ── Centred label — fades as thumb advances ─────────────── */}
      <Animated.View
        style={[
          { alignItems: 'center', justifyContent: 'center', paddingHorizontal: THUMB + PAD + 8 },
          labelStyle,
        ]}
      >
        <Text
          style={{
            color: textColor,
            fontSize: done || err ? 14 : 15,
            fontWeight: '600', letterSpacing: 0.1,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayText}
        </Text>
      </Animated.View>

      {/* ── Countdown badge — anchored to right, on slider surface ─ */}
      {showTimer && (
        <Animated.View
          style={[
            {
              position: 'absolute', right: 12,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: timerBadgeBg,
              borderRadius: 10,
              paddingHorizontal: 8, paddingVertical: 3,
              // Ensure it's above the danger overlay
              zIndex: 2,
            },
            timerBadgeStyle,
          ]}
          pointerEvents="none"
        >
          <Text
            style={{
              color: timerTextColor,
              fontSize: timerCritical ? 13 : 12,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              letterSpacing: 0.2,
            }}
          >
            {seconds}s
          </Text>
        </Animated.View>
      )}

      {/* ── Draggable thumb — hidden on done/error ──────────────── */}
      {!done && !err && (
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              {
                position: 'absolute', left: PAD, top: PAD,
                width: THUMB, height: THUMB, borderRadius: 14,
                backgroundColor: enabled ? accent : border,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: accent,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.45,
                shadowRadius: 8,
                elevation: 7,
                zIndex: 3,
              },
              thumbStyle,
            ]}
          >
            {status === 'loading'
              ? <ActivityIndicator color={accentFg} size="small" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -2 }}>
                  <Ionicons name="chevron-forward" size={22} color={accentFg} style={{ marginRight: -12 }} />
                  <Ionicons name="chevron-forward" size={22} color={accentFg} style={{ opacity: 0.5 }} />
                </View>
              )}
          </Animated.View>
        </GestureDetector>
      )}
    </View>
  );
}
