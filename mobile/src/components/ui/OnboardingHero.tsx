/**
 * OnboardingHero — fintech ticker tape.
 *
 * Two rows of real coin logos scroll in opposite directions.
 * Icon URLs come from the server's /api/markets/icons endpoint (CoinGecko CDN)
 * with a fallback to the open-source cryptocurrency-icons GitHub CDN.
 * Background: deep navy → violet gradient (dark) or pale blue → white (light).
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

const { width: W } = Dimensions.get('window');

interface Props {
  fg: string;
  bg: string;
  variant?: 1 | 2 | 3;
}

// ── Two fully distinct coin sets — rows never mirror each other ───────────────
// Top row: the biggest caps
const COINS_A = ['BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC','LINK','UNI'];
// Bottom row: different coins entirely
const COINS_B = ['LTC','ATOM','TRX','NEAR','FIL','ALGO','VET','XLM','AAVE','ARB','OP','SUI'];

// Doubled for seamless looping
const ROW_A = [...COINS_A, ...COINS_A];
const ROW_B = [...COINS_B, ...COINS_B];

// ── Tile constants ────────────────────────────────────────────────────────────
const TILE_W = 72;
const TILE_H = 86;
const GAP    = 10;
const ITEM_W = TILE_W + GAP;

// ── Single coin tile ──────────────────────────────────────────────────────────
function CoinTile({
  sym,
  getIconUrl,
  fg,
}: {
  sym: string;
  getIconUrl: (s: string) => string;
  fg: string;
}) {
  return (
    <View style={[styles.tile, { borderColor: `${fg}18` }]}>
      <View style={styles.iconWrap}>
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
  fg,
  getIconUrl,
  speed,
}: {
  coins: string[];
  reverse: boolean;
  fg: string;
  getIconUrl: (s: string) => string;
  speed: number;
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
            fg={fg}
          />
        ))}
      </Animated.View>
    </View>
  );
}

// ── Exported hero ─────────────────────────────────────────────────────────────
export const OnboardingHero = memo(function OnboardingHero({ fg, bg }: Props) {
  const getIconUrl = useCoinIcons();

  const isDark = !bg.startsWith('#f') && !bg.startsWith('#e') && bg !== '#ffffff' && bg !== 'white';
  const tileFg = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(13,27,75,0.90)';

  const gradColors: [string, string, string] = isDark
    ? ['#06112b', '#0d2260', '#1a0a3d']
    : ['#e8f0ff', '#dce8ff', '#f5f0ff'];

  return (
    <LinearGradient
      colors={gradColors}
      locations={[0, 0.55, 1]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.root}
    >
      {/* Radial glow */}
      <View
        pointerEvents="none"
        style={[styles.glow, { opacity: isDark ? 0.14 : 0.07 }]}
      />

      <View style={styles.rows}>
        <ScrollRow coins={ROW_A} reverse={false} fg={tileFg} getIconUrl={getIconUrl} speed={24000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_B} reverse fg={tileFg} getIconUrl={getIconUrl} speed={19000} />
      </View>
    </LinearGradient>
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
    width: W * 1.4,
    height: W * 1.4,
    borderRadius: W * 0.7,
    top: -W * 0.4,
    backgroundColor: '#226dff',
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
    paddingVertical: 2,
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    marginRight: GAP,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    width: 38,
    height: 38,
  },
  tileSym: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    opacity: 0.85,
  },
});

/* Back-compat */
export type HeroTone = 'primary' | 'aurora' | 'spotlight';
