/**
 * OnboardingHero — premium visual backdrops for onboarding slides.
 *
 *   Variant 1: Four rows of crypto logos drifting in alternating directions.
 *   Variant 2: Animated phone mockup replicating the client landing-page
 *              chat screen — sequential message reveals, typing indicators,
 *              payment cards, live composer cursor.
 *   Variant 3: Minimal breathing brand glow for the CTA page.
 *
 *   The hero is transparent; the parent page owns the solid background.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { View, Image, Dimensions, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useCoinIcons } from '@/hooks/useCoinIcons';
import { brand } from '@/store/themeStore';
import { ShaderLines } from './ShaderLines';

/** Brand accent (soft pantone blue #63a1db) used for the "Join" word. */
const ACCENT = '#63A1DB';

const { width: W } = Dimensions.get('window');

interface Props {
  bg: string;
  variant?: 1 | 2 | 3;
}

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 1 — Crypto carousel
   ═══════════════════════════════════════════════════════════════════ */

const COINS_A = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','UNI','INJ','RENDER','IMX','GRT'];
const COINS_B = ['LTC','ATOM','TRX','NEAR','FIL','ALGO','VET','XLM','AAVE','ARB','OP','SUI','SEI','TIA','WLD','RON'];
const COINS_C = ['ICP','APT','FET','ENA','STRK','JUP','PYTH','BEAM','ZRO','ARKM','LDO','SAND','MANA','FLOW','XTZ','EGLD'];
const COINS_D = ['FTM','KAS','BONK','PEPE','SHIB','FLOKI','WIF','BOME','TIA','MKR','COMP','CRV','SNX','YFI','ENS','DYDX'];
const COINS_E = ['SUI','SEI','TIA','WLD','RON','ICP','APT','FET','ENA','STRK','JUP','PYTH','BEAM','ZRO','ARKM','LDO'];

const ROW_A = [...COINS_A, ...COINS_A];
const ROW_B = [...COINS_B, ...COINS_B];
const ROW_C = [...COINS_C, ...COINS_C];
const ROW_D = [...COINS_D, ...COINS_D];
const ROW_E = [...COINS_E, ...COINS_E];

const TILE_W = 56;
const GAP = 14;
const ITEM_W = TILE_W + GAP;

function CoinTile({ sym, getIconUrl }: { sym: string; getIconUrl: (s: string) => string }) {
  return (
    <View style={tileStyles.tile}>
      <Image source={{ uri: getIconUrl(sym) }} style={tileStyles.icon} resizeMode="contain" />
    </View>
  );
}

function ScrollRow({ coins, reverse, getIconUrl, speed }: {
  coins: string[]; reverse: boolean; getIconUrl: (s: string) => string; speed: number;
}) {
  const loopW = (coins.length / 2) * ITEM_W;
  const x = useSharedValue(reverse ? -loopW : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const target = reverse ? 0 : -loopW;
    x.value = withRepeat(withTiming(target, { duration: speed, easing: Easing.linear }), -1, false);
  }, [loopW, reverse, speed, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={tileStyles.rowClip}>
      <Animated.View style={[tileStyles.row, style]}>
        {coins.map((sym, i) => (
          <CoinTile key={`${sym}-${i}`} sym={sym} getIconUrl={getIconUrl} />
        ))}
      </Animated.View>
    </View>
  );
}

const tileStyles = StyleSheet.create({
  rowClip: { width: '100%', overflow: 'hidden' },
  row: { flexDirection: 'row', paddingVertical: 4 },
  tile: { width: TILE_W, height: TILE_W, marginRight: GAP, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, opacity: 0.9 },
});

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 2 — Animated phone mockup (matches client ScreenChat)
   ═══════════════════════════════════════════════════════════════════ */

type ChatItem =
  | { type: 'day'; text: string; delay: number }
  | { type: 'in' | 'out'; text: string; time: string; delay: number }
  | { type: 'typing'; delay: number }
  | { type: 'emoji'; text: string; delay: number }
  | { type: 'card'; big: string; unit: string; sub: string; ref: string; time: string; delay: number };

const CHAT_TIMELINE: ChatItem[] = [
  { type: 'day', text: 'TODAY', delay: 400 },
  { type: 'in', text: 'Can you send me $50 for dinner?', time: '9:41 AM', delay: 800 },
  { type: 'typing', delay: 1000 },
  { type: 'card', big: '$50.00', unit: 'USD', sub: 'You received a payment from Jack Green', ref: 'Completed', time: '9:42 AM', delay: 1600 },
  { type: 'out', text: 'On my way! 🍕', time: '9:42 AM', delay: 1200 },
  { type: 'emoji', text: '🙏', delay: 600 },
];

function PhoneMockup({ isDark }: { isDark: boolean }) {
  /* Color tokens — exact match to client ScreenChat */
  const c = isDark
    ? { bg: '#0e0e10', headerBg: '#161618', surface: '#1f1f23',
        border: 'rgba(255,255,255,0.07)', fg: '#ffffff', muted: '#8a8a92', faint: '#5b5b63' }
    : { bg: '#ffffff', headerBg: '#f6f6f7', surface: '#f0f0f2',
        border: 'rgba(0,0,0,0.07)', fg: '#15140f', muted: '#8b897e', faint: '#b6b4a8' };
  const accent = '#226dff';
  const green = '#3ecf6e';

  /* Sequential reveal */
  const [n, setN] = useState(0);
  useEffect(() => {
    const atEnd = n >= CHAT_TIMELINE.length;
    const delay = atEnd ? 3000 : CHAT_TIMELINE[n].delay;
    const id = setTimeout(() => setN(atEnd ? 0 : n + 1), delay);
    return () => clearTimeout(id);
  }, [n]);

  /* Reanimated entrance values */
  const msgOp = useSharedValue(0);
  const msgY = useSharedValue(10);
  useEffect(() => {
    msgOp.value = 0;
    msgY.value = 10;
    msgOp.value = withSpring(1, { damping: 18, stiffness: 200 });
    msgY.value = withSpring(0, { damping: 18, stiffness: 200 });
  }, [n, msgOp, msgY]);

  const msgStyle = useAnimatedStyle(() => ({
    opacity: msgOp.value,
    transform: [{ translateY: msgY.value }],
  }));

  const renderItem = (it: ChatItem, i: number) => {
    if (it.type === 'day') {
      return (
        <Animated.View key={`day-${i}`} style={[{ alignSelf: 'center' }, msgStyle]}>
          <View style={{
            backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
            borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3,
          }}>
            <Text style={{ fontSize: 8, color: c.muted, fontWeight: '800', letterSpacing: 0.6 }}>{it.text}</Text>
          </View>
        </Animated.View>
      );
    }
    if (it.type === 'emoji') {
      return (
        <Animated.View key={`emoji-${i}`} style={[{ alignSelf: 'flex-start' }, msgStyle]}>
          <Text style={{ fontSize: 22, lineHeight: 26 }}>{it.text}</Text>
        </Animated.View>
      );
    }
    if (it.type === 'typing') {
      return (
        <Animated.View key={`typing-${i}`} style={[{ alignSelf: 'flex-start' }, msgStyle]}>
          <View style={{
            backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
            borderRadius: 14, borderBottomLeftRadius: 4,
            paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 4,
          }}>
            {[0, 1, 2].map((d) => (
              <View key={d} style={{
                width: 5, height: 5, borderRadius: 2.5, backgroundColor: c.muted,
                opacity: 0.4 + d * 0.3,
              }} />
            ))}
          </View>
        </Animated.View>
      );
    }
    if (it.type === 'card') {
      return (
        <Animated.View key={`card-${i}`} style={[{ alignSelf: 'flex-start', width: '78%' }, msgStyle]}>
          <View style={{
            backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
            borderRadius: 14, padding: 10, gap: 8,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: isDark ? 'rgba(62,207,110,0.12)' : 'rgba(62,207,110,0.14)',
                borderWidth: 2, borderColor: green,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons name="checkmark" size={14} color={green} />
              </View>
              <View>
                <Text style={{ fontSize: 7, color: c.muted, fontWeight: '800', letterSpacing: 0.5 }}>YOU RECEIVED</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                  <Text style={{ fontSize: 14, color: c.fg, fontWeight: '800' }}>{it.big}</Text>
                  <Text style={{ fontSize: 9, color: c.muted, fontWeight: '700' }}>{it.unit}</Text>
                </View>
              </View>
            </View>
            <Text style={{ fontSize: 9, color: c.fg, fontWeight: '700' }}>{it.sub}</Text>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: green }} />
                <Text style={{ fontSize: 7, color: c.faint, fontWeight: '700', letterSpacing: 0.4 }}>{it.ref}</Text>
              </View>
              <Text style={{ fontSize: 7, color: c.faint, fontWeight: '700' }}>{it.time}</Text>
            </View>
          </View>
        </Animated.View>
      );
    }
    return (
      <Animated.View key={`msg-${i}`} style={[{ alignSelf: it.type === 'out' ? 'flex-end' : 'flex-start', maxWidth: '82%' }, msgStyle]}>
        <View style={{ gap: 2 }}>
          <View style={{
            backgroundColor: it.type === 'out' ? accent : c.surface,
            borderWidth: it.type === 'in' ? 1 : 0,
            borderColor: it.type === 'in' ? c.border : 'transparent',
            borderRadius: 14,
            borderBottomRightRadius: it.type === 'out' ? 4 : 14,
            borderBottomLeftRadius: it.type === 'in' ? 4 : 14,
            paddingHorizontal: 11, paddingVertical: 8,
          }}>
            <Text style={{
              fontSize: 10, color: it.type === 'out' ? '#fff' : c.fg,
              fontWeight: '500', lineHeight: 14,
            }}>{it.text}</Text>
          </View>
          <Text style={{ fontSize: 7, color: c.faint, paddingHorizontal: 3, alignSelf: it.type === 'out' ? 'flex-end' : 'flex-start' }}>
            {it.time}
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 220, height: 340, borderRadius: 36,
        backgroundColor: c.bg,
        borderWidth: 1.5,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: isDark ? 0.55 : 0.10,
        shadowOffset: { width: 0, height: 20 },
        shadowRadius: 40,
        elevation: 8,
      }}>
        {/* Thread — bubbles only, no header, no composer */}
        <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8, justifyContent: 'flex-end', gap: 6 }}>
          {CHAT_TIMELINE.slice(0, n).map((it, i) => renderItem(it, i))}
        </View>

      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BRAND ICON — large tazdan icon with breathing pulse
   ═══════════════════════════════════════════════════════════════════ */

function BrandIcon({ isDark }: { isDark: boolean }) {
  const pulse = useSharedValue(1);
  // The brand MARK in its true blue (icon-color) — sits under the "Join"
  // word for the final onboarding lockup.
  const iconSrc = require('../../../assets/icon-color.png');

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.08, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Image
        source={iconSrc}
        style={{ width: 84, height: 84 }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VARIANT 3 — Breathing brand glow
   ═══════════════════════════════════════════════════════════════════ */

function BrandGlow({ isDark }: { isDark: boolean }) {
  const opacity = useSharedValue(isDark ? 0.22 : 0.12);
  useEffect(() => {
    const lo = isDark ? 0.18 : 0.08;
    const hi = isDark ? 0.32 : 0.18;
    opacity.value = lo;
    opacity.value = withRepeat(
      withTiming(hi, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1, true,
    );
  }, [isDark, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[glowStyles.glow, style]}>
      <LinearGradient
        colors={[brand.primaryDark, `${brand.primaryDark}00`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

const glowStyles = StyleSheet.create({
  glow: {
    position: 'absolute',
    width: W * 1.6,
    height: W * 1.6,
    borderRadius: W * 0.8,
    top: -W * 0.45,
  },
});

/* ═══════════════════════════════════════════════════════════════════
   Exported hero
   ═══════════════════════════════════════════════════════════════════ */

export const OnboardingHero = memo(function OnboardingHero({ bg, variant = 1 }: Props) {
  const getIconUrl = useCoinIcons();
  const normalizedBg = bg.toLowerCase();
  const isDark = normalizedBg === '#000000' || normalizedBg === '#0a0a0b' || normalizedBg === '#111111';
  const edgeMaskColor = bg;

  const edgeLeft = (
    <LinearGradient pointerEvents="none"
      colors={[edgeMaskColor, `${edgeMaskColor}00`]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      style={[sharedStyles.edgeMask, { left: 0 }]} />
  );
  const edgeRight = (
    <LinearGradient pointerEvents="none"
      colors={[`${edgeMaskColor}00`, edgeMaskColor]}
      start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
      style={[sharedStyles.edgeMask, { right: 0 }]} />
  );

  if (variant === 2) {
    return (
      <View style={sharedStyles.root}>
        <BrandGlow isDark={isDark} />
        <PhoneMockup isDark={isDark} />
        {edgeLeft}{edgeRight}
      </View>
    );
  }

  if (variant === 3) {
    return (
      <View style={sharedStyles.root}>
        {/* Shader lines as a subtle backdrop — kept dim from the start so they
            never fight the foreground lockup for contrast. */}
        <ShaderLines opacity={0.28} />

        {/* Centered lockup: "Join" (accent) stacked ABOVE the brand mark. */}
        <View style={{ alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <Text style={{
            fontSize: 30, fontWeight: '800', color: ACCENT, letterSpacing: -0.8, marginBottom: 12,
          }}>
            Join
          </Text>
          <BrandIcon isDark={isDark} />
        </View>

        {edgeLeft}{edgeRight}
      </View>
    );
  }

  // Variant 1
  return (
    <View style={sharedStyles.root}>
      <BrandGlow isDark={isDark} />
      <View style={sharedStyles.rows}>
        <ScrollRow coins={ROW_A} reverse={false} getIconUrl={getIconUrl} speed={32000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_B} reverse getIconUrl={getIconUrl} speed={26000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_C} reverse={false} getIconUrl={getIconUrl} speed={36000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_D} reverse getIconUrl={getIconUrl} speed={28000} />
      </View>
      {edgeLeft}{edgeRight}
    </View>
  );
});

const sharedStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rows: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  edgeMask: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: W * 0.12,
  },
});

export type HeroTone = 'primary' | 'aurora' | 'spotlight';
