/**
 * OnboardingHero - premium visual backdrops for onboarding slides.
 *
 * The parent route owns the solid page background. This component never paints
 * a competing full-screen gradient/glow, so the hero and content remain one
 * continuous surface in every theme.
 */

import { memo, useEffect, useRef, useState } from 'react';
import { View, Image, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useCoinIcons } from '@/hooks/useCoinIcons';
import { useT } from '@/store/i18nStore';
import { ShaderLines } from './ShaderLines';
import { Text } from './Text';

const ACCENT = '#63A1DB';
const GREEN = '#35C77A';
const GOLD = '#F6B344';
const { width: W } = Dimensions.get('window');

function bgLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((ch) => ch + ch).join('') : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

interface Props {
  bg: string;
  variant?: 1 | 2 | 3;
}

type Translate = ReturnType<typeof useT>;

function palette(isDark: boolean, bg: string) {
  return {
    bg,
    fg: isDark ? '#F7F8FA' : '#08090A',
    muted: isDark ? 'rgba(247,248,250,0.64)' : 'rgba(8,9,10,0.58)',
    faint: isDark ? 'rgba(247,248,250,0.34)' : 'rgba(8,9,10,0.34)',
    surface: isDark ? 'rgba(255,255,255,0.070)' : 'rgba(255,255,255,0.88)',
    raised: isDark ? 'rgba(255,255,255,0.105)' : '#FFFFFF',
    inset: isDark ? 'rgba(255,255,255,0.050)' : 'rgba(8,9,10,0.040)',
    border: isDark ? 'rgba(255,255,255,0.125)' : 'rgba(8,9,10,0.095)',
    shadow: isDark ? 0.28 : 0.12,
  };
}

/* -------------------------------------------------------------------------- */
/* Variant 1 - crypto carousel                                                */
/* -------------------------------------------------------------------------- */

// Conservative jsDelivr cryptocurrency-icons symbols. If an image still fails,
// the tile disappears instead of showing a fallback letter/digit placeholder.
const COINS_A = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'XRP', 'ADA', 'DOGE'];
const COINS_B = ['LTC', 'BCH', 'XLM', 'TRX', 'EOS', 'XMR', 'DASH', 'ZEC'];
const COINS_C = ['LINK', 'NEO', 'ETC', 'VET', 'XTZ', 'QTUM', 'ICX', 'ZIL'];
const COINS_D = ['DAI', 'BAT', 'ZRX', 'OMG', 'WAVES', 'REP', 'KNC', 'BNT'];

const COPIES = 3;
const ROW_A = [...COINS_A, ...COINS_A, ...COINS_A];
const ROW_B = [...COINS_B, ...COINS_B, ...COINS_B];
const ROW_C = [...COINS_C, ...COINS_C, ...COINS_C];
const ROW_D = [...COINS_D, ...COINS_D, ...COINS_D];

const TILE_W = 64;
const GAP = 16;
const ITEM_W = TILE_W + GAP;

function CoinTile({ sym, getIconUrl }: { sym: string; getIconUrl: (s: string) => string }) {
  const uri = getIconUrl(sym);
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return <View style={[tileStyles.tile, tileStyles.blankTile]} />;
  }

  return (
    <View style={tileStyles.tile}>
      <Image source={{ uri }} style={tileStyles.icon} resizeMode="contain" onError={() => setFailed(true)} />
    </View>
  );
}

function ScrollRow({ coins, reverse, getIconUrl, speed }: {
  coins: string[];
  reverse: boolean;
  getIconUrl: (s: string) => string;
  speed: number;
}) {
  const copyW = (coins.length / COPIES) * ITEM_W;
  const x = useSharedValue(-copyW);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const target = reverse ? 0 : -copyW * 2;
    x.value = withRepeat(withTiming(target, { duration: speed, easing: Easing.linear }), -1, false);
  }, [copyW, reverse, speed, x]);

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
  blankTile: { opacity: 0 },
  icon: { width: 54, height: 54, opacity: 0.92 },
});

/* -------------------------------------------------------------------------- */
/* Variant 2 - premium fintech capability showcase                            */
/* -------------------------------------------------------------------------- */

function MiniIcon({
  name,
  color,
  bg,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
      <Ionicons name={name} size={15} color={color} />
    </View>
  );
}

function FintechShowcase({ isDark, bg, t }: { isDark: boolean; bg: string; t: Translate }) {
  const tone = palette(isDark, bg);
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    float.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.quad) }), -1, true);
    pulse.value = withRepeat(withTiming(1.012, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [float, pulse]);

  const phoneFloat = useAnimatedStyle(() => ({
    transform: [{ translateY: -4 * float.value }, { scale: pulse.value }],
  }));
  const cardFloat = useAnimatedStyle(() => ({ transform: [{ translateY: 3 * float.value }, { rotate: '-2deg' }] }));
  const chatFloat = useAnimatedStyle(() => ({ transform: [{ translateY: -2 + 4 * float.value }] }));

  return (
    <View style={showcaseStyles.wrap}>
      <Animated.View
        style={[
          showcaseStyles.phone,
          phoneFloat,
          {
            backgroundColor: bg,
            borderColor: tone.border,
            shadowOpacity: tone.shadow,
          },
        ]}
      >
        <View style={showcaseStyles.appHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Image source={require('../../../assets/icon-color.png')} style={{ width: 20, height: 20 }} resizeMode="contain" />
            <View>
              <Text style={{ color: tone.fg, fontSize: 12, fontWeight: '900', letterSpacing: 0 }}>tazdan</Text>
              <Text style={{ color: tone.faint, fontSize: 8.5, fontWeight: '700', letterSpacing: 0 }}>@nasser</Text>
            </View>
          </View>
          <View style={[showcaseStyles.avatar, { backgroundColor: tone.surface, borderColor: tone.border }]}>
            <Text style={{ color: tone.fg, fontSize: 10, fontWeight: '900', letterSpacing: 0 }}>NM</Text>
          </View>
        </View>

        <View style={showcaseStyles.balanceBlock}>
          <Text style={{ color: tone.muted, fontSize: 10.5, fontWeight: '700', letterSpacing: 0 }}>
            {t('home.totalBalance')}
          </Text>
          <Text style={{ color: tone.fg, fontSize: 33, fontWeight: '900', letterSpacing: 0, fontVariant: ['tabular-nums'] }}>
            $12,840
            <Text style={{ color: tone.muted, fontSize: 19, fontWeight: '800', letterSpacing: 0 }}>.92</Text>
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ color: tone.faint, fontSize: 9.5, fontWeight: '700', letterSpacing: 0 }}>+$360.24</Text>
            <View style={[showcaseStyles.deltaPill, { backgroundColor: `${GREEN}1F`, borderColor: `${GREEN}40` }]}>
              <Ionicons name="caret-up" size={8} color={GREEN} />
              <Text style={{ color: GREEN, fontSize: 9.5, fontWeight: '900', letterSpacing: 0 }}>2.88%</Text>
            </View>
          </View>
        </View>

        <View style={showcaseStyles.actionRow}>
          <MockAction icon="trending-up-outline" label={t('action.buy')} bg={ACCENT} fg="#FFFFFF" />
          <MockAction icon="trending-down-outline" label={t('action.sell')} bg={tone.raised} fg={tone.fg} border={tone.border} />
          <MockAction icon="paper-plane-outline" label={t('action.send')} bg={tone.raised} fg={tone.fg} border={tone.border} />
          <MockAction icon="download-outline" label={t('action.topup')} bg={`${ACCENT}22`} fg={isDark ? '#8BBCE8' : '#3E78AE'} border={`${ACCENT}55`} />
        </View>

        <View style={showcaseStyles.middleRow}>
          <Animated.View style={[showcaseStyles.cardPreview, cardFloat, { backgroundColor: isDark ? '#20242B' : '#111214' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: '#FAFAFA', fontSize: 10, fontWeight: '900', letterSpacing: 0 }}>{t('wallet.cards')}</Text>
              <Ionicons name="wifi" size={14} color="rgba(250,250,250,0.78)" />
            </View>
            <View style={{ width: 25, height: 18, borderRadius: 4, backgroundColor: GOLD, opacity: 0.85 }} />
            <Text style={{ color: 'rgba(250,250,250,0.70)', fontSize: 9.5, fontWeight: '800', letterSpacing: 0 }}>**** 0488</Text>
          </Animated.View>

          <Animated.View style={[showcaseStyles.payPreview, chatFloat, { backgroundColor: tone.surface, borderColor: tone.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <MiniIcon name="chatbubble-ellipses" color={ACCENT} bg={`${ACCENT}22`} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: tone.fg, fontSize: 10.5, fontWeight: '900', letterSpacing: 0 }}>
                  {t('nav.messages')}
                </Text>
                <Text numberOfLines={1} style={{ color: tone.muted, fontSize: 8.5, fontWeight: '700', letterSpacing: 0 }}>
                  {t('action.send')} $120
                </Text>
              </View>
            </View>
            <View style={{ alignSelf: 'flex-end', paddingHorizontal: 9, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT }}>
              <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0 }}>{t('action.send')}</Text>
            </View>
          </Animated.View>
        </View>

        <View style={[showcaseStyles.assetsPanel, { backgroundColor: tone.surface, borderColor: tone.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <Text style={{ color: tone.fg, fontSize: 12, fontWeight: '900', letterSpacing: 0 }}>{t('home.assets')}</Text>
            <Text style={{ color: tone.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0 }}>{t('onboard.feature.realRate')}</Text>
          </View>
          <AssetPreview symbol="BTC" icon="logo-bitcoin" iconColor={GOLD} name="Bitcoin" value="$8,420.00" change="+4.12%" tone={tone} />
          <AssetPreview symbol="USDT" icon="logo-usd" iconColor={GREEN} name="Tether" value="$3,200.00" change="+0.01%" tone={tone} />
        </View>
      </Animated.View>
    </View>
  );
}

function MockAction({
  icon,
  label,
  bg,
  fg,
  border,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  bg: string;
  fg: string;
  border?: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, borderWidth: border ? 1 : 0, borderColor: border }}>
        <Ionicons name={icon} size={16} color={fg} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ maxWidth: '100%', marginTop: 4, color: fg === '#FFFFFF' ? 'rgba(247,248,250,0.86)' : fg, fontSize: 9, fontWeight: '800', letterSpacing: 0 }}>
        {label}
      </Text>
    </View>
  );
}

function AssetPreview({
  symbol,
  icon,
  iconColor,
  name,
  value,
  change,
  tone,
}: {
  symbol: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  name: string;
  value: string;
  change: string;
  tone: ReturnType<typeof palette>;
}) {
  return (
    <View style={showcaseStyles.assetRow}>
      <MiniIcon name={icon} color={iconColor} bg={`${iconColor}20`} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: tone.fg, fontSize: 11, fontWeight: '900', letterSpacing: 0 }}>{symbol}</Text>
        <Text style={{ color: tone.muted, fontSize: 8.5, fontWeight: '700', letterSpacing: 0 }}>{name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ color: tone.fg, fontSize: 10.5, fontWeight: '900', letterSpacing: 0 }}>{value}</Text>
        <Text style={{ color: GREEN, fontSize: 8.5, fontWeight: '900', letterSpacing: 0 }}>{change}</Text>
      </View>
    </View>
  );
}

const showcaseStyles = StyleSheet.create({
  wrap: {
    width: Math.min(W - 58, 292),
    height: 404,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phone: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    padding: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 32,
    elevation: 8,
    overflow: 'hidden',
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceBlock: {
    alignItems: 'center',
    marginTop: 16,
    gap: 3,
  },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 15,
  },
  middleRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
  },
  cardPreview: {
    flex: 0.94,
    height: 76,
    borderRadius: 20,
    padding: 11,
    justifyContent: 'space-between',
  },
  payPreview: {
    flex: 1,
    height: 76,
    borderRadius: 20,
    borderWidth: 1,
    padding: 9,
    justifyContent: 'space-between',
  },
  assetsPanel: {
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    padding: 11,
    gap: 2,
  },
  assetRow: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
});

/* -------------------------------------------------------------------------- */
/* Variant 3 - final launch moment                                            */
/* -------------------------------------------------------------------------- */

function LaunchPanel({ isDark, bg, t }: { isDark: boolean; bg: string; t: Translate }) {
  const tone = palette(isDark, bg);
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1.035, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <View style={launchStyles.wrap}>
      <View pointerEvents="none" style={launchStyles.shaderBed}>
        <ShaderLines opacity={isDark ? 0.10 : 0.08} style={launchStyles.shaderLayer} />
      </View>

      <Animated.View
        style={[
          launchStyles.panel,
          panelStyle,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.075)' : 'rgba(255,255,255,0.84)',
            borderColor: tone.border,
            shadowOpacity: tone.shadow,
          },
        ]}
      >
        <View style={[launchStyles.iconPlate, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF', borderColor: tone.border }]}>
          <Image source={require('../../../assets/icon-color.png')} style={{ width: 72, height: 72 }} resizeMode="contain" />
        </View>
        <View style={{ alignItems: 'center', gap: 9 }}>
          <Text style={{ color: tone.fg, fontSize: 30, fontWeight: '900', letterSpacing: 0, textAlign: 'center' }}>
            {t('onboard.title.3')}
          </Text>
          <Text style={{ color: tone.muted, fontSize: 15, fontWeight: '700', lineHeight: 20, letterSpacing: 0, textAlign: 'center', paddingHorizontal: 6 }}>
            {t('onboard.slogan')}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {[t('onboard.feature.buySell'), t('onboard.feature.transfer'), t('onboard.feature.cards')].map((label) => (
            <View key={label} style={[launchStyles.launchPill, { backgroundColor: tone.inset, borderColor: tone.border }]}>
              <Text numberOfLines={1} style={{ color: tone.fg, fontSize: 10.5, fontWeight: '800', letterSpacing: 0 }}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const launchStyles = StyleSheet.create({
  wrap: {
    width: Math.min(W - 42, 360),
    height: 386,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shaderBed: {
    position: 'absolute',
    width: W * 1.55,
    height: W * 1.12,
    borderRadius: W,
    overflow: 'hidden',
    opacity: 0.9,
    transform: [{ scale: 1.18 }],
  },
  shaderLayer: {
    transform: [{ scale: 1.45 }],
  },
  panel: {
    width: '100%',
    borderRadius: 34,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowRadius: 38,
    elevation: 9,
  },
  iconPlate: {
    width: 112,
    height: 112,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launchPill: {
    maxWidth: 98,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Exported hero                                                              */
/* -------------------------------------------------------------------------- */

export const OnboardingHero = memo(function OnboardingHero({ bg, variant = 1 }: Props) {
  const getIconUrl = useCoinIcons();
  const t = useT();
  const isDark = bgLuminance(bg) < 0.5;

  if (variant === 2) {
    return (
      <View style={[sharedStyles.root, { backgroundColor: bg }]}>
        <FintechShowcase isDark={isDark} bg={bg} t={t} />
      </View>
    );
  }

  if (variant === 3) {
    return (
      <View style={[sharedStyles.root, { backgroundColor: bg }]}>
        <LaunchPanel isDark={isDark} bg={bg} t={t} />
      </View>
    );
  }

  return (
    <View style={[sharedStyles.root, { backgroundColor: bg }]}>
      <View style={sharedStyles.skewedRows}>
        <ScrollRow coins={ROW_A} reverse={false} getIconUrl={getIconUrl} speed={36000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_B} reverse getIconUrl={getIconUrl} speed={30000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_C} reverse={false} getIconUrl={getIconUrl} speed={40000} />
        <View style={{ height: GAP }} />
        <ScrollRow coins={ROW_D} reverse getIconUrl={getIconUrl} speed={33000} />
      </View>
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
  skewedRows: {
    width: '160%',
    left: '-30%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    transform: [
      { rotate: '-12deg' },
      { skewX: '-15deg' },
      { scale: 1.35 },
    ],
  },
});

export type HeroTone = 'primary' | 'aurora' | 'spotlight';
