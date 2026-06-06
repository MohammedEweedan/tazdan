/**
 * SlideToConfirm — premium slide-to-confirm action (v3, monochrome).
 *
 * Design intent
 *  • Calm and deliberate. A solid mono fill, no rotating gradient, no
 *    perpetual shimmer streak. The track is the gesture surface — nothing
 *    else competes for attention.
 *  • Three vertically stacked pieces (top → bottom):
 *      [countdown pill]        — small, right-aligned, MM:SS
 *      [the slide track]       — 72px, the only interactive element
 *      [time-remaining bar]    — 2px, drains left→right
 *    Separating "how much time" from "how to confirm" prevents the badge
 *    from crowding the label.
 *  • Last-10s state is structural (1px danger ring on the track, the
 *    bottom bar turns red), not a wash over the interior.
 *  • Success → centered green checkmark badge. Error → red alert badge.
 *    Track stays mono in both — only the badge is colored, so the
 *    component still looks like itself.
 *  • Accessibility-first:
 *     – `accessibilityRole="button"` + `accessibilityActions={[activate]}`
 *       so VoiceOver/TalkBack users get a tap path.
 *     – Long-press (1200ms) anywhere on the track fires confirm — motor
 *       accessibility fallback for users who cannot drag.
 *     – Honors `AccessibilityInfo.isReduceMotionEnabled()`: no caret
 *       hint pulse, linear easing instead of springs.
 *  • Physics: rubber-band on overshoot, haptic tick at 55% drag, commit
 *    at 80% drag. No bouncy overshoot on success — visual noise.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  LayoutChangeEvent,
  View,
} from 'react-native';
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
  Easing,
} from 'react-native-reanimated';
import { colors as theme } from '@/theme';

export type SlideStatus = 'idle' | 'loading' | 'success' | 'error';

const TRACK_H        = 56;
const THUMB_W        = 96;
const THUMB_H        = 48;
const PAD            = 4;
const DANGER_CUTOFF  = 10;
const COMMIT_RATIO   = 0.80;
const TICK_RATIO     = 0.55;
const LONG_PRESS_MS  = 1200;

interface Props {
  label:        string;
  onConfirm:    () => void;
  enabled?:     boolean;
  status?:      SlideStatus;
  successLabel?: string;
  errorLabel?:   string;
  seconds?:      number;
  totalSeconds?: number;
  // ── theme tokens (all optional in mono mode — defaults read from theme)
  accent?:   string;
  accentFg?: string;
  trackBg?:  string;
  trackFg?:  string;
  border?:   string;
  greenBg?:  string;
  greenFg?:  string;
  redBg?:    string;
  redFg?:    string;
  /** Opt out of the mono recipe and use the legacy gradient. Default: true. */
  mono?:     boolean;
}

function fmtTime(s: number): string {
  if (s < 60) return `${Math.max(0, s)}s`;
  const m = Math.floor(s / 60);
  const r = Math.max(0, s - m * 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function SlideToConfirm({
  label, onConfirm, enabled = true, status = 'idle',
  successLabel, errorLabel,
  seconds, totalSeconds = 30,
  accent, accentFg, trackBg, trackFg, border,
  greenBg, greenFg, redBg, redFg,
  mono = true,
}: Props) {
  /* ── Theme defaults (mono palette) ───────────────────────────────── */
  const _accent   = accent   ?? theme.mono.accent;
  const _accentFg = accentFg ?? theme.mono.accentFg;
  const _trackBg  = trackBg  ?? theme.mono.bgRaised;
  const _trackFg  = trackFg  ?? theme.mono.fg;
  const _border   = border   ?? theme.mono.line;
  const _greenBg  = greenBg  ?? theme.status.successBg;
  const _greenFg  = greenFg  ?? theme.status.success;
  const _redBg    = redBg    ?? theme.status.dangerBg;
  const _redFg    = redFg    ?? theme.status.danger;

  /* ── State / shared values ───────────────────────────────────────── */
  const [w, setW] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const travel = Math.max(0, w - THUMB_W - PAD * 2);

  const x          = useSharedValue(0);
  const startX     = useSharedValue(0);
  const tickFired  = useSharedValue(0);
  const hintPulse  = useSharedValue(0);

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
  const showTimer    = !done && !err && seconds !== undefined && seconds > 0;
  const timerCritical = (seconds ?? 999) <= DANGER_CUTOFF;
  const timeRatio    = seconds !== undefined
    ? Math.max(0, Math.min(1, seconds / totalSeconds))
    : 1;

  /* ── Reduce-Motion query (one-shot) ──────────────────────────────── */
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  /* ── Subtle caret hint pulse on the right side of the track ──────── */
  useEffect(() => {
    if (status === 'idle' && enabled && !reduceMotion) {
      hintPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
        ),
        -1, false,
      );
    } else {
      hintPulse.value = withTiming(0, { duration: 200 });
    }
  }, [status, enabled, reduceMotion, hintPulse]);

  /* ── Parent-driven thumb position ────────────────────────────────── */
  useEffect(() => {
    if (status === 'loading') {
      x.value = withTiming(travel, { duration: 200 });
    } else if (status === 'success') {
      x.value = withTiming(travel, { duration: 220 });
    } else {
      x.value = reduceMotion
        ? withTiming(0, { duration: 200 })
        : withSpring(0, { damping: 22, stiffness: 260 });
      tickFired.value = 0;
    }
  }, [status, travel, x, tickFired, reduceMotion]);

  /* ── Pan gesture (drag-to-confirm) ───────────────────────────────── */
  const pan = Gesture.Pan()
    .enabled(canDrag)
    .onBegin(() => {
      startX.value = x.value;
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
      if (x.value >= travel * COMMIT_RATIO) {
        x.value = withTiming(travel, { duration: 140 });
        runOnJS(fire)();
      } else {
        x.value = reduceMotion
          ? withTiming(0, { duration: 200 })
          : withSpring(0, { damping: 22, stiffness: 260 });
        tickFired.value = 0;
      }
    });

  /* ── Long-press fallback (motor accessibility) ───────────────────── */
  const longPress = Gesture.LongPress()
    .enabled(canDrag)
    .minDuration(LONG_PRESS_MS)
    .onStart(() => {
      x.value = withTiming(travel, { duration: 200 });
      runOnJS(fire)();
    });

  const composed = Gesture.Simultaneous(pan, longPress);

  /* ── Animated styles ─────────────────────────────────────────────── */
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  // Solid mono fill — appears once the thumb passes ~15% drag so the
  // empty state stays calm. Width tracks the thumb.
  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(THUMB_W + PAD * 2, x.value + THUMB_W + PAD * 2),
    opacity: interpolate(
      x.value,
      [0, travel * 0.15, travel],
      [0, 0.85, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Label fades + lifts slightly on drag (no horizontal slide → calmer)
  const labelStyle = useAnimatedStyle(() => ({
    opacity:   interpolate(x.value, [0, travel * 0.35], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(x.value, [0, travel * 0.5], [0, -4], Extrapolation.CLAMP) }],
  }));

  // Right-side caret hint — sits at ~70% mark, breathes when idle
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      x.value,
      [0, travel * 0.35],
      [reduceMotion ? 0.35 : 0.18 + hintPulse.value * 0.30, 0],
      Extrapolation.CLAMP,
    ),
  }));

  /* ── Derived presentation ─────────────────────────────────────────── */
  const trackBorder = timerCritical && !done && !err
    ? _redFg
    : _border;

  const displayText = done
    ? (successLabel ?? label)
    : err
    ? (errorLabel ?? 'Something went wrong')
    : label;

  const handleA11yAction = useCallback((event: { nativeEvent: { actionName: string } }) => {
    if (event.nativeEvent.actionName === 'activate' && canDrag) fire();
  }, [canDrag, fire]);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <View style={{ width: '100%' }}>
      {/* ── Countdown pill ABOVE the track (right-aligned) ──────────── */}
      {showTimer && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            marginBottom: 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: timerCritical ? _redBg : _trackBg,
              borderColor:     timerCritical ? _redFg : _border,
              borderWidth:     1,
              borderRadius:    100,
              paddingHorizontal: 10,
              paddingVertical:   4,
            }}
            accessibilityLabel={`Time remaining ${seconds} seconds`}
          >
            <Ionicons
              name={timerCritical ? 'alert-circle' : 'time-outline'}
              size={12}
              color={timerCritical ? _redFg : _trackFg}
            />
            <Text
              style={{
                color: timerCritical ? _redFg : _trackFg,
                fontSize: 12,
                fontWeight: '700',
                fontVariant: ['tabular-nums'],
                letterSpacing: 0.3,
              }}
            >
              {fmtTime(seconds ?? 0)}
            </Text>
          </View>
        </View>
      )}

      {/* ── The track ───────────────────────────────────────────────── */}
      <View
        onLayout={onLayout}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Swipe right to confirm, or long-press to confirm"
        accessibilityState={{ disabled: !enabled, busy: status === 'loading' }}
        accessibilityActions={[{ name: 'activate', label: 'Confirm' }]}
        onAccessibilityAction={handleA11yAction}
        style={{
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: done ? _greenBg : err ? _redBg : _trackBg,
          borderWidth: 1,
          borderColor: done ? _greenFg : err ? _redFg : trackBorder,
          justifyContent: 'center',
          overflow: 'hidden',
          opacity: enabled || done || err ? 1 : 0.55,
        }}
      >
        {/* Solid mono progress fill — appears as the thumb travels */}
        {status === 'idle' && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute', left: 0, top: 0, bottom: 0,
                borderRadius: TRACK_H / 2,
                backgroundColor: _accent,
              },
              fillStyle,
            ]}
          />
        )}

        {/* Centered label */}
        <Animated.View
          style={[
            {
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: THUMB_W + PAD * 2 + 12,
              paddingRight: 32,
              flexDirection: 'row',
              gap: 8,
            },
            labelStyle,
          ]}
          pointerEvents="none"
        >
          {done && <Ionicons name="checkmark-circle" size={20} color={_greenFg} />}
          {err  && <Ionicons name="alert-circle"     size={20} color={_redFg} />}
          <Text
            style={{
              color: done ? _greenFg : err ? _redFg : _trackFg,
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

        {/* Right-side caret hint — fades as the thumb advances */}
        {status === 'idle' && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                right: 22,
                top: 0, bottom: 0,
                alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row',
              },
              hintStyle,
            ]}
          >
            <Ionicons name="chevron-forward" size={14} color={_trackFg} style={{ opacity: 0.5, marginRight: -6 }} />
            <Ionicons name="chevron-forward" size={16} color={_trackFg} />
          </Animated.View>
        )}

        {/* Draggable thumb */}
        {!done && !err && (
          <GestureDetector gesture={composed}>
            <Animated.View
              style={[
                {
                  position: 'absolute', left: PAD, top: PAD,
                  width: THUMB_W, height: THUMB_H, borderRadius: THUMB_H / 2,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: _accent,
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.18,
                  shadowRadius: 10,
                  elevation: 4,
                  zIndex: 3,
                },
                thumbStyle,
              ]}
            >
              {status === 'loading'
                ? <ActivityIndicator color={_accentFg} size="small" />
                : (
                  <Ionicons name="chevron-forward" size={24} color={_accentFg} />
                )}
            </Animated.View>
          </GestureDetector>
        )}

        {/* Success badge — overlays at the end of the track */}
        {done && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: PAD,
              top: PAD,
              width: THUMB_W,
              height: THUMB_H,
              borderRadius: THUMB_H / 2,
              backgroundColor: _greenBg,
              borderWidth: 1,
              borderColor: _greenFg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={26} color={_greenFg} />
          </View>
        )}

        {/* Error badge — same position */}
        {err && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: PAD,
              top: PAD,
              width: THUMB_W,
              height: THUMB_H,
              borderRadius: THUMB_H / 2,
              backgroundColor: _redBg,
              borderWidth: 1,
              borderColor: _redFg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="alert" size={26} color={_redFg} />
          </View>
        )}
      </View>

      {/* ── Time-remaining bar BELOW the track ──────────────────────── */}
      {showTimer && (
        <View
          style={{
            marginTop: 10,
            height: 2,
            borderRadius: 1,
            backgroundColor: _border,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.round(timeRatio * 100)}%`,
              backgroundColor: timerCritical ? _redFg : _trackFg,
              borderRadius: 1,
            }}
          />
        </View>
      )}
    </View>
  );
}
