/**
 * Asset detail screen — works for every tradeable token, not just the
 * hardcoded CoinGecko list. Falls back to Binance REST for price + chart
 * when the coin isn't in the backend ticker feed.
 */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line as SvgLine } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming } from 'react-native-reanimated';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets, useTransactions } from '@/hooks';
import { useMarkets, ID_TO_SYM, type CoinGeckoMarket } from '@/hooks/useMarkets';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useOHLC } from '@/hooks/useOHLC';
import { cryptoExchangeAPI } from '@/lib/cryptoApi';
import type { Currency, Wallet } from '@/types';
import { CURRENCY_META } from '@/constants';
import { formatMoney } from '@/utils/format';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';

type Range = '1H' | '24H' | '7D' | '30D';

const FIAT_CODES = new Set(['USD','EUR','GBP','AED','SAR','EGP','LYD','CAD','AUD','CHF','JPY','CNY']);

const SYM_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ID_TO_SYM).map(([id, sym]) => [sym, id]),
);

// Known metadata for display name + brand color
const KNOWN_META: Record<string, { name: string; color: string }> = {
  BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',USDT:'Tether',USDC:'USD Coin',
  BNB:'BNB',XRP:'XRP',ADA:'Cardano',DOGE:'Dogecoin',MATIC:'Polygon',
  DOT:'Polkadot',AVAX:'Avalanche',LTC:'Litecoin',LINK:'Chainlink',
  UNI:'Uniswap',AAVE:'Aave',ATOM:'Cosmos',ALGO:'Algorand',NEAR:'NEAR',
  FTM:'Fantom',VET:'VeChain',TRX:'TRON',XLM:'Stellar',FIL:'Filecoin',
  SHIB:'Shiba Inu',PEPE:'Pepe',WIF:'dogwifhat',ARB:'Arbitrum',
  OP:'Optimism',SUI:'Sui',APT:'Aptos',INJ:'Injective',SEI:'Sei',TON:'Toncoin',
} as any;

function friendlyName(sym: string): string {
  return (KNOWN_META as any)[sym.toUpperCase()] ?? sym.toUpperCase();
}

// Binance klines → close prices for chart
const BINANCE_INTERVALS: Record<Range, string> = {
  '1H':  '1m',
  '24H': '15m',
  '7D':  '4h',
  '30D': '1d',
};
const BINANCE_LIMITS: Record<Range, number> = {
  '1H': 60, '24H': 96, '7D': 42, '30D': 30,
};

function useBinanceChart(sym: string, range: Range, enabled: boolean) {
  return useQuery({
    queryKey: ['binance-chart', sym, range],
    enabled: enabled && sym !== 'USDT' && sym !== 'USDT_ERC20' && sym !== 'USDT_TRC20',
    queryFn: async () => {
      const base = sym.replace(/_ERC20|_TRC20/, '');
      const interval = BINANCE_INTERVALS[range];
      const limit = BINANCE_LIMITS[range];
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=${interval}&limit=${limit}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) throw new Error(`klines ${res.status}`);
      const data: any[] = await res.json();
      return data.map((k) => parseFloat(k[4])); // close price
    },
    staleTime: range === '1H' ? 30_000 : 5 * 60_000,
    retry: 1,
  });
}

function useBinancePrice(sym: string, enabled: boolean) {
  return useQuery({
    queryKey: ['binance-price', sym],
    enabled,
    queryFn: async () => {
      const base = sym.replace(/_ERC20|_TRC20/, '');
      if (base === 'USDT') return { price: 1, change24h: 0, volume24h: 0, marketCap: 0 };
      const res = await cryptoExchangeAPI.search(base);
      const hit = res.data.results.find((r) => r.symbol === base);
      return hit ? { price: hit.price, change24h: hit.change24h, volume24h: hit.volume24h, marketCap: 0 } : null;
    },
    staleTime: 30_000,
    retry: 1,
  });
}

export default function AssetDetail() {
  const { currency } = useLocalSearchParams<{ currency: string }>();
  const sym = (currency ?? 'BTC').toUpperCase();
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();

  const { data: markets } = useMarkets();
  const { data: wallets } = useWallets();
  const [range, setRange] = useState<Range>('24H');

  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const isFiat = FIAT_CODES.has(sym);
  const coinId = SYM_TO_ID[sym];
  // Whether this coin has a CoinGecko market record
  const market: CoinGeckoMarket | undefined = useMemo(
    () => markets?.find((m) => ID_TO_SYM[m.id] === sym),
    [markets, sym],
  );

  // For coins not in our backend ticker feed, pull from Binance directly
  const needsBinance = !market && !isFiat;
  const { data: binanceData } = useBinancePrice(sym, needsBinance);

  // Live WebSocket price (works for top coins)
  const wsPrice = useLivePrice(sym as Currency);

  // Resolved price — WS > CoinGecko > Binance search > 1 (stablecoin fallback)
  const price = wsPrice
    ?? market?.current_price
    ?? binanceData?.price
    ?? (sym === 'USDT' || sym === 'USDT_ERC20' || sym === 'USDT_TRC20' ? 1 : 0);

  const isLive = wsPrice !== null && !isFiat && sym !== 'USDT';

  // % change for selected range — CoinGecko has per-range; Binance only 24H
  const change = useMemo(() => {
    if (market) {
      switch (range) {
        case '1H':  return market.price_change_percentage_1h_in_currency  ?? 0;
        case '24H': return market.price_change_percentage_24h             ?? 0;
        case '7D':  return market.price_change_percentage_7d_in_currency  ?? 0;
        case '30D': return market.price_change_percentage_30d_in_currency ?? 0;
      }
    }
    return binanceData?.change24h ?? 0;
  }, [market, binanceData, range]);
  const positive = change >= 0;

  // Chart: CoinGecko OHLC for known coins, Binance klines for the rest
  const { data: cgOhlc, isLoading: cgLoading } = useOHLC(coinId, range);
  const { data: binanceChart, isLoading: binanceChartLoading } = useBinanceChart(sym, range, needsBinance);

  const chartValues = cgOhlc ?? binanceChart ?? [];
  const chartLoading = cgLoading || binanceChartLoading;
  const hasChart = !isFiat && (sym !== 'USDT' && sym !== 'USDT_ERC20' && sym !== 'USDT_TRC20');

  // Holdings
  const wallet = wallets?.find((w) => w.currency === sym);
  const balance = wallet ? Number(wallet.balance) : 0;
  const holdingsUsd = balance * price;
  const holdingsDelta = change !== 0 ? (holdingsUsd * change) / (100 + Math.abs(change)) : 0;

  const displayName = market?.name ?? friendlyName(sym);

  if (isFiat) {
    return (
      <ScreenShell title={CURRENCY_META[sym as Currency]?.name ?? sym} subtitle={`${sym} Currency`}>
        <FiatAssetView sym={sym as Currency} wallet={wallet} p={p} h={h} router={router} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={displayName} subtitle={`${sym} / USD`}>
      {/* Hero price */}
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{
            color: p.fg, fontSize: 40, fontWeight: '600',
            letterSpacing: -1.2, fontVariant: ['tabular-nums'],
          }}>
            ${formatPrice(hoverPrice !== null ? hoverPrice : price)}
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 4,
            paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
            backgroundColor: isLive ? p.greenBg : p.pillBg,
          }}>
            <View style={{
              width: 6, height: 6, borderRadius: 3,
              backgroundColor: isLive ? p.greenFg : p.fgFaint,
            }} />
            <Text style={{
              color: isLive ? p.greenFg : p.fgMuted,
              fontSize: 9, fontWeight: '600', letterSpacing: 0.5,
            }}>
              {isLive ? 'LIVE' : 'DELAYED'}
            </Text>
          </View>
        </View>

        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          marginTop: 6,
          paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9,
          backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.16)',
        }}>
          <Ionicons
            name={positive ? 'caret-up' : 'caret-down'}
            size={9}
            color={positive ? p.greenFg : p.redFg}
          />
          <Text style={{
            color: positive ? p.greenFg : p.redFg,
            fontSize: 12, fontWeight: '700',
          }}>
            {positive ? '+' : ''}{change.toFixed(2)}% · {range}
          </Text>
        </View>
      </View>

      {/* Chart */}
      {hasChart ? (
        <>
          <View style={{ marginTop: 22 }}>
            {chartLoading ? (
              <View style={{
                height: 160, borderRadius: 16,
                backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <LoadingPulse size={48} icon="trending-up-outline" />
              </View>
            ) : (
              <SparklineChart
                values={chartValues}
                color={positive ? '#10b981' : '#ef4444'}
                palette={p}
                onHoverPrice={setHoverPrice}
              />
            )}
          </View>

          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            marginTop: 14, padding: 4,
            borderRadius: 14,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            gap: 4,
          }}>
            {(['1H', '24H', '7D', '30D'] as Range[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => { h.selection(); setRange(r); }}
                style={{ flex: 1 }}
              >
                <View style={{
                  paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                  backgroundColor: range === r ? p.fg : 'transparent',
                }}>
                  <Text style={{
                    color: range === r ? p.bg : p.fgMuted,
                    fontWeight: '700', fontSize: 11, letterSpacing: 0.5,
                  }}>
                    {r}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <View style={{
          marginTop: 22, paddingVertical: 24, paddingHorizontal: 20, borderRadius: 16,
          backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
          alignItems: 'center',
        }}>
          <Ionicons name="cash-outline" size={28} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' }}>
            USDT is pegged 1:1 to the US dollar — no chart to show.
          </Text>
        </View>
      )}

      {/* Stat tiles */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <StatTile
          label="24H VOLUME"
          value={market
            ? fmtUsdCompact(market.total_volume)
            : binanceData?.volume24h
              ? fmtUsdCompact(binanceData.volume24h)
              : '—'}
          icon="pulse-outline"
          palette={p}
        />
        <StatTile
          label="MARKET CAP"
          value={market ? fmtUsdCompact(market.market_cap) : '—'}
          icon="layers-outline"
          palette={p}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <StatTile
          label="CIRC. SUPPLY"
          value={market?.circulating_supply ? fmtSupply(market.circulating_supply, sym) : '—'}
          icon="infinite-outline"
          palette={p}
        />
        <StatTile
          label="ALL-TIME HIGH"
          value={market?.ath ? `$${formatPrice(market.ath)}` : '—'}
          icon="trending-up-outline"
          palette={p}
        />
      </View>

      {/* Holdings */}
      <Panel style={{ marginTop: 18 }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
              YOUR HOLDINGS
            </Text>
            {wallet && balance > 0 && change !== 0 && (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
                backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.16)',
              }}>
                <Ionicons
                  name={positive ? 'caret-up' : 'caret-down'}
                  size={8}
                  color={positive ? p.greenFg : p.redFg}
                />
                <Text style={{
                  color: positive ? p.greenFg : p.redFg,
                  fontSize: 10, fontWeight: '600',
                }}>
                  {positive ? '+' : ''}${Math.abs(holdingsDelta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>

          {wallet && balance > 0 ? (
            <>
              <Text style={{
                color: p.fg, fontSize: 26, fontWeight: '600',
                fontVariant: ['tabular-nums'], marginTop: 8, letterSpacing: -0.4,
              }}>
                ${holdingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                {balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} {sym}
                {change !== 0 && (
                  <>
                    {' · '}
                    <Text style={{ color: positive ? p.greenFg : p.redFg }}>
                      {positive ? '+' : ''}{change.toFixed(2)}% over {range}
                    </Text>
                  </>
                )}
              </Text>
            </>
          ) : (
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 6 }}>
              You don&apos;t own any {sym} yet.
            </Text>
          )}
        </View>
      </Panel>

      {/* Buy / Sell CTAs */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 24 }}>
        <Pressable
          onPress={() => { h.medium(); router.push('/buy'); }}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26,
            backgroundColor: pressed ? '#000' : p.ctaBg,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 6,
          })}
        >
          <Ionicons name="add" size={16} color={p.ctaFg} />
          <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600' }}>Buy</Text>
        </Pressable>
        <Pressable
          onPress={() => { h.medium(); router.push('/sell'); }}
          disabled={!wallet || balance <= 0}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 6,
            opacity: !wallet || balance <= 0 ? 0.4 : 1,
          })}
        >
          <Ionicons name="remove" size={16} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>Sell</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}


/* ── Sparkline chart ─── */
function SparklineChart({ values, color, palette: p, onHoverPrice }: {
  values: number[]; color: string; palette: Palette; onHoverPrice?: (price: number | null) => void;
}) {
  const W = 320;
  const H = 160;
  const PAD = 6;

  if (!values || values.length < 2) {
    return (
      <View style={{
        width: '100%', height: H, borderRadius: 16,
        backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <LoadingPulse size={48} icon="trending-up-outline" />
      </View>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const step = (W - PAD * 2) / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: PAD + i * step,
    y: PAD + (H - PAD * 2) * (1 - (v - min) / spread),
    val: v
  }));

  const last = pts[pts.length - 1];
  const linePath = pts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;
  const grid = [0.25, 0.5, 0.75].map((f) => PAD + (H - PAD * 2) * f);

  // Interaction
  const hoverX = useSharedValue(-1);
  const hoverY = useSharedValue(-1);
  const hoverOpacity = useSharedValue(0);

  const handleHover = (x: number) => {
    if (x < PAD || x > W - PAD) {
      if (onHoverPrice) onHoverPrice(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const idx = Math.min(pts.length - 1, Math.max(0, Math.round((x - PAD) / step)));
    const pt = pts[idx];
    hoverX.value = pt.x;
    hoverY.value = pt.y;
    hoverOpacity.value = withTiming(1, { duration: 50 });
    if (onHoverPrice) onHoverPrice(pt.val);
  };

  const pan = Gesture.Pan()
    .onBegin((e: any) => {
      runOnJS(handleHover)(e.x);
    })
    .onChange((e: any) => {
      runOnJS(handleHover)(e.x);
    })
    .onFinalize(() => {
      runOnJS(handleHover)(-1);
    });

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value }, { translateY: hoverY.value }],
    position: 'absolute',
    left: -6,
    top: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: color,
    borderWidth: 2,
    borderColor: p.bgElev,
    shadowColor: color,
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4
  }));

  const lineStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value }],
    position: 'absolute',
    left: 0,
    top: PAD,
    width: 1,
    height: H - PAD * 2,
    backgroundColor: p.border,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={{
        borderRadius: 16, backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border, padding: 8,
        overflow: 'hidden'
      }}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {grid.map((y, i) => (
            <SvgLine key={i} x1={PAD} x2={W - PAD} y1={y} y2={y}
              stroke={p.border} strokeWidth={1} strokeDasharray="3,4" />
          ))}
          <Path d={areaPath} fill="url(#grad)" />
          <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={last.x} cy={last.y} r={8} fill={color} opacity={0.25} />
          <Circle cx={last.x} cy={last.y} r={4} fill={color} />
        </Svg>
        <Animated.View style={lineStyle} />
        <Animated.View style={cursorStyle} />
      </Animated.View>
    </GestureDetector>
  );
}

function StatTile({ label, value, icon, palette: p }: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap; palette: Palette;
}) {
  return (
    <View style={{
      flex: 1, borderRadius: 16,
      backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
      padding: 14, gap: 6,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={12} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: p.fg, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function formatPrice(n: number): string {
  if (n === 0)    return '0.00';
  if (n >= 1000)  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)     return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.01)  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(10);
}

function fmtUsdCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtSupply(n: number, sym: string): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B ${sym}`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M ${sym}`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K ${sym}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${sym}`;
}

/* ── Fiat asset detail ─── */
function FiatAssetView({ sym, wallet, p, h, router }: {
  sym: Currency;
  wallet: Wallet | undefined;
  p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
  router: { push: (href: any) => void };
}) {
  const { data: txData } = useTransactions(1);
  const txs = (txData?.items ?? []).filter((t: any) => t.currency === sym).slice(0, 8);
  const balance = wallet ? Number(wallet.balance) : 0;
  const usdValue = wallet ? Number(wallet.fiatValueUsd) : 0;
  const fxRate = balance > 0 ? usdValue / balance : 0;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <View style={{
        borderRadius: 20, padding: 20, marginBottom: 20,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.0, textTransform: 'uppercase' }}>
            Available Balance
          </Text>
          <CurrencyBadge code={sym} size="sm" variant="chip" />
        </View>
        <Text style={{
          color: p.fg, fontSize: 38, fontWeight: '600',
          letterSpacing: -1.4, marginTop: 8, fontVariant: ['tabular-nums'],
        }}>
          {formatMoney(balance, sym as Currency, { showSymbol: true })}
        </Text>
        {sym !== 'USD' && fxRate > 0 && (
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 6 }}>
            ≈ {formatMoney(usdValue, 'USD', { showSymbol: true })}
            {' · '}1 {sym} = {formatMoney(fxRate, 'USD', { showSymbol: true, maxDecimals: 4 })}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
        <Pressable
          onPress={() => { h.medium(); router.push(`/topup?currency=${sym}` as any); }}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26, backgroundColor: p.ctaBg,
            opacity: pressed ? 0.85 : 1, alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 6,
          })}
        >
          <Ionicons name="arrow-down-circle-outline" size={18} color={p.ctaFg} />
          <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600' }}>Deposit</Text>
        </Pressable>
        <Pressable
          onPress={() => { h.medium(); router.push(`/send?currency=${sym}` as any); }}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
          })}
        >
          <Ionicons name="paper-plane-outline" size={16} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>Withdraw</Text>
        </Pressable>
      </View>

      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
        RECENT ACTIVITY
      </Text>
      {txs.length > 0 ? txs.map((t: any) => {
        const amt = Number(t.amount);
        const pos = amt >= 0;
        return (
          <View key={t.id} style={{
            flexDirection: 'row', alignItems: 'center',
            paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: p.border, gap: 12,
          }}>
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={pos ? 'arrow-down' : 'arrow-up'} size={16} color={pos ? p.greenFg : p.fg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {t.description || t.type}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                {new Date(t.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={{ color: pos ? p.greenFg : p.fg, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
              {pos ? '+' : ''}{Math.abs(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
            </Text>
          </View>
        );
      }) : (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <Ionicons name="receipt-outline" size={24} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10 }}>No transactions yet</Text>
        </View>
      )}
    </View>
  );
}
