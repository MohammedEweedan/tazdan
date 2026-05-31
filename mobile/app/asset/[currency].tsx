/**
 * Asset detail screen — works for every tradeable token, not just the
 * hardcoded CoinGecko list. Falls back to Binance REST for price + chart
 * when the coin isn't in the backend ticker feed.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Line as SvgLine, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { BuyWidget } from '@/components/exchange/BuyWidget';
import { SellWidget } from '@/components/exchange/SellWidget';

import { Panel } from '@/components/ui/ScreenShell';
import { TopGradient } from '@/components/ui/ScreenShell';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming } from 'react-native-reanimated';
import { useThemedPalette, useTheme, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets, useTransactions } from '@/hooks';
import { api } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useMarkets, ID_TO_SYM, type CoinGeckoMarket } from '@/hooks/useMarkets';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useOHLC, useOHLCCandles, type Candle } from '@/hooks/useOHLC';
import { cryptoExchangeAPI, cryptoWalletAPI } from '@/lib/cryptoApi';
import type { Currency, Wallet } from '@/types';
import { CURRENCY_META } from '@/constants';
import { formatMoney } from '@/utils/format';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { AssetTxRow, txBelongsToAsset } from '@/components/transactions/AssetTxRow';

type Range = '1H' | '24H' | '7D' | '30D';
type Tab = 'overview' | 'news';
type ChartType = 'line' | 'candle';

const FIAT_CODES = new Set(['USD','EUR','GBP','AED','SAR','EGP','LYD','CAD','AUD','CHF','JPY','CNY']);

const SYM_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ID_TO_SYM).map(([id, sym]) => [sym, id]),
);

const KNOWN_META: Record<string, string> = {
  BTC:'Bitcoin',ETH:'Ethereum',SOL:'Solana',USDT:'Tether',USDC:'USD Coin',
  BNB:'BNB',XRP:'XRP',ADA:'Cardano',DOGE:'Dogecoin',MATIC:'Polygon',
  DOT:'Polkadot',AVAX:'Avalanche',LTC:'Litecoin',LINK:'Chainlink',
  UNI:'Uniswap',AAVE:'Aave',ATOM:'Cosmos',ALGO:'Algorand',NEAR:'NEAR',
  FTM:'Fantom',VET:'VeChain',TRX:'TRON',XLM:'Stellar',FIL:'Filecoin',
  SHIB:'Shiba Inu',PEPE:'Pepe',WIF:'dogwifhat',ARB:'Arbitrum',
  OP:'Optimism',SUI:'Sui',APT:'Aptos',INJ:'Injective',SEI:'Sei',TON:'Toncoin',
};

function friendlyName(sym: string): string {
  return KNOWN_META[sym.toUpperCase()] ?? sym.toUpperCase();
}

const BINANCE_INTERVALS: Record<Range, string> = {
  '1H': '1m', '24H': '15m', '7D': '4h', '30D': '1d',
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
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=${BINANCE_INTERVALS[range]}&limit=${BINANCE_LIMITS[range]}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) throw new Error(`klines ${res.status}`);
      const data: any[] = await res.json();
      return {
        prices: data.map((k) => parseFloat(k[4])),
        timestamps: data.map((k) => k[0]),
        candles: data.map((k) => ({
          timestamp: k[0],
          open:  parseFloat(k[1]),
          high:  parseFloat(k[2]),
          low:   parseFloat(k[3]),
          close: parseFloat(k[4]),
        })),
      };
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
      if (base === 'USDT') return { price: 1, change24h: 0, volume24h: 0 };
      const res = await cryptoExchangeAPI.search(base);
      const hit = res.data.results.find((r) => r.symbol === base);
      return hit ? { price: hit.price, change24h: hit.change24h, volume24h: hit.volume24h } : null;
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
  const themeMode = useTheme((s) => s.mode);
  const insets = useSafeAreaInsets();

  const { data: markets } = useMarkets();
  const { data: wallets } = useWallets();
  const [range, setRange] = useState<Range>('24H');
  const [tab, setTab] = useState<Tab>('overview');
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  const isFiat = FIAT_CODES.has(sym);
  const coinId = SYM_TO_ID[sym];
  const market: CoinGeckoMarket | undefined = useMemo(
    () => markets?.find((m) => ID_TO_SYM[m.id] === sym),
    [markets, sym],
  );

  const needsBinance = !market && !isFiat;
  const { data: binanceData } = useBinancePrice(sym, needsBinance);
  const wsPrice = useLivePrice(sym as Currency);

  const price = wsPrice
    ?? market?.current_price
    ?? binanceData?.price
    ?? (sym === 'USDT' || sym === 'USDT_ERC20' || sym === 'USDT_TRC20' ? 1 : 0);

  const isLive = wsPrice !== null && !isFiat && sym !== 'USDT';

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

  const { data: cgOhlc, isLoading: cgLoading } = useOHLC(coinId, range);
  const { data: cgCandles } = useOHLCCandles(coinId, range);
  const { data: binanceChart, isLoading: binanceChartLoading } = useBinanceChart(sym, range, needsBinance);
  const [chartType, setChartType] = useState<ChartType>('line');

  const chartPoints: import('@/hooks/useOHLC').ChartPoint[] = useMemo(() => {
    if (cgOhlc) return cgOhlc;
    if (binanceChart) {
      return binanceChart.prices.map((price, i) => ({
        price,
        timestamp: binanceChart.timestamps[i] ?? Date.now(),
      }));
    }
    return [];
  }, [cgOhlc, binanceChart]);

  const candles: Candle[] = useMemo(() => {
    if (cgCandles?.length) return cgCandles;
    if (binanceChart?.candles?.length) return binanceChart.candles;
    return [];
  }, [cgCandles, binanceChart]);

  const chartLoading = cgLoading || binanceChartLoading;
  const hasChart = !isFiat && sym !== 'USDT' && sym !== 'USDT_ERC20' && sym !== 'USDT_TRC20';

  const wallet = wallets?.find((w) => w.currency === sym);
  const balance = wallet ? Number(wallet.balance) : 0;
  const holdingsUsd = balance * price;
  const holdingsDelta = change !== 0 ? (holdingsUsd * change) / (100 + Math.abs(change)) : 0;

  const displayName = market?.name ?? friendlyName(sym);

  // ── Modals ──
  const buyModal = (
    <Modal visible={buyOpen} transparent animationType="slide" onRequestClose={() => setBuyOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setBuyOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <BuyWidget defaultAsset={sym} lockAsset={!isFiat} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );

  const sellModal = (
    <Modal visible={sellOpen} transparent animationType="slide" onRequestClose={() => setSellOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setSellOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              <SellWidget defaultAsset={sym} lockAsset={!isFiat} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Sticky action bar ──
  const actionBar = (
    <View style={{
      flexDirection: 'row', gap: 10,
      paddingTop: 10,
      paddingBottom: Math.max(insets.bottom, 12) + 4,
      paddingHorizontal: 20,
      backgroundColor: p.bg,
      borderTopWidth: 1, borderTopColor: p.border,
    }}>
      <Pressable
        onPress={() => { h.medium(); setBuyOpen(true); }}
        style={({ pressed }) => ({
          flex: 1, height: 52, borderRadius: 26,
          backgroundColor: pressed ? p.fgMuted : p.ctaBg,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
        })}
      >
        <Ionicons name="add" size={16} color={p.ctaFg} />
        <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '600' }}>Buy</Text>
      </Pressable>
      <Pressable
        onPress={() => { h.medium(); setSellOpen(true); }}
        disabled={!wallet || balance <= 0}
        style={({ pressed }) => ({
          flex: 1, height: 52, borderRadius: 26,
          backgroundColor: pressed ? p.border : p.pillBg,
          borderWidth: 1, borderColor: p.border,
          alignItems: 'center', justifyContent: 'center',
          flexDirection: 'row', gap: 6,
          opacity: !wallet || balance <= 0 ? 0.38 : 1,
        })}
      >
        <Ionicons name="remove" size={16} color={p.fg} />
        <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>Sell</Text>
      </Pressable>
    </View>
  );

  if (isFiat) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
        {/* Fiat header */}
        <View style={{
          paddingTop: insets.top + 10,
          paddingHorizontal: 20,
          paddingBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: p.border,
        }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: pressed ? p.bgElev : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>
          <Text style={{ fontSize: 54, lineHeight: 60 }}>
            {CURRENCY_META[sym as Currency]?.flagOrIcon ?? sym.slice(0, 2)}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
              {CURRENCY_META[sym as Currency]?.name ?? sym}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 1 }}>{sym} · Fiat</Text>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <FiatAssetView sym={sym as Currency} wallet={wallet} p={p} h={h} />
        </ScrollView>
        {actionBar}
        {buyModal}
        {sellModal}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />

      {/* ── Custom header — coin icon fully visible ── */}
      <View style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: p.bg,
        borderBottomWidth: 1,
        borderBottomColor: p.border,
        overflow: 'hidden',
      }}>
        <TopGradient height={insets.top + 100} />
        {/* Back + name row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: pressed ? p.bgElev : p.pillBg,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 1 }}>{sym} / USD</Text>
          </View>
          {/* Live badge */}
          {isLive && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
              backgroundColor: p.greenBg,
            }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: p.greenFg }} />
              <Text style={{ color: p.greenFg, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 }}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Coin icon + price row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <CoinIcon symbol={sym} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={{
              color: p.fg, fontSize: 34, fontWeight: '700',
              letterSpacing: -1, fontVariant: ['tabular-nums'], lineHeight: 38,
            }}>
              ${formatPrice(hoverPrice !== null ? hoverPrice : price)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
                backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.14)',
              }}>
                <Ionicons
                  name={positive ? 'caret-up' : 'caret-down'}
                  size={9}
                  color={positive ? p.greenFg : p.redFg}
                />
                <Text style={{ color: positive ? p.greenFg : p.redFg, fontSize: 12, fontWeight: '700' }}>
                  {positive ? '+' : ''}{change.toFixed(2)}%
                </Text>
              </View>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{range}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: p.bg,
        borderBottomWidth: 1,
        borderBottomColor: p.border,
        paddingHorizontal: 20,
      }}>
        {(['overview', 'news'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => { h.selection(); setTab(t); }}
            style={{ marginRight: 24, paddingVertical: 12, position: 'relative' }}
          >
            <Text style={{
              color: tab === t ? p.fg : p.fgMuted,
              fontSize: 14,
              fontWeight: tab === t ? '700' : '500',
              textTransform: 'capitalize',
            }}>
              {t}
            </Text>
            {tab === t && (
              <View style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                height: 2, borderRadius: 1, backgroundColor: p.fg,
              }} />
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}
      >
        {tab === 'overview' ? (
          <OverviewTab
            sym={sym}
            p={p}
            h={h}
            hasChart={hasChart}
            chartLoading={chartLoading}
            chartPoints={chartPoints}
            candles={candles}
            chartType={chartType}
            setChartType={setChartType}
            positive={positive}
            color={positive ? p.greenFg : p.redFg}
            range={range}
            setRange={setRange}
            onHoverPrice={setHoverPrice}
            isLive={isLive}
            wsPrice={wsPrice}
            market={market}
            binanceData={binanceData}
            wallet={wallet}
            balance={balance}
            holdingsUsd={holdingsUsd}
            holdingsDelta={holdingsDelta}
            change={change}
          />
        ) : (
          <NewsTab p={p} sym={sym} />
        )}
      </ScrollView>

      {actionBar}
      {buyModal}
      {sellModal}
    </View>
  );
}

/* ── Overview tab ─────────────────────────────────────────────────── */
function OverviewTab({
  sym, p, h, hasChart, chartLoading, chartPoints, candles, chartType, setChartType, positive, color,
  range, setRange, onHoverPrice, isLive, wsPrice,
  market, binanceData, wallet, balance, holdingsUsd, holdingsDelta, change,
}: {
  sym: string; p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
  hasChart: boolean; chartLoading: boolean;
  chartPoints: import('@/hooks/useOHLC').ChartPoint[];
  candles: Candle[];
  chartType: ChartType; setChartType: (t: ChartType) => void;
  positive: boolean; color: string; range: Range;
  setRange: (r: Range) => void;
  onHoverPrice: (v: number | null) => void;
  isLive: boolean; wsPrice: number | null;
  market: CoinGeckoMarket | undefined;
  binanceData: { price: number; change24h: number; volume24h: number } | null | undefined;
  wallet: Wallet | undefined; balance: number;
  holdingsUsd: number; holdingsDelta: number; change: number;
}) {
  return (
    <View style={{ gap: 16 }}>
      {/* Chart */}
      {hasChart ? (
        <View>
          {chartLoading ? (
            <View style={{
              height: 168, borderRadius: 16,
              backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <LoadingPulse size={48} icon="trending-up-outline" />
            </View>
          ) : chartType === 'candle' ? (
            <CandleChart
              candles={candles}
              palette={p}
              upColor={p.greenFg}
              downColor={p.redFg}
              onHoverPrice={onHoverPrice}
            />
          ) : (
            <SparklineChart
              points={chartPoints}
              color={color}
              palette={p}
              onHoverPrice={onHoverPrice}
              livePrice={isLive ? wsPrice : null}
            />
          )}
          {/* Line / candle toggle */}
          <View style={{ flexDirection: 'row', alignSelf: 'flex-start', marginTop: 22, gap: 4, padding: 4, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border }}>
            {([['line', 'pulse-outline'], ['candle', 'stats-chart-outline']] as [ChartType, keyof typeof Ionicons.glyphMap][]).map(([t, icon]) => (
              <Pressable key={t} onPress={() => { h.selection(); setChartType(t); }}>
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9,
                  backgroundColor: chartType === t ? p.fg : 'transparent',
                }}>
                  <Ionicons name={icon} size={13} color={chartType === t ? p.bg : p.fgMuted} />
                  <Text style={{ color: chartType === t ? p.bg : p.fgMuted, fontWeight: '700', fontSize: 11, letterSpacing: 0.4 }}>
                    {t === 'line' ? 'Line' : 'Candles'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          {/* Range selector */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            marginTop: 10, padding: 4,
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
                    fontWeight: '700', fontSize: 11, letterSpacing: 0.4,
                  }}>
                    {r}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View style={{
          paddingVertical: 24, paddingHorizontal: 20, borderRadius: 16,
          backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
          alignItems: 'center', gap: 8,
        }}>
          <Ionicons name="cash-outline" size={28} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
            USDT is pegged 1:1 to the US dollar — no chart to show.
          </Text>
        </View>
      )}

      {/* Holdings */}
      <View style={{
        borderRadius: 16, backgroundColor: p.bgElev,
        borderWidth: 1, borderColor: p.border, padding: 16,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
            YOUR HOLDINGS
          </Text>
          {wallet && balance > 0 && change !== 0 && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
              backgroundColor: positive ? p.greenBg : 'rgba(239,68,68,0.14)',
            }}>
              <Ionicons name={positive ? 'caret-up' : 'caret-down'} size={8} color={positive ? p.greenFg : p.redFg} />
              <Text style={{ color: positive ? p.greenFg : p.redFg, fontSize: 10, fontWeight: '600' }}>
                {positive ? '+' : ''}${Math.abs(holdingsDelta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>
        {wallet && balance > 0 ? (
          <>
            <Text style={{
              color: p.fg, fontSize: 28, fontWeight: '700',
              fontVariant: ['tabular-nums'], letterSpacing: -0.6,
            }}>
              ${holdingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 3 }}>
              {balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} {sym}
            </Text>
          </>
        ) : (
          <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500' }}>
            You don't own any {sym} yet.
          </Text>
        )}
      </View>

      {/* Stat grid */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          label="24H VOLUME"
          value={market ? fmtUsdCompact(market.total_volume) : binanceData?.volume24h ? fmtUsdCompact(binanceData.volume24h) : '—'}
          icon="pulse-outline" palette={p}
        />
        <StatTile
          label="MARKET CAP"
          value={market ? fmtUsdCompact(market.market_cap) : '—'}
          icon="layers-outline" palette={p}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          label="CIRC. SUPPLY"
          value={market?.circulating_supply ? fmtSupply(market.circulating_supply, sym) : '—'}
          icon="infinite-outline" palette={p}
        />
        <StatTile
          label="ALL-TIME HIGH"
          value={market?.ath ? `$${formatPrice(market.ath)}` : '—'}
          icon="trending-up-outline" palette={p}
        />
      </View>

      {/* Recent transactions */}
      <AssetTransactions sym={sym} p={p} />

      {/* Deposit QR */}
      <CryptoDepositSection sym={sym} wallet={wallet} p={p} h={h} />
    </View>
  );
}

/* ── News tab ─────────────────────────────────────────────────────── */
function NewsTab({ p, sym }: { p: Palette; sym: string }) {
  return (
    <View>
      <NewsSection p={p} sym={sym} />
    </View>
  );
}

/* ── Deposit QR ─── */
function CryptoDepositSection({ sym, wallet, p, h }: {
  sym: string; wallet: Wallet | undefined; p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
}) {
  const [addr, setAddr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const network = sym.replace(/_ERC20|_TRC20/, '');
  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    cryptoWalletAPI.depositAddress(sym, network)
      .then((res) => setAddr(res.data.address))
      .catch(() => setAddr(null))
      .finally(() => setLoading(false));
  }, [sym, wallet]);

  if (!wallet) return null;

  const qrUrl = addr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(addr)}&bgcolor=ffffff&color=000000`
    : null;

  return (
    <View style={{
      borderRadius: 16, backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border, padding: 16,
    }}>
      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 14 }}>
        DEPOSIT {sym}
      </Text>
      {loading ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <LoadingPulse size={36} icon="qr-code-outline" />
        </View>
      ) : addr ? (
        <>
          {qrUrl && (
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 14 }}>
                <Image source={{ uri: qrUrl }} style={{ width: 160, height: 160, borderRadius: 4 }} resizeMode="contain" />
              </View>
            </View>
          )}
          <Pressable
            onPress={() => {
              Clipboard.setStringAsync(addr);
              h.selection();
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 12, borderRadius: 12,
              backgroundColor: p.pillBg,
              borderWidth: 1, borderColor: copied ? p.greenFg : p.border,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color={copied ? p.greenFg : p.fgMuted} />
            <Text style={{ color: p.fg, fontSize: 12, fontWeight: '500', flex: 1, fontFamily: 'monospace' }} numberOfLines={1}>{addr}</Text>
            <Text style={{ color: copied ? p.greenFg : p.fgMuted, fontSize: 11, fontWeight: '600' }}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
          Unable to load deposit address
        </Text>
      )}
    </View>
  );
}

/* ── Asset transactions ─── */
function AssetTransactions({ sym, p }: { sym: string; p: Palette }) {
  const router = useRouter();
  const { data: txData, isLoading } = useTransactions(1);

  const txs = useMemo(() => {
    const all = (txData?.items ?? []) as any[];
    return all.filter((t) => txBelongsToAsset(t, sym)).slice(0, 6);
  }, [txData, sym]);

  if (!isLoading && txs.length === 0) return null;

  return (
    <View style={{
      borderRadius: 16, backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border, overflow: 'hidden',
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: p.border,
      }}>
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
          {sym} ACTIVITY
        </Text>
        <Pressable
          onPress={() => router.push('/history')}
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 2 })}
        >
          <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700' }}>VIEW ALL</Text>
          <Ionicons name="chevron-forward" size={11} color={p.fgMuted} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator color={p.fgMuted} />
        </View>
      ) : (
        txs.map((t: any, i: number) => (
          <AssetTxRow
            key={t.id ?? `${t.reference ?? i}`}
            tx={t}
            palette={p}
            last={i === txs.length - 1}
            onPress={() => router.push('/history')}
          />
        ))
      )}
    </View>
  );
}

/* ── News section ─── */
interface NewsItem {
  title: string;
  source: string;
  url: string;
  published: number;
  imageUrl?: string;
  body?: string;
  categories?: string;
}

function NewsSection({ p, sym }: { p: Palette; sym: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isFiat = FIAT_CODES.has(sym);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIsFallback(false);
    setFetchFailed(false);
    setNews([]);

    if (isFiat) { setLoading(false); return; }

    async function load() {
      try {
        const { data } = await api.get('/news', { params: { sym } });
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? (data.items as NewsItem[]) : [];
        setNews(items);
        setIsFallback(!!data?.fallback);
      } catch {
        if (cancelled) return;
        setFetchFailed(true);
        setNews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, isFiat, reloadKey]);

  if (isFiat) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
        <Ionicons name="cash-outline" size={32} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', textAlign: 'center' }}>
          Market news isn't available for fiat currencies.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{
            borderRadius: 14, backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            padding: 14, gap: 8,
            opacity: 1 - i * 0.18,
          }}>
            <View style={{ height: 13, borderRadius: 6, backgroundColor: p.border, width: '85%' }} />
            <View style={{ height: 13, borderRadius: 6, backgroundColor: p.border, width: '60%' }} />
            <View style={{ height: 10, borderRadius: 5, backgroundColor: p.border, width: '35%', marginTop: 2 }} />
          </View>
        ))}
      </View>
    );
  }

  if (fetchFailed) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }}>
        <Ionicons name="cloud-offline-outline" size={32} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', textAlign: 'center' }}>
          Couldn't reach the news feed.
        </Text>
        <Pressable
          onPress={() => setReloadKey((n) => n + 1)}
          style={({ pressed }) => ({
            paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            flexDirection: 'row', alignItems: 'center', gap: 6,
          })}
        >
          <Ionicons name="refresh" size={14} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (news.length === 0) {
    return (
      <View style={{ paddingVertical: 48, alignItems: 'center', gap: 10 }}>
        <Ionicons name="newspaper-outline" size={32} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '500', textAlign: 'center' }}>
          No recent {sym} news found.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 1 }}>
      {isFallback && (
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
          TOP CRYPTO NEWS
        </Text>
      )}
      {news.map((item, i) => (
        <Pressable
          key={i}
          onPress={() => item.url && Linking.openURL(item.url)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? p.bgElev : p.bg,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: p.border,
            marginBottom: 10,
            gap: 6,
          })}
        >
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', lineHeight: 20 }} numberOfLines={3}>
            {item.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={{
              paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
              backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
            }}>
              <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700' }}>{item.source}</Text>
            </View>
            <Text style={{ color: p.fgFaint, fontSize: 11 }}>
              {new Date(item.published * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            <Ionicons name="open-outline" size={11} color={p.fgFaint} style={{ marginLeft: 'auto' as any }} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/* ── Sparkline chart ─── */
function monotoneCubicPath(pts: { x: number; y: number }[]): string {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const m:  number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i]  = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  const tangents: number[] = new Array(n);
  tangents[0]     = m[0];
  tangents[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) tangents[i] = 0;
    else tangents[i] = (m[i - 1] + m[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { tangents[i] = 0; tangents[i + 1] = 0; continue; }
    const a = tangents[i]     / m[i];
    const b = tangents[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tangents[i]     = t * a * m[i];
      tangents[i + 1] = t * b * m[i];
    }
  }

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const hv = dx[i];
    const c1x = pts[i].x     + hv / 3;
    const c1y = pts[i].y     + (tangents[i]     * hv) / 3;
    const c2x = pts[i + 1].x - hv / 3;
    const c2y = pts[i + 1].y - (tangents[i + 1] * hv) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

function SparklineChart({ points, color, palette: p, onHoverPrice, livePrice }: {
  points: import('@/hooks/useOHLC').ChartPoint[];
  color: string;
  palette: Palette;
  onHoverPrice?: (price: number | null) => void;
  livePrice?: number | null;
}) {
  const W = 320;
  const H = 168;
  const PAD = 6;        // vertical inset only — keeps peaks/troughs off the edge
  const HPAD = 0;       // horizontal inset — 0 so the line fills the box edge-to-edge
  const CARD_INSET = 8; // matches the chart card's `padding: 8`
  const [hoverDate, setHoverDate]   = useState<string | null>(null);
  const [hoverPriceLabel, setHoverPriceLabel] = useState<string | null>(null);
  const [svgPxW, setSvgPxW]         = useState(0);

  const series = useMemo(() => {
    if (!livePrice || !Number.isFinite(livePrice) || points.length === 0) return points;
    const last = points[points.length - 1];
    const delta = Math.abs(last.price - livePrice) / (last.price || 1);
    const next = { price: livePrice, timestamp: Date.now() };
    return delta < 0.02 ? [...points.slice(0, -1), next] : [...points, next];
  }, [points, livePrice]);

  const chart = useMemo(() => {
    const values = series.map((pt) => pt.price);
    if (values.length < 2) return null;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;
    const step = (W - HPAD * 2) / (values.length - 1);

    const pts = values.map((v, i) => ({
      x: HPAD + i * step,
      y: PAD + (H - PAD * 2) * (1 - (v - min) / spread),
      val: v,
      ts: series[i]?.timestamp ?? 0,
    }));

    const last = pts[pts.length - 1];
    const linePath = monotoneCubicPath(pts);
    const areaPath = `${linePath} L ${last.x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;
    const grid = [0.25, 0.5, 0.75].map((f) => PAD + (H - PAD * 2) * f);
    return { pts, step, last, linePath, areaPath, grid };
  }, [series]);

  const isLive = livePrice != null && Number.isFinite(livePrice);

  const hoverX = useSharedValue(-1);
  const hoverY = useSharedValue(-1);
  const hoverOpacity = useSharedValue(0);

  const pxToVB = (px: number) => svgPxW <= 0 ? NaN : ((px - CARD_INSET) * W) / svgPxW;

  const handleHover = (px: number) => {
    if (px < 0) {
      if (onHoverPrice) onHoverPrice(null);
      setHoverDate(null);
      setHoverPriceLabel(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const vbX = pxToVB(px);
    if (!chart || !Number.isFinite(vbX) || vbX < 0 || vbX > W) {
      if (onHoverPrice) onHoverPrice(null);
      setHoverDate(null);
      setHoverPriceLabel(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const { pts, step } = chart;
    const idx = Math.min(pts.length - 1, Math.max(0, Math.round((vbX - HPAD) / step)));
    const pt = pts[idx];
    hoverX.value = pt.x;
    hoverY.value = pt.y;
    hoverOpacity.value = withTiming(1, { duration: 50 });
    if (onHoverPrice) onHoverPrice(pt.val);
    const d = new Date(pt.ts);
    setHoverDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    setHoverPriceLabel(formatPrice(pt.val));
  };

  const pan = Gesture.Pan()
    .onBegin((e: any)  => { runOnJS(handleHover)(e.x); })
    .onChange((e: any) => { runOnJS(handleHover)(e.x); })
    .onFinalize(()     => { runOnJS(handleHover)(-1); });

  const vbToPxScale = svgPxW > 0 ? svgPxW / W : 1;

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [
      { translateX: hoverX.value * vbToPxScale + CARD_INSET },
      { translateY: hoverY.value + CARD_INSET },
    ],
    position: 'absolute', left: -6, top: -6,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: color, borderWidth: 2, borderColor: p.bgElev,
    shadowColor: color, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  }));

  const lineStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value * vbToPxScale + CARD_INSET }],
    position: 'absolute', left: 0, top: PAD + CARD_INSET,
    width: 1, height: H - PAD * 2, backgroundColor: p.border,
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value * vbToPxScale + CARD_INSET - 28 }],
    position: 'absolute', top: -2, left: 0,
    minWidth: 56, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, backgroundColor: p.fg,
    alignItems: 'center', justifyContent: 'center',
  }));

  if (!chart) {
    return (
      <View style={{ width: '100%', height: H, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
        <LoadingPulse size={48} icon="trending-up-outline" />
      </View>
    );
  }

  const { last, linePath, areaPath, grid } = chart;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ position: 'relative' }}>
        <Animated.View style={{
          borderRadius: 16, backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border, padding: 8, overflow: 'hidden',
        }}>
          <Svg
            width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - svgPxW) > 0.5) setSvgPxW(w);
            }}
          >
            <Defs>
              <SvgLinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0.3" />
                <Stop offset="1" stopColor={color} stopOpacity="0" />
              </SvgLinearGradient>
            </Defs>
            {grid.map((y, i) => (
              <SvgLine key={i} x1={0} x2={W} y1={y} y2={y} stroke={p.border} strokeWidth={1} strokeDasharray="3,4" />
            ))}
            <Path d={areaPath} fill="url(#grad)" />
            <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </Svg>
          {/* Tip dot drawn as an RN view so it stays circular under the
              non-uniform SVG scale, and lines up with the cursor math. */}
          {svgPxW > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (last.x / W) * svgPxW + CARD_INSET - (isLive ? 4.5 : 4),
                top:  last.y + CARD_INSET - (isLive ? 4.5 : 4),
                width: (isLive ? 4.5 : 4) * 2, height: (isLive ? 4.5 : 4) * 2,
                borderRadius: isLive ? 4.5 : 4, backgroundColor: color,
              }}
            />
          )}
          <Animated.View style={lineStyle} />
          <Animated.View style={cursorStyle} />
          {hoverPriceLabel && (
            <Animated.View style={tagStyle} pointerEvents="none">
              <Text style={{ color: p.bg, fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {hoverPriceLabel}
              </Text>
            </Animated.View>
          )}
          {hoverDate && (
            <Text style={{
              position: 'absolute', bottom: 6, left: 0, right: 0,
              textAlign: 'center', color: p.fgFaint, fontSize: 11, fontWeight: '500',
            }} pointerEvents="none">{hoverDate}</Text>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function CandleChart({ candles, palette: p, upColor, downColor, onHoverPrice }: {
  candles: Candle[];
  palette: Palette;
  upColor: string;
  downColor: string;
  onHoverPrice?: (price: number | null) => void;
}) {
  const W = 320;
  const H = 168;
  const PAD = 6;
  const CARD_INSET = 8; // matches the chart card's `padding: 8`
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [hoverPriceLabel, setHoverPriceLabel] = useState<string | null>(null);
  const [svgPxW, setSvgPxW] = useState(0);

  const hoverX = useSharedValue(-1);
  const hoverOpacity = useSharedValue(0);

  const chart = useMemo(() => {
    if (candles.length < 2) return null;
    let min = Infinity, max = -Infinity;
    for (const c of candles) { if (c.low < min) min = c.low; if (c.high > max) max = c.high; }
    const spread = max - min || 1;
    const innerW = W - PAD * 2;
    const slot = innerW / candles.length;
    const bodyW = Math.max(1.5, slot * 0.62);
    const yOf = (v: number) => PAD + (H - PAD * 2) * (1 - (v - min) / spread);
    const bars = candles.map((c, i) => {
      const cx = PAD + slot * (i + 0.5);
      const up = c.close >= c.open;
      const yO = yOf(c.open), yC = yOf(c.close);
      return {
        cx, up,
        wickTop: yOf(c.high), wickBottom: yOf(c.low),
        bodyTop: Math.min(yO, yC),
        bodyH: Math.max(1, Math.abs(yC - yO)),
        close: c.close, ts: c.timestamp,
      };
    });
    return { bars, slot, bodyW };
  }, [candles]);

  const pxToVB = (px: number) => svgPxW <= 0 ? NaN : ((px - CARD_INSET) * W) / svgPxW;

  const handleHover = (px: number) => {
    if (px < 0 || !chart) {
      if (onHoverPrice) onHoverPrice(null);
      setHoverDate(null);
      setHoverPriceLabel(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const vbX = pxToVB(px);
    if (!Number.isFinite(vbX) || vbX < PAD || vbX > W - PAD) {
      if (onHoverPrice) onHoverPrice(null);
      setHoverDate(null);
      setHoverPriceLabel(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const idx = Math.min(chart.bars.length - 1, Math.max(0, Math.floor((vbX - PAD) / chart.slot)));
    const bar = chart.bars[idx];
    hoverX.value = bar.cx;
    hoverOpacity.value = withTiming(1, { duration: 50 });
    if (onHoverPrice) onHoverPrice(bar.close);
    const d = new Date(bar.ts);
    setHoverDate(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    setHoverPriceLabel(formatPrice(bar.close));
  };

  const pan = Gesture.Pan()
    .onBegin((e: any)  => { runOnJS(handleHover)(e.x); })
    .onChange((e: any) => { runOnJS(handleHover)(e.x); })
    .onFinalize(()     => { runOnJS(handleHover)(-1); });

  const vbToPxScale = svgPxW > 0 ? svgPxW / W : 1;

  const lineStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value * vbToPxScale + CARD_INSET }],
    position: 'absolute', left: 0, top: PAD + CARD_INSET,
    width: 1, height: H - PAD * 2, backgroundColor: p.border,
  }));

  if (!chart) {
    return (
      <View style={{ width: '100%', height: H, borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
        <LoadingPulse size={48} icon="stats-chart-outline" />
      </View>
    );
  }

  const { bars, bodyW } = chart;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ position: 'relative' }}>
        <Animated.View style={{
          borderRadius: 16, backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border, padding: 8, overflow: 'hidden',
        }}>
          <Svg
            width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - svgPxW) > 0.5) setSvgPxW(w);
            }}
          >
            {[0.25, 0.5, 0.75].map((f, i) => {
              const y = PAD + (H - PAD * 2) * f;
              return <SvgLine key={i} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke={p.border} strokeWidth={1} strokeDasharray="3,4" />;
            })}
            {bars.map((b, i) => {
              const c = b.up ? upColor : downColor;
              return (
                <Fragment key={i}>
                  <SvgLine x1={b.cx} x2={b.cx} y1={b.wickTop} y2={b.wickBottom} stroke={c} strokeWidth={1} />
                  <Rect x={b.cx - bodyW / 2} y={b.bodyTop} width={bodyW} height={b.bodyH} fill={c} rx={0.5} />
                </Fragment>
              );
            })}
          </Svg>
          <Animated.View style={lineStyle} />
          {hoverDate && (
            <Text style={{
              position: 'absolute', bottom: 6, left: 0, right: 0,
              textAlign: 'center', color: p.fgFaint, fontSize: 11, fontWeight: '500',
            }} pointerEvents="none">{hoverDate}</Text>
          )}
          {hoverPriceLabel && (
            <View style={{
              position: 'absolute', top: 6, right: 8,
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: p.fg,
            }} pointerEvents="none">
              <Text style={{ color: p.bg, fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                {hoverPriceLabel}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function StatTile({ label, value, icon, palette: p }: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap; palette: Palette;
}) {
  return (
    <View style={{
      flex: 1, borderRadius: 14,
      backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
      padding: 14, gap: 6,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={11} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={{ color: p.fg, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function formatPrice(n: number): string {
  if (n === 0)     return '0.00';
  if (n >= 1000)   return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.01)   return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
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

/* ── Fiat asset view ─── */
function FiatAssetView({ sym, wallet, p, h }: {
  sym: Currency; wallet: Wallet | undefined; p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
}) {
  const { data: txData } = useTransactions(1);
  const txs = (txData?.items ?? []).filter((t: any) => t.currency === sym).slice(0, 8);
  const balance = wallet ? Number(wallet.balance) : 0;
  const usdValue = wallet ? Number(wallet.fiatValueUsd) : 0;
  const fxRate = balance > 0 ? usdValue / balance : 0;
  const meta = CURRENCY_META[sym];

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 16, gap: 16 }}>
      {/* Balance card */}
      <View style={{
        borderRadius: 18, padding: 20,
        backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Available Balance
          </Text>
          <CurrencyBadge code={sym} size="sm" variant="chip" />
        </View>
        <Text style={{
          color: p.fg, fontSize: 36, fontWeight: '700',
          letterSpacing: -1.2, fontVariant: ['tabular-nums'],
        }}>
          {formatMoney(balance, sym, { showSymbol: true })}
        </Text>
        {sym !== 'USD' && fxRate > 0 && (
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 6 }}>
            ≈ {formatMoney(usdValue, 'USD', { showSymbol: true })}
            {'  ·  '}1 {sym} = {formatMoney(fxRate, 'USD', { showSymbol: true, maxDecimals: 4 })}
          </Text>
        )}
      </View>

      {/* Activity */}
      {txs.length > 0 ? (
        <View style={{ borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: p.border }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>RECENT ACTIVITY</Text>
          </View>
          {txs.map((t: any) => {
            const amt = Number(t.amount);
            const pos = amt >= 0;
            return (
              <View key={t.id} style={{
                flexDirection: 'row', alignItems: 'center',
                paddingVertical: 14, paddingHorizontal: 16,
                borderBottomWidth: 1, borderBottomColor: p.border, gap: 12,
              }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={pos ? 'arrow-down' : 'arrow-up'} size={15} color={pos ? p.greenFg : p.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
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
          })}
        </View>
      ) : (
        <View style={{ paddingVertical: 32, alignItems: 'center', gap: 8 }}>
          <Ionicons name="receipt-outline" size={28} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>No transactions yet</Text>
        </View>
      )}

      {/* Bank details */}
      <View style={{ borderRadius: 16, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: p.border }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>BANK DETAILS</Text>
        </View>
        {[
          { label: 'Account Name', value: 'Tazdan Ltd' },
          { label: 'Bank Name', value: 'Emirates NBD' },
          { label: 'IBAN', value: 'AE00 0000 0000 0000 0000 000' },
          { label: 'SWIFT', value: 'EBILAEAD' },
          { label: 'Reference', value: sym },
        ].map(({ label, value }, i, arr) => (
          <BankDetailRow key={label} label={label} value={value} p={p} last={i === arr.length - 1} />
        ))}
      </View>

      <NewsSection p={p} sym={sym} />
    </View>
  );
}

function BankDetailRow({ label, value, p, last }: { label: string; value: string; p: Palette; last?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={() => { Clipboard.setStringAsync(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 13, paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{value}</Text>
        <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={14} color={copied ? p.greenFg : p.fgFaint} />
      </View>
    </Pressable>
  );
}
