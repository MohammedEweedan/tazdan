/**
 * Home button + quick select.
 *
 *  - Tap the home button → Home.
 *  - Hold it (or slide up from it) → the screen above the tab bar blurs and
 *    the quick actions fan out in a curved pill above the button. Slide toward one and let go
 *    to run it; the nearest action by angle is picked, so a rough flick
 *    works.
 *  - Hold and let go without moving → the menu stays open for tapping.
 *
 * The overlay is a sibling of the tab navigator (not a Modal) so the touch
 * that opened it keeps flowing to the button's responder while the finger
 * slides over the actions.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, PanResponder, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue,
  withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/store/i18nStore';

export interface QuickAction {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onSelect: () => void;
}

type Mode = 'closed' | 'drag' | 'tap' | 'closing';
interface Point { x: number; y: number }

export const FAB_SIZE = 62;
const MARK_SIZE = 30;
const LONG_PRESS_MS = 260;
/** Sliding up this far from the button opens the menu without waiting. */
const SWIPE_OPEN_PX = 14;
/** Distance from the button centre to each action's centre. */
const ARC_RADIUS = 108;
const ACTION_SIZE = 58;
/** Thickness of the curved pill behind the actions. */
const PILL_THICKNESS = ACTION_SIZE + 14;
/** The finger must be at least this far from the button to pick anything. */
const PICK_MIN_DIST = 40;
const PICK_MAX_ANGLE = 38;

/** Angles (degrees, 0 = right, 90 = straight up) spread across the upper arc. */
function arcAngles(n: number): number[] {
  if (n === 1) return [90];
  const from = 150;
  const to = 30;
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

function offsetFor(angle: number, radius = ARC_RADIUS): Point {
  const rad = (angle * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: -radius * Math.sin(rad) };
}

/** Index of the action the finger points at, or -1. */
function pick(finger: Point, center: Point, angles: number[]): number {
  const dx = finger.x - center.x;
  const dy = finger.y - center.y;
  if (Math.hypot(dx, dy) < PICK_MIN_DIST || dy > 24) return -1;
  const a = (Math.atan2(-dy, dx) * 180) / Math.PI;
  let best = -1;
  let bestDiff = Infinity;
  angles.forEach((ang, i) => {
    const diff = Math.abs(ang - a);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  });
  return bestDiff <= PICK_MAX_ANGLE ? best : -1;
}

/** Shared state between the button (in the tab bar) and the overlay (above everything). */
export function useQuickSelect(actions: QuickAction[]) {
  const h = useHaptics();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>('closed');
  const [center, setCenter] = useState<Point>({ x: 0, y: 0 });
  const progress = useSharedValue(0);
  const active = useSharedValue(-1);
  const angles = useMemo(() => arcAngles(actions.length), [actions.length]);

  const open = useCallback((at: Point, how: 'drag' | 'tap') => {
    setCenter(at);
    active.value = -1;
    setMode(how);
    h.medium();
    progress.value = reduceMotion
      ? withTiming(1, { duration: 140 })
      : withSpring(1, { damping: 18, stiffness: 220, mass: 0.7 });
  }, [active, h, progress, reduceMotion]);

  const close = useCallback(() => {
    setMode((m) => (m === 'closed' ? m : 'closing'));
    active.value = -1;
    progress.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) }, (done) => {
      if (done) runOnJS(setMode)('closed');
    });
  }, [active, progress]);

  const commit = useCallback((index: number) => {
    const action = actions[index];
    close();
    if (action) { h.success(); action.onSelect(); }
  }, [actions, close, h]);

  // Android back closes the menu instead of leaving the screen.
  useEffect(() => {
    if (mode === 'closed' || mode === 'closing') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [mode, close]);

  return { actions, angles, mode, center, progress, active, open, close, commit, setMode };
}

export type QuickSelectController = ReturnType<typeof useQuickSelect>;

/* ── Brand mark ─────────────────────────────────────────────────────── */

function BrandMark({ size, mono }: { size: number; mono: boolean }) {
  return (
    <Image
      source={mono ? require('../../../assets/icon-asterisk-black.png') : require('../../../assets/icon-asterisk.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

/** The disc itself — black on light, white on dark (the theme's CTA colour). */
function FabDisc({ pressed, style }: { pressed?: boolean; style?: ViewStyle }) {
  const p = useThemedPalette();
  const mode = useTheme((s) => s.mode);
  const mono = mode === 'mono';
  return (
    <View style={[{
      width: FAB_SIZE, height: FAB_SIZE, borderRadius: FAB_SIZE / 2,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: p.ctaBg,
      borderWidth: 4, borderColor: p.bgElev,
      shadowColor: mode === 'light' ? '#000000' : mono ? '#000000' : p.accent,
      shadowOpacity: mode === 'light' ? 0.22 : 0.2,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      transform: [{ scale: pressed ? 0.93 : 1 }],
    }, style]}>
      <BrandMark size={MARK_SIZE} mono={mono} />
    </View>
  );
}

/* ── Button (lives in the tab bar) ──────────────────────────────────── */

export function HomeFab({ qs, onPress, label, hint, selected }: {
  qs: QuickSelectController;
  onPress: () => void;
  label: string;
  hint: string;
  selected?: boolean;
}) {
  const h = useHaptics();
  const ref = useRef<View>(null);
  const [pressed, setPressed] = useState(false);
  // PanResponder handlers are created once; read the latest values via refs.
  const latest = useRef({ qs, onPress });
  latest.current = { qs, onPress };
  const g = useRef({ timer: 0 as unknown as ReturnType<typeof setTimeout>, opened: false, center: { x: 0, y: 0 }, openedAt: { x: 0, y: 0 }, moved: 0, last: -1 });

  const measure = () => new Promise<Point>((resolve) => {
    ref.current?.measureInWindow((x, y, w, hgt) => resolve({ x: x + w / 2, y: y + hgt / 2 }));
  });

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => !g.current.opened,
    onPanResponderGrant: (e) => {
      setPressed(true);
      const s = g.current;
      s.opened = false; s.moved = 0; s.last = -1;
      const touch = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      measure().then((c) => { s.center = c; });
      s.timer = setTimeout(() => {
        s.opened = true;
        s.openedAt = touch;
        latest.current.qs.open(s.center, 'drag');
      }, LONG_PRESS_MS);
    },
    onPanResponderMove: (_e, gs) => {
      const s = g.current;
      const { qs: c } = latest.current;
      if (!s.opened) {
        if (gs.dy < -SWIPE_OPEN_PX) {
          clearTimeout(s.timer);
          s.opened = true;
          s.openedAt = { x: gs.x0, y: gs.y0 };
          c.open(s.center, 'drag');
        } else {
          return;
        }
      }
      s.moved = Math.max(s.moved, Math.hypot(gs.moveX - s.openedAt.x, gs.moveY - s.openedAt.y));
      const idx = pick({ x: gs.moveX, y: gs.moveY }, s.center, c.angles);
      if (idx !== s.last) {
        s.last = idx;
        c.active.value = idx;
        if (idx >= 0) h.selection();
      }
    },
    onPanResponderRelease: () => {
      const s = g.current;
      const { qs: c, onPress: tap } = latest.current;
      clearTimeout(s.timer);
      setPressed(false);
      if (!s.opened) { tap(); return; }
      if (s.last >= 0) c.commit(s.last);
      else if (s.moved < 10) c.setMode('tap'); // held still — leave it open for tapping
      else c.close();
    },
    onPanResponderTerminate: () => {
      const s = g.current;
      clearTimeout(s.timer);
      setPressed(false);
      if (s.opened) latest.current.qs.close();
    },
  }), [h]);

  // Tab-bar re-renders must not leave a timer running.
  useEffect(() => () => clearTimeout(g.current.timer), []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
      <View
        ref={ref}
        {...responder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ selected }}
        accessibilityActions={qs.actions.map((a) => ({ name: a.key, label: a.label }))}
        onAccessibilityAction={(e) => {
          const i = qs.actions.findIndex((a) => a.key === e.nativeEvent.actionName);
          if (i >= 0) qs.actions[i].onSelect();
        }}
        style={{ marginTop: -22 }}
      >
        <FabDisc pressed={pressed || qs.mode === 'drag'} />
      </View>
    </View>
  );
}

/* ── Overlay (rendered above the whole tab navigator) ───────────────── */

/** Arc from the first action's angle to the last, as an SVG path around (cx, cy). */
function arcPath(cx: number, cy: number, angles: number[]): string {
  const a = offsetFor(angles[0]);
  const b = offsetFor(angles[angles.length - 1]);
  const sweep = angles[0] > angles[angles.length - 1] ? 1 : 0; // left → over the top → right
  return `M ${cx + a.x} ${cy + a.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${sweep} ${cx + b.x} ${cy + b.y}`;
}

/**
 * Everything above the tab bar blurs; the bar, the button and the fan stay
 * sharp. `barHeight` is the tab bar's full height so the blur stops at its top edge.
 */
export function QuickSelectOverlay({ qs, barHeight }: { qs: QuickSelectController; barHeight: number }) {
  const p = useThemedPalette();
  const t = useT();
  const mode = useTheme((s) => s.mode);
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });
  const rootRef = useRef<View>(null);

  // The pill's bounding box: wide enough for the round end caps, tall from
  // the top of the arc down to the button centre (the scale origin).
  const boxHalfW = ARC_RADIUS + PILL_THICKNESS / 2 + 2;
  const boxH = ARC_RADIUS + PILL_THICKNESS / 2 + 2;

  const backdrop = useAnimatedStyle(() => ({ opacity: qs.progress.value }));
  const pill = useAnimatedStyle(() => ({
    opacity: qs.progress.value,
    // Grow out of the button: scale about the box's bottom-centre.
    transform: [
      { translateY: boxH / 2 },
      { scale: 0.3 + 0.7 * qs.progress.value },
      { translateY: -boxH / 2 },
    ],
  }));

  if (qs.mode === 'closed') return null;
  const c = { x: qs.center.x - origin.x, y: qs.center.y - origin.y };
  const interactive = qs.mode === 'tap';
  const path = arcPath(boxHalfW, boxH, qs.angles);

  return (
    <View
      ref={rootRef}
      onLayout={() => rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
      style={StyleSheet.absoluteFill}
      // The tab bar below the blur stays usable: tapping a tab closes the menu.
      pointerEvents={interactive ? 'box-none' : 'none'}
    >
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: barHeight }, backdrop]}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={45} tint={mode === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
          : null}
        <View style={[StyleSheet.absoluteFill, {
          backgroundColor: mode === 'light'
            ? (Platform.OS === 'ios' ? 'rgba(10,10,11,0.08)' : 'rgba(250,250,247,0.86)')
            : (Platform.OS === 'ios' ? 'rgba(0,0,0,0.30)' : 'rgba(12,13,16,0.86)'),
        }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={qs.close} accessibilityRole="button" accessibilityLabel={t('common.close')} />
      </Animated.View>

      {/* Curved pill the actions sit in — a thick round-capped stroke along their arc. */}
      <Animated.View pointerEvents="none" style={[{
        position: 'absolute', left: c.x - boxHalfW, top: c.y - boxH,
        width: boxHalfW * 2, height: boxH,
      }, pill]}>
        <Svg width={boxHalfW * 2} height={boxH}>
          <SvgPath d={path} stroke={p.border} strokeWidth={PILL_THICKNESS + 2} strokeLinecap="round" fill="none" />
          <SvgPath d={path} stroke={p.bgElev} strokeWidth={PILL_THICKNESS} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>

      {qs.actions.map((a, i) => (
        <ActionBubble key={a.key} action={a} index={i} center={c} angle={qs.angles[i]}
          progress={qs.progress} active={qs.active} onPress={() => qs.commit(i)} />
      ))}

      {/* A crisp copy of the button, in case the blur edge crosses it; tap to close. */}
      <Pressable
        onPress={qs.close}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        style={{ position: 'absolute', left: c.x - FAB_SIZE / 2, top: c.y - FAB_SIZE / 2 }}
      >
        <FabDisc pressed={qs.mode === 'drag'} />
      </Pressable>
    </View>
  );
}

function ActionBubble({ action, index, center, angle, progress, active, onPress }: {
  action: QuickAction; index: number; center: Point; angle: number;
  progress: SharedValue<number>; active: SharedValue<number>; onPress: () => void;
}) {
  const p = useThemedPalette();
  const off = offsetFor(angle);
  const outer = offsetFor(angle, ARC_RADIUS + PILL_THICKNESS / 2 + 18);
  const labelOff = { x: outer.x - off.x, y: outer.y - off.y };

  const wrap = useAnimatedStyle(() => {
    const on = active.value === index;
    return {
      opacity: progress.value,
      transform: [
        { translateX: off.x * progress.value },
        { translateY: off.y * progress.value },
        { scale: withTiming(on ? 1.16 : 1, { duration: 120 }) },
      ],
    };
  });
  const bubble = useAnimatedStyle(() => {
    const on = active.value === index;
    return {
      backgroundColor: on ? p.accent : p.bgRaised,
      borderColor: on ? p.accent : p.border,
    };
  });
  const iconOn = useAnimatedStyle(() => ({ opacity: withTiming(active.value === index ? 1 : 0, { duration: 100 }) }));
  const iconOff = useAnimatedStyle(() => ({ opacity: withTiming(active.value === index ? 0 : 1, { duration: 100 }) }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: center.x - ACTION_SIZE / 2, top: center.y - ACTION_SIZE / 2,
      width: ACTION_SIZE, alignItems: 'center',
    }, wrap]}>
      {/* Label sits outside the pill along the action's own angle, clear of
          the pill and of the finger. The fixed-width box centres it. */}
      <View pointerEvents="none" style={{
        position: 'absolute', width: 120, height: 18, alignItems: 'center', justifyContent: 'center',
        left: ACTION_SIZE / 2 - 60 + labelOff.x, top: ACTION_SIZE / 2 - 9 + labelOff.y,
      }}>
        <Text numberOfLines={1} style={{ color: p.fg, fontSize: 12.5, fontWeight: '600' }}>
          {action.label}
        </Text>
      </View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={action.label}>
        <Animated.View style={[{
          width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: ACTION_SIZE / 2,
          alignItems: 'center', justifyContent: 'center', borderWidth: 1,
          shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }, bubble]}>
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, iconOff]}>
            <Ionicons name={action.icon} size={22} color={p.fg} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, iconOn]}>
            <Ionicons name={action.icon} size={22} color={p.accentFg} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
