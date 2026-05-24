/**
 * OnboardingHero — luxe brand ticker.
 *
 * Two rows of real coin logos drift in opposite directions over a
 * monochrome brand-color backdrop. Each tile is a frosted glass card
 * with a brand-tinted rim and a soft inner highlight, lifting off a
 * radial brand glow that breathes.
 *
 * Visual language:
 *   - Backdrop: brand periwinkle → near-black (dark) / brand soft →
 *     off-white (light), single hue family, no rainbow.
 *   - Tiles: dark-glass capsule, 1px brand rim at ~22% alpha, inner
 *     highlight stroke for "cut glass" depth.
 *   - Logos: rendered at 90% opacity so they read as a cohesive
 *     monochrome ribbon rather than a confetti of brand colors.
 *   - Edge masks: linear gradients fade the strip out at the left/right
 *     so tiles slide off cleanly instead of hard-cutting.
 *   - Center spotlight: a soft brand halo behind the middle column so
 *     the eye lands there first.
 */

import { memo, useEffect, useRef } from 'react';
import { View, Image, Dimensions, StyleSheet } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useCoinIcons } from '@/hooks/useCoinIcons';
import { brand } from '@/store/themeStore';

const { width: W } = Dimensions.get('window');

interface Props {
  fg: string;
  bg: string;
  variant?: 1 | 2 | 3;
}

// ── Two distinct coin sets — rows never mirror each other ─────────────────────
const COINS_A = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','UNI'];
const COINS_B = ['LTC','ATOM','TRX','NEAR','FIL','ALGO','VET','XLM','AAVE','ARB','OP','SUI'];

const ROW_A = [...COINS_A, ...COINS_A];
const ROW_B = [...COINS_B, ...COINS_B];

// ── Tile constants — slightly larger + more breathing room ────────────────────
const TILE_W = 78;
const TILE_H = 92;
const GAP    = 14;
const ITEM_W = TILE_W + GAP;

// ── Single coin tile — glass capsule with brand-tinted rim ────────────────────
function CoinTile({
  sym,
  getIconUrl,
  isDark,
}: {
  sym: string;
  getIconUrl: (s: string) => string;
  isDark: boolean;
}) {
  const fg = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(13,27,75,0.85)';
  const tileBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)';
  const rim = `${brand.primaryDark}38`;       // ~22% brand
  const innerHighlight = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.65)';
  const iconCircleBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,75,0.04)';
  const iconCircleRim = `${brand.primaryDark}33`;

  return (
    <View
      style={[
        styles.tile,
        {
          backgroundColor: tileBg,
          borderColor: rim,
          shadowColor: brand.primaryDark,
          shadowOpacity: isDark ? 0.35 : 0.18,
        },
      ]}
    >
      {/* Inner highlight stroke — gives the tile a "cut glass" edge */}
      <View
        pointerEvents="none"
        style={[styles.innerHighlight, { borderColor: innerHighlight }]}
      />

      <View style={[styles.iconWrap, { backgroundColor: iconCircleBg, borderColor: iconCircleRim }]}>
        <Image
          source={{ uri: getIconUrl(sym) }}
          style={styles.icon}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.tileSym, { color: fg }]}>{sym}</Text>
    </View>
  );
}

// ── Scrolling row ─────────────────────────────────────────────────────────────
function ScrollRow({
  coins,
  reverse,
  getIconUrl,
  speed,
  isDark,
}: {
  coins: string[];
  reverse: boolean;
  getIconUrl: (s: string) => string;
  speed: number;
  isDark: boolean;
}) {
  const loopW = (coins.length / 2) * ITEM_W;
  const x = useSharedValue(reverse ? -loopW : 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const target = reverse ? 0 : -loopW;
    x.value = withRepeat(
      withTiming(target, { duration: speed, easing: Easing.linear }),
      -1,
      false,
    );
  }, [loopW, reverse, speed, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.rowClip}>
      <Animated.View style={[styles.row, style]}>
        {coins.map((sym, i) => (
          <CoinTile
            key={`${sym}-${i}`}
            sym={sym}
            getIconUrl={getIconUrl}
            isDark={isDark}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ── Breathing brand glow ──────────────────────────────────────────────────────
function BrandGlow({ isDark }: { isDark: boolean }) {
  const opacity = useSharedValue(isDark ? 0.22 : 0.12);

  useEffect(() => {
    const lo = isDark ? 0.18 : 0.08;
    const hi = isDark ? 0.32 : 0.18;
    opacity.value = lo;
    opacity.value = withRepeat(
      withTiming(hi, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [isDark, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View pointerEvents="none" style={[styles.glow, style]}>
      <LinearGradient
        colors={[brand.primaryDark, `${brand.primaryDark}00`]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
      />
    </Animated.View>
  );
}

// ── Exported hero ─────────────────────────────────────────────────────────────
export const OnboardingHero = memo(function OnboardingHero({ bg }: Props) {
  const getIconUrl = useCoinIcons();

  const isDark = !bg.startsWith('#f') && !bg.startsWith('#e') && bg !== '#ffffff' && bg !== 'white';

  // Single-hue brand backdrop — periwinkle deepening into near-black on
  // dark, periwinkle fading into off-white on light. No competing colors.
  const gradColors: [string, string, string] = isDark
    ? ['#080b1c', `${brand.deep}40`, '#040611']
    : ['#f4f6ff', `${brand.softLight}`, '#ffffff'];

  const edgeMaskColor = isDark ? '#040611' : '#ffffff';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradColors}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <BrandGlow isDark={isDark} />

      <View style={styles.rows}>
        <ScrollRow coins={ROW_A} reverse={false} getIconUrl={getIconUrl} speed={28000} isDark={isDark} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_B} reverse getIconUrl={getIconUrl} speed={22000} isDark={isDark} />
      </View>

      {/* Edge masks — soft fade-out at the left/right edges so tiles
          drift off-screen instead of getting hard-cut. */}
      <LinearGradient
        pointerEvents="none"
        colors={[edgeMaskColor, `${edgeMaskColor}00`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.edgeMask, { left: 0 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[`${edgeMaskColor}00`, edgeMaskColor]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.edgeMask, { right: 0 }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: W * 1.6,
    height: W * 1.6,
    borderRadius: W * 0.8,
    top: -W * 0.45,
  },
  rows: {
    width: '100%',
    alignItems: 'flex-start',
  },
  rowClip: {
    width: '100%',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    marginRight: GAP,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  innerHighlight: {
    position: 'absolute',
    top: 1, left: 1, right: 1, bottom: 1,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: 36,
    height: 36,
    opacity: 0.92,
  },
  tileSym: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    opacity: 0.78,
  },
  edgeMask: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: W * 0.12,
  },
});

/* Back-compat */
export type HeroTone = 'primary' | 'aurora' | 'spotlight';
