/**
 * ConfirmAction — the last step of every money flow (send · buy · sell ·
 * exchange · top up). One component, three ways to say "yes, do it":
 *
 *   'review' — a calm "Review" button opens the shared BottomSheet with the
 *              summary (amount, recipient, rate, fees…) and a Confirm button.
 *   'hold'   — a full-width pill: "Hold to send 250 USD". The pill fills over
 *              0.8 s with a haptic ramp; letting go early cancels.
 *   'slide'  — a slim track; the knob carries the arrow and leaves an accent
 *              trail. Haptic tick at the commit point, spring back below it.
 *
 * The variant comes from ONE place: `CONFIRM_STYLE` (constants/config), or a
 * tester's pick in Settings → Appearance (`uiStore.confirmStyle`). Pass
 * `variant` only to pin a specific screen.
 *
 * Security: this control only expresses intent. `onConfirm` is the caller's
 * existing handler — step-up (`useStepUpAuth` / `StepUpModal`), biometrics
 * and limit checks all still run inside it, unchanged.
 *
 * Placement: by default the control docks itself a fixed distance above the
 * home indicator (`useConfirmDockInset`). The height is fixed per variant
 * (52 pt) and never changes with status, so nothing above it jumps.
 *
 * Accessibility: role=button with an `activate` action (VoiceOver/TalkBack
 * double-tap confirms slide/hold directly), reduced motion honoured, haptics
 * via the shared hook (no-ops on web). Arabic mirrors the slide direction.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, FadeIn, cancelAnimation, interpolate, runOnJS,
  useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme, useThemedPalette, type Palette } from '@/store/themeStore';
import { useI18n, useT } from '@/store/i18nStore';
import { useUiStore } from '@/store/uiStore';
import type { ConfirmStyle } from '@/constants/config';

export type ConfirmVariant = ConfirmStyle;
export type ConfirmStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ReviewRow {
  label: string;
  value: string;
  /** Smaller second line under the value (e.g. "@omar"). */
  sub?: string;
}

export interface ReviewSummary {
  /** Sheet title. Defaults to "Review". */
  title?: string;
  /** The headline figure, e.g. "250 USD". */
  amount?: string;
  /** One line under the amount, e.g. "to Omar Ben Ali". */
  caption?: string;
  rows: ReviewRow[];
  /** Small print under the rows (e.g. "The rate includes the spread."). */
  footnote?: string;
}

export interface ConfirmActionProps {
  /** The action as it reads mid-sentence, already translated: "send 250 USD".
   *  Build it with `t('confirm.act.send', { amount })` etc. */
  action: string;
  /** Shown instead while the action isn't ready: "Enter amount". */
  prompt?: string;
  onConfirm: () => void;
  disabled?: boolean;
  status?: ConfirmStatus;
  successLabel?: string;
  errorLabel?: string;
  /** Summary for the review sheet. Without it, 'review' confirms on tap. */
  review?: ReviewSummary;
  /** Pin a variant for this screen. Normally omitted (one global default). */
  variant?: ConfirmVariant;
  /** Add the bottom safe-area dock (default true). */
  dock?: boolean;
  style?: StyleProp<ViewStyle>;
}

const H = 52;
const PAD = 4;
const KNOB = H - PAD * 2;
const COMMIT = 0.85;
const HOLD_MS = 800;
const LONG_PRESS_MS = 1200;

/** The one bottom spacing for every money page: clear of the home indicator
 *  on Face ID phones, a calm 28 pt on phones without one. */
export function useConfirmDockInset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 16) + 12;
}

/** Keep an amount + currency together as one LTR unit inside Arabic text
 *  (so the Arabic "send 250 USD" never reorders to "USD 250"). */
export const ltr = (s: string) => `\u2066${s}\u2069`;

const sentence = (s: string) => (s ? s.charAt(0).toLocaleUpperCase() + s.slice(1) : s);
const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};

export function ConfirmAction({
  action, prompt, onConfirm, disabled = false, status = 'idle',
  successLabel, errorLabel, review, variant, dock = true, style,
}: ConfirmActionProps) {
  const stored = useUiStore((s) => s.confirmStyle);
  const kind = variant ?? stored;
  const dockInset = useConfirmDockInset();

  const common = { action, prompt, onConfirm, disabled, status, successLabel, errorLabel };
  return (
    <View style={[{ width: '100%', paddingBottom: dock ? dockInset : 0 }, style]}>
      {kind === 'slide' ? <SlideControl {...common} />
        : kind === 'hold' ? <HoldControl {...common} />
        : <ReviewControl {...common} review={review} />}
    </View>
  );
}

type ControlProps = Omit<ConfirmActionProps, 'variant' | 'dock' | 'style' | 'review'>;

/** Text for the terminal states, shared by every variant. */
function useStatusText(status: ConfirmStatus, successLabel?: string, errorLabel?: string) {
  const t = useT();
  if (status === 'success') return successLabel ?? t('slide.confirmed');
  if (status === 'error') return errorLabel ?? t('slide.failed');
  return null;
}

/* ── Terminal state (success / error) — identical in all variants ────── */
function ResultFace({ status, text, p, reduce }: { status: 'success' | 'error'; text: string; p: Palette; reduce: boolean }) {
  const ok = status === 'success';
  const fg = ok ? p.greenFg : p.redFg;
  return (
    <Animated.View
      entering={reduce ? undefined : FadeIn.duration(180)}
      pointerEvents="none"
      style={{
        position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18,
      }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: fg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={ok ? 'checkmark' : 'alert'} size={13} color={p.bg} />
      </View>
      <Text numberOfLines={1} style={{ color: fg, fontSize: 15, fontWeight: '500', flexShrink: 1 }}>{text}</Text>
    </Animated.View>
  );
}

/* ═════════════════════════ A · Slide ═════════════════════════════════ */
function SlideControl({ action, prompt, onConfirm, disabled, status = 'idle', successLabel, errorLabel }: ControlProps) {
  const p = useThemedPalette();
  const mode = useTheme((s) => s.mode);
  const t = useT();
  const h = useHaptics();
  const reduce = useReducedMotion();
  const dir = useI18n((s) => s.locale === 'ar') ? -1 : 1;

  const [w, setW] = useState(0);
  const travel = Math.max(0, w - KNOB - PAD * 2);
  const x = useSharedValue(0);       // 0 … travel (always positive; `dir` mirrors it)
  const start = useSharedValue(0);
  const armed = useSharedValue(0);   // 1 while past the commit point

  const ready = !disabled && status === 'idle' && travel > 0;
  const finalText = useStatusText(status, successLabel, errorLabel);
  const label = disabled && prompt ? prompt : t('confirm.slideTo', { action });
  // Full navy trail on charcoal; a soft tint on paper-white and in mono, where
  // a solid fill would fight the neutral knob.
  const trailMax = mode === 'dark' ? 1 : 0.24;

  const fire = useCallback(() => { h.success(); onConfirm(); }, [h, onConfirm]);
  const tick = useCallback(() => h.selection(), [h]);

  const back = useCallback(() => {
    'worklet';
    x.value = reduce ? withTiming(0, { duration: 180 }) : withSpring(0, { damping: 20, stiffness: 240, mass: 0.9 });
    armed.value = 0;
  }, [reduce, x, armed]);

  useEffect(() => {
    if (status === 'loading' || status === 'success') x.value = withTiming(travel, { duration: reduce ? 0 : 160 });
    else back();
  }, [status, travel, reduce, x, back]);

  const pan = Gesture.Pan()
    .enabled(ready)
    .hitSlop({ top: 8, bottom: 8, left: 12, right: 12 })
    .onBegin(() => { start.value = x.value; })
    .onUpdate((e) => {
      const raw = start.value + e.translationX * dir;
      x.value = raw < 0 ? raw * 0.2 : raw > travel ? travel + (raw - travel) * 0.15 : raw;
      const past = raw >= travel * COMMIT ? 1 : 0;
      if (past !== armed.value) { armed.value = past; if (past) runOnJS(tick)(); }
    })
    .onEnd(() => {
      if (x.value >= travel * COMMIT) { x.value = withTiming(travel, { duration: 120 }); runOnJS(fire)(); }
      else back();
    });

  // Motor-accessibility fallback: resting on the knob for 1.2 s also confirms.
  const longPress = Gesture.LongPress()
    .enabled(ready)
    .minDuration(LONG_PRESS_MS)
    .onStart(() => { x.value = withTiming(travel, { duration: 200 }); runOnJS(fire)(); });

  const gesture = Gesture.Simultaneous(pan, longPress);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value * dir },
      { scale: reduce ? 1 : withTiming(armed.value ? 1.04 : 1, { duration: 120 }) },
    ],
  }));
  const trailStyle = useAnimatedStyle(() => ({
    width: Math.max(0, x.value) + KNOB + PAD * 2,
    opacity: interpolate(x.value, [0, travel * 0.12, travel], [0, trailMax * 0.55, trailMax], Extrapolation.CLAMP),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, travel * 0.45], [1, 0], Extrapolation.CLAMP),
  }));
  const arrowStyle = useAnimatedStyle(() => ({ opacity: armed.value ? 0 : 1 }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: armed.value ? 1 : 0 }));

  const done = status === 'success' || status === 'error';
  const onA11y = useCallback((e: { nativeEvent: { actionName: string } }) => {
    if (e.nativeEvent.actionName === 'activate' && ready) fire();
  }, [ready, fire]);

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={finalText ?? label}
      accessibilityHint={ready ? t('confirm.a11yHint') : undefined}
      accessibilityState={{ disabled: !ready, busy: status === 'loading' }}
      accessibilityActions={[{ name: 'activate', label: sentence(action) }]}
      onAccessibilityAction={onA11y}
      style={{
        height: H, borderRadius: H / 2, overflow: 'hidden', justifyContent: 'center',
        backgroundColor: status === 'success' ? p.greenBg : status === 'error' ? p.redBg : p.pillBg,
        opacity: disabled && !done ? 0.55 : 1,
      }}
    >
      {!done && (
        <>
          <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, borderRadius: H / 2, backgroundColor: p.accent }, dir === 1 ? { left: 0 } : { right: 0 }, trailStyle]} />
          <Animated.View pointerEvents="none" style={[{
            position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center',
            paddingLeft: dir === 1 ? KNOB + PAD * 2 + 4 : 18, paddingRight: dir === 1 ? 18 : KNOB + PAD * 2 + 4,
          }, labelStyle]}>
            <Text numberOfLines={1} style={{ color: p.fgMuted, fontSize: 15, fontWeight: '500', letterSpacing: -0.1 }}>{label}</Text>
          </Animated.View>
          <GestureDetector gesture={gesture}>
            <Animated.View style={[dir === 1 ? { left: PAD } : { right: PAD }, {
              position: 'absolute', top: PAD, width: KNOB, height: KNOB, borderRadius: KNOB / 2,
              backgroundColor: p.ctaBg, alignItems: 'center', justifyContent: 'center',
              shadowColor: '#000', shadowOpacity: mode === 'light' ? 0.12 : 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
            }, knobStyle]}>
              {status === 'loading' ? <ActivityIndicator size="small" color={p.ctaFg} /> : (
                <>
                  <Animated.View style={[{ position: 'absolute' }, arrowStyle]}>
                    <Ionicons name={dir === 1 ? 'arrow-forward' : 'arrow-back'} size={19} color={p.ctaFg} />
                  </Animated.View>
                  <Animated.View style={[{ position: 'absolute' }, checkStyle]}>
                    <Ionicons name="checkmark" size={20} color={p.ctaFg} />
                  </Animated.View>
                </>
              )}
            </Animated.View>
          </GestureDetector>
        </>
      )}
      {done && <ResultFace status={status} text={finalText ?? ''} p={p} reduce={reduce} />}
    </View>
  );
}

/* ═════════════════════════ Shared pill (hold + review) ═══════════════ */
function PillFace({ p, text, status, enabled, finalText, reduce, children }: {
  p: Palette; text: string; status: ConfirmStatus; enabled: boolean; finalText: string | null; reduce: boolean; children?: React.ReactNode;
}) {
  const done = status === 'success' || status === 'error';
  return (
    <View style={{
      height: H, borderRadius: H / 2, overflow: 'hidden', justifyContent: 'center',
      backgroundColor: status === 'success' ? p.greenBg : status === 'error' ? p.redBg : p.ctaBg,
      opacity: !enabled && !done && status !== 'loading' ? 0.4 : 1,
    }}>
      {children}
      {!done && (
        <View pointerEvents="none" style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          {status === 'loading'
            ? <ActivityIndicator size="small" color={p.ctaFg} />
            : <Text numberOfLines={1} style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 }}>{text}</Text>}
        </View>
      )}
      {done && <ResultFace status={status} text={finalText ?? ''} p={p} reduce={reduce} />}
    </View>
  );
}

/* ═════════════════════════ B · Press and hold ════════════════════════ */
function HoldControl({ action, prompt, onConfirm, disabled, status = 'idle', successLabel, errorLabel }: ControlProps) {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  const pressed = useSharedValue(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completed = useRef(false);
  const [nudge, setNudge] = useState(false);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready = !disabled && status === 'idle';
  const finalText = useStatusText(status, successLabel, errorLabel);
  const text = disabled && prompt ? prompt : nudge ? t('confirm.holdLonger') : t('confirm.holdTo', { action });

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => () => { clearTimers(); if (nudgeTimer.current) clearTimeout(nudgeTimer.current); }, []);
  useEffect(() => {
    if (status === 'idle') { completed.current = false; progress.value = withTiming(0, { duration: reduce ? 0 : 200 }); }
  }, [status, reduce, progress]);

  const fire = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    clearTimers();
    h.success();
    onConfirm();
  }, [h, onConfirm]);

  const onPressIn = () => {
    if (!ready) return;
    completed.current = false;
    setNudge(false);
    pressed.value = 1;
    h.light();
    // Haptic ramp: light → light → medium, then success on completion.
    timers.current = [
      setTimeout(() => h.light(), HOLD_MS * 0.35),
      setTimeout(() => h.medium(), HOLD_MS * 0.7),
    ];
    progress.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(fire)();
    });
  };
  const onPressOut = () => {
    pressed.value = 0;
    if (!ready || completed.current) return;
    clearTimers();
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: reduce ? 0 : 220, easing: Easing.out(Easing.quad) });
    // Let go early → say so in place (no layout change), then restore.
    setNudge(true);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => setNudge(false), 1600);
  };

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduce ? 1 : withTiming(pressed.value ? 0.985 : 1, { duration: 120 }) }],
  }));
  const ar = useI18n((s) => s.locale === 'ar');

  const onA11y = useCallback((e: { nativeEvent: { actionName: string } }) => {
    if (e.nativeEvent.actionName === 'activate' && ready) fire();
  }, [ready, fire]);

  return (
    <Animated.View style={scaleStyle}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel={finalText ?? text}
        accessibilityHint={ready ? t('confirm.a11yHint') : undefined}
        accessibilityState={{ disabled: !ready, busy: status === 'loading' }}
        accessibilityActions={[{ name: 'activate', label: sentence(action) }]}
        onAccessibilityAction={onA11y}
      >
        <PillFace p={p} text={text} status={status} enabled={ready} finalText={finalText} reduce={reduce}>
          {status !== 'success' && status !== 'error' && (
            <Animated.View pointerEvents="none" style={[{
              position: 'absolute', top: 0, bottom: 0, borderRadius: H / 2,
              backgroundColor: alpha(p.ctaFg, 0.14),
            }, ar ? { right: 0 } : { left: 0 }, fillStyle]} />
          )}
        </PillFace>
      </Pressable>
    </Animated.View>
  );
}

/* ═════════════════════════ C · Review & confirm ══════════════════════ */
function ReviewControl({ action, prompt, onConfirm, disabled, status = 'idle', successLabel, errorLabel, review }: ControlProps & { review?: ReviewSummary }) {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const reduce = useReducedMotion();
  const ar = useI18n((s) => s.locale === 'ar');
  const [open, setOpen] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (pending.current) clearTimeout(pending.current); }, []);

  const ready = !disabled && status === 'idle';
  const latest = useRef({ ready, onConfirm, action, review });
  latest.current = { ready, onConfirm, action, review };
  const finalText = useStatusText(status, successLabel, errorLabel);
  const text = disabled && prompt ? prompt : review ? t('confirm.review') : sentence(action);

  const press = () => {
    if (!ready || pending.current) return;
    h.selection();
    if (review) setOpen(true);
    else { h.success(); onConfirm(); }
  };
  const confirm = () => {
    if (!ready || pending.current) return;
    h.success();
    setOpen(false);
    // Let the sheet finish closing so the existing step-up modal / Face ID
    // prompt never has to present over a dismissing sheet.
    const reviewed = JSON.stringify({ action, amount: review?.amount, rows: review?.rows });
    pending.current = setTimeout(() => {
      pending.current = null;
      const current = latest.current;
      // Closing the sheet must not queue duplicate payments or execute a stale
      // callback after the amount, quote or eligibility changes.
      if (current.ready && reviewed === JSON.stringify({ action: current.action, amount: current.review?.amount, rows: current.review?.rows })) {
        current.onConfirm();
      }
    }, 320);
  };

  return (
    <>
      <Pressable
        onPress={press}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel={finalText ?? text}
        accessibilityHint={ready && review ? t('confirm.a11yReviewHint') : undefined}
        accessibilityState={{ disabled: !ready, busy: status === 'loading' }}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        <PillFace p={p} text={text} status={status} enabled={ready} finalText={finalText} reduce={reduce} />
      </Pressable>

      {review && (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          title={review.title ?? t('confirm.review')}
          footer={(
            <Pressable
              onPress={confirm}
              disabled={!ready}
              accessibilityRole="button"
              accessibilityLabel={disabled ? t('confirm.priceRefresh') : sentence(action)}
              accessibilityState={{ disabled: !ready }}
              style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
            >
              <PillFace p={p} text={disabled ? t('confirm.priceRefresh') : sentence(action)} status="idle" enabled={!disabled} finalText={null} reduce={reduce} />
            </Pressable>
          )}
        >
          {!!review.amount && (
            <View style={{ paddingTop: 10, paddingBottom: 22 }}>
              <Text style={{ color: p.fg, fontSize: 38, fontWeight: '600', letterSpacing: -1, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
                {review.amount}
              </Text>
              {!!review.caption && <Text style={{ color: p.fgMuted, fontSize: 15, marginTop: 4 }} numberOfLines={2}>{review.caption}</Text>}
            </View>
          )}
          {review.rows.map((row, i) => (
            <View key={`${row.label}-${i}`} style={{
              flexDirection: ar ? 'row-reverse' : 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
              paddingVertical: 14, borderTopWidth: 1, borderTopColor: p.border,
            }}>
              <Text style={{ color: p.fgMuted, fontSize: 14, textAlign: ar ? 'right' : 'left' }}>{row.label}</Text>
              <View style={{ flexShrink: 1, alignItems: ar ? 'flex-start' : 'flex-end' }}>
                <Text style={{ color: p.fg, fontSize: 15, fontWeight: '500', textAlign: ar ? 'left' : 'right' }}>{row.value}</Text>
                {!!row.sub && <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 2, textAlign: ar ? 'left' : 'right' }}>{row.sub}</Text>}
              </View>
            </View>
          ))}
          {!!review.footnote && (
            <Text style={{ color: p.fgFaint, fontSize: 12, lineHeight: 17, marginTop: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: p.border, textAlign: ar ? 'right' : 'left' }}>
              {review.footnote}
            </Text>
          )}
        </BottomSheet>
      )}
    </>
  );
}

export default ConfirmAction;
