/**
 * Onboarding scene visuals — one per chapter of the onboarding film.
 *
 * Each visual illustrates a real capability of the app. Sample figures are
 * marked "Example" so nothing on screen reads as a user's own balance or a
 * promised rate. All colours come from the active theme palette.
 */
import { ReactElement, ReactNode, useEffect } from 'react';
import { Image, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  cancelAnimation, Easing, FadeIn, FadeInDown, FadeInUp,
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { Text } from '@/components/ui/Text';
import type { Palette } from '@/store/themeStore';

export type SceneKey = 'intro' | 'wallets' | 'funding' | 'rate' | 'send' | 'explore' | 'security' | 'start';
type T = (key: string, vars?: Record<string, string | number>) => string;

interface SceneProps {
  p: Palette; t: T; width: number; height: number;
  /** Arabic: rows and chat sides mirror so text sits next to its icon/number. */
  isAr: boolean;
}

/* ── Shared pieces ─────────────────────────────────────────────────────── */

/** Soft accent glow behind a scene, drifting slowly (camera-move feel). */
export function AmbientGlow({ p, width, height }: { p: Palette; width: number; height: number }) {
  const reduce = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(drift);
  }, [reduce, drift]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -12 * drift.value },
      { scale: 1 + 0.06 * drift.value },
    ],
    opacity: 0.85 + 0.15 * drift.value,
  }));
  const size = Math.max(width, height) * 1.1;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: (width - size) / 2, top: (height - size) / 2 }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={p.accent} stopOpacity="0.28" />
            <Stop offset="0.55" stopColor={p.accent} stopOpacity="0.07" />
            <Stop offset="1" stopColor={p.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={size} height={size} fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}

/** Slow, subtle push-in on the whole visual. */
function Drift({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    v.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(v);
  }, [reduce, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.025 * v.value }, { translateY: -4 * v.value }] }));
  return <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>{children}</Animated.View>;
}

function ExampleTag({ p, t }: { p: Palette; t: T }) {
  return (
    <View style={{
      alignSelf: 'flex-start', paddingHorizontal: 8, height: 20, borderRadius: 10,
      justifyContent: 'center', backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
    }}>
      <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {t('onboard2.example')}
      </Text>
    </View>
  );
}

function Surface({ p, children, style }: { p: Palette; children: ReactNode; style?: object }) {
  return (
    <View style={[{
      backgroundColor: p.bgElev, borderRadius: 22, borderWidth: 1, borderColor: p.border,
      shadowColor: p.shadow, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
    }, style]}>
      {children}
    </View>
  );
}

/** Concentric rings that breathe outwards. */
function Rings({ p, size }: { p: Palette; size: number }) {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.out(Easing.quad) }), -1, false);
    return () => cancelAnimation(pulse);
  }, [reduce, pulse]);
  const outer = useAnimatedStyle(() => ({ transform: [{ scale: 0.85 + 0.3 * pulse.value }], opacity: 0.5 * (1 - pulse.value) }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: p.accent }, outer]} />
      {[0.78, 0.56].map((f) => (
        <View key={f} style={{
          position: 'absolute', width: size * f, height: size * f, borderRadius: (size * f) / 2,
          borderWidth: 1, borderColor: p.accentBorder,
        }} />
      ))}
    </View>
  );
}

/* ── Scenes ────────────────────────────────────────────────────────────── */

function IntroScene({ p, width, height }: SceneProps) {
  const ring = Math.min(width * 0.72, height * 0.82);
  const chips = [
    { code: 'LYD', x: -0.46, y: -0.26, d: 350 },
    { code: 'USD', x: 0.34, y: -0.36, d: 550 },
    { code: 'USDT', x: 0.40, y: 0.30, d: 750 },
  ];
  return (
    <Drift>
      <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
        <Rings p={p} size={ring} />
        <Animated.View entering={FadeIn.duration(900)} style={{
          width: 104, height: 104, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
          backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.accentBorder,
          shadowColor: p.accent, shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
        }}>
          <Image source={require('../../../assets/icon-asterisk.png')} style={{ width: 64, height: 64 }} resizeMode="contain" />
        </Animated.View>
        {chips.map((c) => (
          <Animated.View
            key={c.code}
            entering={FadeIn.delay(c.d).duration(700)}
            style={{
              position: 'absolute', left: ring / 2 + c.x * ring - 30, top: ring / 2 + c.y * ring - 15,
              height: 30, paddingHorizontal: 12, borderRadius: 15, justifyContent: 'center',
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            }}
          >
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 12, fontWeight: '700', letterSpacing: 0.4 }}>{c.code}</Text>
          </Animated.View>
        ))}
      </View>
    </Drift>
  );
}

function WalletsScene({ p, t, width, isAr }: SceneProps) {
  const cardW = Math.min(width - 48, 320);
  const cards = [
    { code: 'LYD', name: t('onboard2.v.lyd'), amount: '12,480.00', glyph: 'LD' },
    { code: 'USD', name: t('onboard2.v.usd'), amount: '1,250.00', glyph: '$' },
    { code: 'USDT', name: t('onboard2.v.usdt'), amount: '640.00', glyph: '₮' },
  ];
  const align = isAr ? 'right' as const : 'left' as const;
  return (
    <Drift>
      <View style={{ width: cardW, gap: 10 }}>
        {cards.map((c, i) => (
          <Animated.View key={c.code} entering={FadeInDown.delay(150 + i * 160).duration(650)}>
            <Surface p={p} style={{
              padding: 16, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: 14,
              borderColor: i === 0 ? p.accentBorder : p.border,
            }}>
              <View style={{
                width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                backgroundColor: i === 0 ? p.accentSoft : p.pillBg,
              }}>
                {c.code === 'USDT' ? <CoinIcon symbol="USDT" size={36} /> : <Text maxFontSizeMultiplier={1.1} style={{ color: i === 0 ? p.accentText : p.fg, fontSize: 15, fontWeight: '700' }}>{c.glyph}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 15, fontWeight: '600', textAlign: align }}>{c.code}</Text>
                <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 12, marginTop: 1, textAlign: align }}>{c.name}</Text>
              </View>
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{c.amount}</Text>
            </Surface>
          </Animated.View>
        ))}
        <Animated.View entering={FadeIn.delay(750)} style={{ alignItems: isAr ? 'flex-start' : 'flex-end' }}>
          <ExampleTag p={p} t={t} />
        </Animated.View>
      </View>
    </Drift>
  );
}

/** Quote card: rate, fees and what arrives — with the price-hold timer. */
function RateScene({ p, t, width, isAr }: SceneProps) {
  const row = isAr ? 'row-reverse' as const : 'row' as const;
  const cardW = Math.min(width - 48, 320);
  const reduce = useReducedMotion();
  const hold = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    hold.value = withDelay(600, withRepeat(withTiming(0, { duration: 6000, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(hold);
  }, [reduce, hold]);
  const holdStyle = useAnimatedStyle(() => ({ width: `${Math.max(6, hold.value * 100)}%` }));

  const chartW = cardW - 32;
  const line = 'M0 34 C 18 30, 30 36, 48 28 S 84 18, 104 22 S 140 30, 160 18 S 196 8, 216 12 S 250 16, 288 6';
  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <View style={{ flexDirection: row, justifyContent: 'space-between', paddingVertical: 7 }}>
      <Text maxFontSizeMultiplier={1.1} style={{ color: strong ? p.fg : p.fgMuted, fontSize: 13, fontWeight: strong ? '600' : '500' }}>{label}</Text>
      <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 13, fontWeight: strong ? '700' : '600', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );

  return (
    <Drift>
      <Animated.View entering={FadeInUp.duration(700)}>
        <Surface p={p} style={{ width: cardW, padding: 16 }}>
          <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 }}>USD → LYD</Text>
            <ExampleTag p={p} t={t} />
          </View>
          <View style={{ flexDirection: row, alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 34, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>6.8500</Text>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{t('onboard2.v.perUsd')}</Text>
          </View>
          <View style={{ marginTop: 10, marginBottom: 6 }}>
            <Svg width={chartW} height={40} viewBox="0 0 288 40" preserveAspectRatio="none">
              <Defs>
                <SvgGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={p.accent} stopOpacity="0.28" />
                  <Stop offset="1" stopColor={p.accent} stopOpacity="0" />
                </SvgGradient>
              </Defs>
              <Path d={`${line} L 288 40 L 0 40 Z`} fill="url(#fill)" />
              <Path d={line} stroke={p.accent} strokeWidth={2} fill="none" />
            </Svg>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: p.border, paddingTop: 6 }}>
            <Row label={t('onboard2.v.youPay')} value="100.00 USD" />
            <Row label={t('onboard2.v.fee')} value="1.00 USD" />
            <Row label={t('onboard2.v.youReceive')} value="678.15 LYD" strong />
          </View>
          <View style={{ marginTop: 10, flexDirection: row, alignItems: 'center', gap: 8 }}>
            <Ionicons name="lock-closed" size={12} color={p.accentText} />
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', flex: 1, textAlign: isAr ? 'right' : 'left' }}>{t('onboard2.v.locked')}</Text>
          </View>
          <View style={{ height: 3, borderRadius: 2, backgroundColor: p.pillBg, marginTop: 8, overflow: 'hidden' }}>
            <Animated.View style={[{ height: 3, borderRadius: 2, backgroundColor: p.accent }, holdStyle]} />
          </View>
        </Surface>
      </Animated.View>
    </Drift>
  );
}

function SendScene({ p, t, width, isAr }: SceneProps) {
  const w = Math.min(width - 48, 320);
  // In Arabic, chats mirror: the other person's messages sit on the right.
  const theirs = isAr ? 'flex-end' as const : 'flex-start' as const;
  const mine = isAr ? 'flex-start' as const : 'flex-end' as const;
  return (
    <Drift>
      <View style={{ width: w, gap: 10 }}>
        {/* Incoming message */}
        <Animated.View entering={FadeInDown.delay(100).duration(550)} style={{ alignSelf: theirs, maxWidth: '80%' }}>
          <View style={{
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, borderRadius: 18,
            ...(isAr ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }),
            paddingHorizontal: 14, paddingVertical: 10,
          }}>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 14 }}>{t('onboard2.v.chatAsk')}</Text>
          </View>
        </Animated.View>
        {/* Payment bubble */}
        <Animated.View entering={FadeInDown.delay(650).duration(550)} style={{ alignSelf: mine, width: '70%' }}>
          <View style={{
            backgroundColor: p.accent, borderRadius: 18, padding: 14,
            ...(isAr ? { borderBottomLeftRadius: 6 } : { borderBottomRightRadius: 6 }),
          }}>
            <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={14} color={p.accentFg} />
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.accentFg, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 }}>{t('onboard2.v.paid')}</Text>
            </View>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.accentFg, fontSize: 24, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'], textAlign: isAr ? 'right' : 'left' }}>45.00 LYD</Text>
          </View>
        </Animated.View>
        {/* Claim link */}
        <Animated.View entering={FadeInDown.delay(1250).duration(550)}>
          <Surface p={p} style={{ padding: 14, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: p.accentSoft }}>
              <Ionicons name="link" size={18} color={p.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 14, fontWeight: '600', textAlign: isAr ? 'right' : 'left' }}>{t('onboard2.v.claimLink')} · 50.00 USD</Text>
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 12, marginTop: 2, textAlign: isAr ? 'right' : 'left' }} numberOfLines={1}>{t('onboard2.v.claimTo')}</Text>
            </View>
          </Surface>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(1600)} style={{ alignItems: isAr ? 'flex-start' : 'flex-end' }}>
          <ExampleTag p={p} t={t} />
        </Animated.View>
      </View>
    </Drift>
  );
}

function SecurityScene({ p, t, width, height }: SceneProps) {
  const ring = Math.min(width * 0.46, height * 0.36);
  const items = ['onboard2.v.sec1', 'onboard2.v.sec2', 'onboard2.v.sec3', 'onboard2.v.sec4'];
  return (
    <Drift>
      <View style={{ alignItems: 'center', gap: 18 }}>
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          <Rings p={p} size={ring} />
          <Animated.View entering={FadeIn.duration(700)} style={{
            width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
            backgroundColor: p.accentSoft, borderWidth: 1, borderColor: p.accentBorder,
          }}>
            <Ionicons name="shield-checkmark" size={36} color={p.accentText} />
          </Animated.View>
        </View>
        <View style={{ width: Math.min(width - 48, 320), flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {items.map((key, i) => (
            <Animated.View key={key} entering={FadeInDown.delay(400 + i * 180).duration(500)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              height: 34, paddingHorizontal: 12, borderRadius: 17,
              backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            }}>
              <Ionicons name="checkmark-circle" size={15} color={p.greenFg} />
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>{t(key)}</Text>
            </Animated.View>
          ))}
        </View>
      </View>
    </Drift>
  );
}

function StartScene({ p, t, width, isAr }: SceneProps) {
  const w = Math.min(width - 48, 320);
  const steps = [1, 2, 3];
  return (
    <Drift>
      <View style={{ width: w }}>
        {steps.map((n, i) => (
          <Animated.View key={n} entering={FadeInDown.delay(150 + i * 220).duration(550)} style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 14 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{
                width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                backgroundColor: n === 1 ? p.accent : p.bgElev, borderWidth: 1, borderColor: n === 1 ? p.accent : p.border,
              }}>
                <Text maxFontSizeMultiplier={1.1} style={{ color: n === 1 ? p.accentFg : p.fg, fontSize: 14, fontWeight: '700' }}>{n}</Text>
              </View>
              {i < steps.length - 1 && <View style={{ width: 1, flex: 1, minHeight: 26, backgroundColor: p.border, marginVertical: 4 }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 18 : 0, paddingTop: 6 }}>
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 16, fontWeight: '600', textAlign: isAr ? 'right' : 'left' }}>{t(`onboard2.step${n}.title`)}</Text>
              <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 13, lineHeight: isAr ? 22 : 18, marginTop: 3, textAlign: isAr ? 'right' : 'left' }}>{t(`onboard2.step${n}.body`)}</Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </Drift>
  );
}

function FundingScene({ p, t, width, isAr }: SceneProps) {
  return (
    <View style={{ width: Math.min(width - 56, 320), gap: 10 }}>
      {(['bank', 'crypto', 'member'] as const).map((method, i) => (
        <Surface key={method} p={p} style={{ padding: 18, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            {method === 'crypto' ? <CoinIcon symbol="BTC" size={32} /> : <Ionicons name={method === 'bank' ? 'business-outline' : 'person-outline'} size={21} color={p.accentText} />}
          </View>
          <Text maxFontSizeMultiplier={1.1} style={{ flex: 1, color: p.fg, fontSize: 15, fontWeight: '500', textAlign: isAr ? 'right' : 'left' }}>{t(`tour.funding.${method}`)}</Text>
          <Ionicons name="add" size={18} color={p.fgMuted} />
        </Surface>
      ))}
    </View>
  );
}

function ExploreScene({ p, t, width, isAr }: SceneProps) {
  const items = [{ key: 'budgets', icon: 'pie-chart-outline' }, { key: 'p2p', icon: 'swap-horizontal-outline' }, { key: 'cards', icon: 'card-outline' }] as const;
  return (
    <View style={{ width: Math.min(width - 56, 320), gap: 10 }}>
      {items.map(({ key, icon }) => (
        <Surface key={key} p={p} style={{ padding: 16, flexDirection: isAr ? 'row-reverse' : 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={22} color={p.accentText} /></View>
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fg, fontSize: 15, fontWeight: '600', textAlign: isAr ? 'right' : 'left' }}>{t(`tour.explore.${key}`)}</Text>
            <Text maxFontSizeMultiplier={1.1} style={{ color: p.fgMuted, fontSize: 12, marginTop: 4, textAlign: isAr ? 'right' : 'left' }}>{t(`tour.explore.${key}Note`)}</Text>
          </View>
        </Surface>
      ))}
    </View>
  );
}

const SCENES: Record<SceneKey, (props: SceneProps) => ReactElement> = {
  intro: IntroScene,
  wallets: WalletsScene,
  funding: FundingScene,
  explore: ExploreScene,
  rate: RateScene,
  send: SendScene,
  security: SecurityScene,
  start: StartScene,
};

export function SceneVisual({ scene, ...props }: SceneProps & { scene: SceneKey }) {
  const Scene = SCENES[scene];
  return <Scene {...props} />;
}
