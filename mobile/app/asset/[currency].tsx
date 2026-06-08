/**
 * Asset detail screen — works for every tradeable token, not just the
 * hardcoded CoinGecko list. Falls back to Binance REST for price + chart
 * when the coin isn't in the backend ticker feed.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useAuthStore } from '@/store/authStore';
import { useDiscussionRealtime } from '@/hooks/useDiscussionRealtime';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop, Line as SvgLine, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { CURRENCY_META, getCurrencyMeta } from '@/constants';
import { formatMoney } from '@/utils/format';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { AssetTxRow, txBelongsToAsset } from '@/components/transactions/AssetTxRow';

type Range = '1H' | '24H' | '7D' | '30D' | '1Y' | 'ALL';
type Tab = 'activity' | 'news' | 'discussion';
type ChartType = 'line' | 'candle';
interface TradeMarker { ts: number; price: number; actualPrice?: number; side: 'BUY' | 'SELL' }

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
  // 1Y: daily candles (~365). ALL: weekly candles (Binance returns from listing,
  // capped at 1000 weeks which comfortably covers every asset's full history).
  '1Y': '1d', 'ALL': '1w',
};
const BINANCE_LIMITS: Record<Range, number> = {
  '1H': 60, '24H': 96, '7D': 42, '30D': 30,
  '1Y': 365, 'ALL': 1000,
};

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

function useBinanceChart(sym: string, range: Range, enabled: boolean) {
  return useQuery({
    queryKey: ['binance-chart', sym, range],
    enabled: enabled && sym !== 'USDT' && sym !== 'USDT_ERC20' && sym !== 'USDT_TRC20',
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const base = sym.replace(/_ERC20|_TRC20/, '');
      const res = await fetchWithTimeout(
        `https://api.binance.com/api/v3/klines?symbol=${base}USDT&interval=${BINANCE_INTERVALS[range]}&limit=${BINANCE_LIMITS[range]}`,
        8000,
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
  const { currency, action } = useLocalSearchParams<{ currency: string; action?: string }>();
  const sym = (currency ?? 'BTC').toUpperCase();
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const insets = useSafeAreaInsets();

  const { data: markets } = useMarkets();
  const { data: wallets } = useWallets();
  const [range, setRange] = useState<Range>('24H');
  const [tab, setTab] = useState<Tab>('activity');
  const [buyOpen, setBuyOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  // Deep-link: /asset/DOGE?action=sell opens straight into the sell sheet
  // (used by the dust-convert prompt on the home screen).
  const [sellOpen, setSellOpen] = useState(action === 'sell');
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

  const { data: cgOhlc, isLoading: cgLoading, isError: cgError } = useOHLC(coinId, range);
  const { data: cgCandles } = useOHLCCandles(coinId, range);
  const { data: binanceChart, isLoading: binanceChartLoading, isError: binanceError } = useBinanceChart(sym, range, needsBinance);
  const [chartType, setChartType] = useState<ChartType>('line');

  // ALL availability: if the ALL fetch errors or comes back empty (asset has
  // < the full history CoinGecko can serve), hide the ALL button and snap back
  // to 1Y so the chart never sits spinning forever.
  const [allUnavailable, setAllUnavailable] = useState(false);
  useEffect(() => {
    if (range !== 'ALL') return;
    const failed = (cgError && binanceError) ||
      (!cgLoading && !binanceChartLoading && !cgOhlc?.length && !binanceChart?.prices?.length);
    if (failed) {
      setAllUnavailable(true);
      setRange('1Y');
    }
  }, [range, cgError, binanceError, cgLoading, binanceChartLoading, cgOhlc, binanceChart]);

  // Quote spread (e.g. 0.025 = 2.5%). Charts mark up raw market prices by this
  // so the line/candles and the buy/sell markers (which use marked-up execution
  // prices) all sit in the same price space the user actually transacts at.
  const { data: spreadResp } = useQuery({
    queryKey: ['quote-spread'],
    queryFn: async () => {
      const r = await api.get<{ spreadPct: string }>('/exchange/spread');
      return Number(r.data?.spreadPct ?? 0);
    },
    staleTime: 5 * 60_000,
  });
  const markup = 1 + (Number.isFinite(spreadResp) ? (spreadResp ?? 0) : 0);

  const rawChartPoints: import('@/hooks/useOHLC').ChartPoint[] = useMemo(() => {
    if (cgOhlc) return cgOhlc;
    if (binanceChart) {
      return binanceChart.prices.map((price, i) => ({
        price,
        timestamp: binanceChart.timestamps[i] ?? Date.now(),
      }));
    }
    return [];
  }, [cgOhlc, binanceChart]);
  // Apply the markup so the chart shows the user-facing (marked-up) price.
  const chartPoints = useMemo(
    () => markup === 1 ? rawChartPoints : rawChartPoints.map((p) => ({ ...p, price: p.price * markup })),
    [rawChartPoints, markup],
  );

  const change = useMemo(() => {
    // 1Y / ALL have no precomputed CoinGecko percentage — derive from the
    // chart's own first→last close so the header % matches the visible range.
    if (range === '1Y' || range === 'ALL') {
      if (chartPoints.length >= 2) {
        const first = chartPoints[0].price;
        const last = chartPoints[chartPoints.length - 1].price;
        if (first > 0) return ((last - first) / first) * 100;
      }
      return 0;
    }
    if (market) {
      switch (range) {
        case '1H':  return market.price_change_percentage_1h_in_currency  ?? 0;
        case '24H': return market.price_change_percentage_24h             ?? 0;
        case '7D':  return market.price_change_percentage_7d_in_currency  ?? 0;
        case '30D': return market.price_change_percentage_30d_in_currency ?? 0;
      }
    }
    return binanceData?.change24h ?? 0;
  }, [market, binanceData, range, chartPoints]);
  const positive = change >= 0;

  const candles: Candle[] = useMemo(() => {
    const raw = cgCandles?.length ? cgCandles
      : binanceChart?.candles?.length ? binanceChart.candles
      : [];
    if (markup === 1) return raw;
    // Mark up OHLC so candles match the marked-up line + markers.
    return raw.map((c) => ({
      ...c,
      open: c.open * markup,
      high: c.high * markup,
      low: c.low * markup,
      close: c.close * markup,
    }));
  }, [cgCandles, binanceChart, markup]);

  const chartLoading = cgLoading || binanceChartLoading;
  const hasChart = !isFiat && sym !== 'USDT' && sym !== 'USDT_ERC20' && sym !== 'USDT_TRC20';

  // ── User's own buy/sell trades for this asset → chart markers ──────────────
  // Pulls completed orders and keeps only those for this symbol within the
  // visible time window, so the markers line up with the rendered range.
  const { data: ordersResp } = useQuery({
    queryKey: ['asset-orders', sym],
    enabled: hasChart,
    queryFn: async () => {
      const r = await api.get<{ orders: any[] }>('/exchange/orders?page=1&limit=100');
      return r.data?.orders ?? [];
    },
    staleTime: 60_000,
  });

  const tradeMarkers = useMemo(() => {
    if (!Array.isArray(ordersResp) || chartPoints.length < 2) return [];
    const tStart = chartPoints[0].timestamp;
    const tEnd = chartPoints[chartPoints.length - 1].timestamp;
    return ordersResp
      .filter((o) =>
        String(o.asset).toUpperCase() === sym &&
        o.status === 'EXECUTED') // CryptoOrderStatus: PENDING|EXECUTED|FAILED|REFUNDED
      .map((o) => {
        const ts = new Date(o.executedAt ?? o.createdAt).getTime();
        // Position the marker on the same marked-up basis as the chart line
        // (raw market price × markup) so it lands ON the curve. The label still
        // shows the user's real executed price (`quotedPrice`).
        const rawMarket = Number(o.marketPrice ?? o.quotedPrice ?? 0);
        return {
          ts,
          price: rawMarket * markup,
          actualPrice: Number(o.quotedPrice ?? rawMarket),
          side: (o.type === 'SELL' ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
        };
      })
      .filter((m) => m.price > 0 && m.ts >= tStart && m.ts <= tEnd);
  }, [ordersResp, sym, chartPoints, markup]);

  const wallet = wallets?.find((w) => w.currency === sym);
  const balance = wallet ? Number(wallet.balance) : 0;
  const holdingsUsd = balance * price;
  const holdingsDelta = change !== 0 ? (holdingsUsd * change) / (100 + Math.abs(change)) : 0;

  const displayName = market?.name ?? friendlyName(sym);
  const visiblePrice = hoverPrice !== null ? hoverPrice : price;
  const changeUsd = Math.abs((visiblePrice || 0) * (change / 100));

  // ── Modals ──
  const buyModal = (
    <Modal visible={buyOpen} transparent animationType="slide" onRequestClose={() => setBuyOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setBuyOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: '92%' }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 12) }}>
              <BuyWidget defaultAsset={sym} lockAsset={!isFiat} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );

  const sellModal = (
    <Modal visible={sellOpen} transparent animationType="slide" onRequestClose={() => setSellOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setSellOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: '92%' }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <View style={{ flex: 1, paddingBottom: Math.max(insets.bottom, 12) }}>
              <SellWidget defaultAsset={sym} lockAsset={!isFiat} />
            </View>
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

      {/* ── Screenshot-style top block ── */}
      <View style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 20,
        paddingBottom: 8,
        backgroundColor: p.bg,
        overflow: 'hidden',
      }}>
        <TopGradient height={insets.top + 88} />
        <View style={{ height: 44, justifyContent: 'center' }}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={({ pressed }) => ({
              position: 'absolute',
              left: -6,
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: pressed ? p.bgElev : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text
            style={{ color: p.fg, fontSize: 17, fontWeight: '800', textAlign: 'center' }}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          <View style={{ position: 'absolute', right: -2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => { h.selection(); setDepositOpen(true); }}
              disabled={!wallet}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: pressed ? p.bgElev : 'transparent',
                alignItems: 'center', justifyContent: 'center',
                opacity: wallet ? 1 : 0.36,
              })}
            >
              <Ionicons name="qr-code-outline" size={22} color={p.fgMuted} />
            </Pressable>
            <ChartModeToggle chartType={chartType} setChartType={setChartType} p={p} h={h} />
          </View>
        </View>
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <Text style={{
            color: p.fg,
            fontSize: 48,
            lineHeight: 56,
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
            textAlign: 'center',
          }}>
            ${formatPrice(visiblePrice)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Ionicons
              name={positive ? 'arrow-up' : 'arrow-down'}
              size={22}
              color={positive ? p.greenFg : p.redFg}
            />
            <Text style={{
              color: positive ? p.greenFg : p.redFg,
              fontSize: 18,
              fontWeight: '800',
              fontVariant: ['tabular-nums'],
            }}>
              {positive ? '+' : '-'} ${formatPrice(changeUsd)} ({Math.abs(change).toFixed(2)}%)
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 32, gap: 16 }}
      >
        <AssetChartPanel
          sym={sym}
          p={p}
          h={h}
          hasChart={hasChart}
          chartLoading={chartLoading}
          chartPoints={chartPoints}
          candles={candles}
          tradeMarkers={tradeMarkers}
          allUnavailable={allUnavailable}
          chartType={chartType}
          color={positive ? p.fg : p.redFg}
          range={range}
          setRange={setRange}
          onHoverPrice={setHoverPrice}
          isLive={isLive}
          wsPrice={wsPrice}
        />

        <AssetIdentityRow
          sym={sym}
          name={displayName}
          p={p}
          wallet={wallet}
          balance={balance}
          holdingsUsd={holdingsUsd}
          holdingsDelta={holdingsDelta}
          positive={positive}
        />

        <AssetStatsGrid
          sym={sym}
          p={p}
          market={market}
          binanceData={binanceData}
        />

        <AssetBottomTabs tab={tab} setTab={setTab} h={h} p={p} />

        {tab === 'activity' ? (
          <View style={{ gap: 14 }}>
            <AssetTransactions sym={sym} p={p} />
          </View>
        ) : tab === 'news' ? (
          <NewsTab p={p} sym={sym} />
        ) : (
          <AssetDiscussionTab sym={sym} p={p} h={h} />
        )}
      </ScrollView>

      {actionBar}
      {buyModal}
      {sellModal}
      <DepositAddressModal
        visible={depositOpen}
        onClose={() => setDepositOpen(false)}
        sym={sym}
        wallet={wallet}
        p={p}
        h={h}
      />
    </View>
  );
}

function ChartModeToggle({
  chartType, setChartType, p, h,
}: {
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  p: Palette;
  h: { selection: () => void };
}) {
  return (
    <View style={{
      flexDirection: 'row',
      padding: 3,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.bgElev,
      gap: 2,
    }}>
      {([
        ['line', 'pulse-outline'],
        ['candle', 'stats-chart-outline'],
      ] as [ChartType, keyof typeof Ionicons.glyphMap][]).map(([type, icon]) => {
        const active = chartType === type;
        return (
          <Pressable
            key={type}
            onPress={() => { h.selection(); setChartType(type); }}
            hitSlop={6}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? p.fg : 'transparent',
            }}
          >
            <Ionicons name={icon} size={15} color={active ? p.bg : p.fgMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Chart panel ─────────────────────────────────────────────────── */
function AssetChartPanel({
  sym, p, h, hasChart, chartLoading, chartPoints, candles, tradeMarkers, allUnavailable, chartType, color,
  range, setRange, onHoverPrice, isLive, wsPrice,
}: {
  sym: string; p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
  hasChart: boolean; chartLoading: boolean;
  chartPoints: import('@/hooks/useOHLC').ChartPoint[];
  candles: Candle[];
  tradeMarkers: TradeMarker[];
  allUnavailable: boolean;
  chartType: ChartType;
  color: string; range: Range;
  setRange: (r: Range) => void;
  onHoverPrice: (v: number | null) => void;
  isLive: boolean; wsPrice: number | null;
}) {
  return (
    <View style={{ gap: 16 }}>
      {/* Chart */}
      {hasChart ? (
        <View>
          <View style={{ marginHorizontal: -16 }}>
          {chartLoading ? (
            <View style={{
              height: 220,
              backgroundColor: 'transparent',
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
              markers={tradeMarkers}
            />
          ) : (
            <SparklineChart
              points={chartPoints}
              color={color}
              palette={p}
              onHoverPrice={onHoverPrice}
              livePrice={isLive ? wsPrice : null}
              markers={tradeMarkers}
            />
          )}
          </View>
          {/* Range selector */}
          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            marginTop: 8, padding: 4,
            borderRadius: 14,
            backgroundColor: p.bgElev,
            borderWidth: 1, borderColor: p.border,
            gap: 4,
          }}>
            {(['1H', '24H', '7D', '30D', '1Y', 'ALL'] as Range[])
              .filter((r) => !(r === 'ALL' && allUnavailable))
              .map((r) => (
              <Pressable
                key={r}
                onPress={() => { h.selection(); setRange(r); }}
                style={{ flex: 1 }}
              >
                <View style={{
                  paddingVertical: 9, borderRadius: 10, alignItems: 'center',
                  backgroundColor: range === r ? p.accent : 'transparent',
                }}>
                  <Text style={{
                    color: range === r ? p.accentFg : p.fgMuted,
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

    </View>
  );
}

function PositionPill({
  label, count, color, icon, p,
}: {
  label: string;
  count: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  p: Palette;
}) {
  return (
    <View style={{
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: p.border,
      backgroundColor: p.bgElev,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    }}>
      <View style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color === p.greenFg ? p.greenBg : 'rgba(239,68,68,0.14)',
      }}>
        <Ionicons name={icon} size={13} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
          {count}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function AssetIdentityRow({
  sym, name, p, wallet, balance, holdingsUsd, holdingsDelta, positive,
}: {
  sym: string;
  name: string;
  p: Palette;
  wallet: Wallet | undefined;
  balance: number;
  holdingsUsd: number;
  holdingsDelta: number;
  positive: boolean;
}) {
  const hasHoldings = !!wallet && balance > 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 2, paddingVertical: 2 }}>
      <CoinIcon symbol={sym} size={54} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800' }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
          {sym}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', minWidth: 108 }}>
        <Text style={{ color: p.fg, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
          ${holdingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
          {hasHoldings ? balance.toLocaleString('en-US', { maximumFractionDigits: 8 }) : '0'} {sym}
        </Text>
        {hasHoldings && holdingsDelta !== 0 && (
          <Text style={{ color: positive ? p.greenFg : p.redFg, fontSize: 11, fontWeight: '700', marginTop: 3 }}>
            {positive ? '+' : '-'}${Math.abs(holdingsDelta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
        )}
      </View>
    </View>
  );
}

function AssetStatsGrid({
  sym, p, market, binanceData,
}: {
  sym: string;
  p: Palette;
  market: CoinGeckoMarket | undefined;
  binanceData: { price: number; change24h: number; volume24h: number } | null | undefined;
}) {
  const volume = market?.total_volume || binanceData?.volume24h || 0;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'stretch',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: p.border,
      paddingVertical: 11,
    }}>
      <InlineStat label="Market Cap" value={market ? fmtUsdCompact(market.market_cap) : '—'} p={p} />
      <InlineStat label="Volume" value={volume ? fmtUsdCompact(volume) : '—'} p={p} />
      <InlineStat label="Supply" value={market?.circulating_supply ? fmtSupply(market.circulating_supply, sym) : '—'} p={p} />
      <InlineStat label="ATH" value={market?.ath ? `$${formatPrice(market.ath)}` : '—'} p={p} last />
    </View>
  );
}

function InlineStat({ label, value, p, last }: { label: string; value: string; p: Palette; last?: boolean }) {
  return (
    <View style={{
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 6,
      borderRightWidth: last ? 0 : 1,
      borderRightColor: p.border,
    }}>
      <Text style={{ color: p.fgMuted, fontSize: 9, fontWeight: '800' }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: p.fg, fontSize: 11, fontWeight: '800', marginTop: 4, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
        {value}
      </Text>
    </View>
  );
}

function AssetBottomTabs({
  tab, setTab, h, p,
}: {
  tab: Tab;
  setTab: (tab: Tab) => void;
  h: { selection: () => void };
  p: Palette;
}) {
  const tabs: [Tab, string][] = [
    ['activity', 'Activity'],
    ['news', 'News'],
    ['discussion', 'Discussions'],
  ];

  return (
    <View style={{
      flexDirection: 'row',
      gap: 6,
      padding: 5,
      borderRadius: 22,
      backgroundColor: p.pillBg,
    }}>
      {tabs.map(([value, label]) => {
        const active = tab === value;
        return (
          <Pressable
            key={value}
            onPress={() => { h.selection(); setTab(value); }}
            style={({ pressed }) => ({
              flex: 1,
              height: 42,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? p.fg : pressed ? p.bgElev : 'transparent',
            })}
          >
            <Text style={{ color: active ? p.bg : p.fgMuted, fontSize: 12, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type DiscussionPost = {
  id: string;
  author: {
    id?: string;
    displayName: string;
    username?: string | null;
    avatarUrl?: string | null;
  };
  tag: 'BULLISH' | 'BEARISH' | 'WATCH';
  body: string;
  createdAt: string | number | Date;
};

function AssetDiscussionTab({ sym, p, h }: {
  sym: string;
  p: Palette;
  h: { selection: () => void };
}) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = currentUser?.role === 'ADMIN';
  useDiscussionRealtime(sym);
  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState<DiscussionPost['tag']>('WATCH');
  const key = ['asset-discussions', sym];
  const { data, isLoading, isError } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const r = await api.get<{ posts: DiscussionPost[] }>(`/asset-discussions/${encodeURIComponent(sym)}`);
      return r.data.posts ?? [];
    },
    staleTime: 20_000,
  });
  const posts = data ?? [];
  const mutation = useMutation({
    mutationFn: async () => {
      const r = await api.post<{ post: DiscussionPost }>(`/asset-discussions/${encodeURIComponent(sym)}`, {
        body: draft.trim(),
        tag,
      });
      return r.data.post;
    },
    onSuccess: (post) => {
      queryClient.setQueryData<DiscussionPost[]>(key, (current = []) => [post, ...current.filter((p0) => p0.id !== post.id)]);
      setDraft('');
      setTag('WATCH');
    },
  });

  const submit = () => {
    if (!draft.trim() || mutation.isPending) return;
    h.selection();
    mutation.mutate();
  };

  // ── Moderation: delete (author/admin) + report (others) ──
  const removePost = (id: string) => {
    queryClient.setQueryData<DiscussionPost[]>(key, (cur = []) => cur.filter((x) => x.id !== id));
    api.delete(`/asset-discussions/${encodeURIComponent(sym)}/${id}`).catch(() => {
      // Roll back on failure by refetching the source of truth.
      queryClient.invalidateQueries({ queryKey: key });
    });
  };
  const reportPost = (id: string) => {
    api.post(`/asset-discussions/${encodeURIComponent(sym)}/${id}/report`).catch(() => {});
  };
  const onPostMenu = (post: DiscussionPost) => {
    h.selection();
    const mine = !!currentUser && post.author.id === currentUser.id;
    if (mine || isAdmin) {
      Alert.alert(
        'Post options',
        undefined,
        [
          { text: 'Delete', style: 'destructive', onPress: () => removePost(post.id) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } else {
      Alert.alert(
        'Report this post?',
        'Our team will review it. Posts with multiple reports are hidden automatically.',
        [
          { text: 'Report', style: 'destructive', onPress: () => reportPost(post.id) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: p.border,
        backgroundColor: p.bgElev,
        padding: 12,
        gap: 10,
      }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Discuss a potential ${sym} move`}
          placeholderTextColor={p.fgFaint}
          multiline
          style={{
            minHeight: 46,
            maxHeight: 96,
            color: p.fg,
            fontSize: 14,
            fontWeight: '600',
            padding: 0,
            textAlignVertical: 'top',
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          {(['BULLISH', 'WATCH', 'BEARISH'] as DiscussionPost['tag'][]).map((value) => {
            const active = tag === value;
            const tint = value === 'BULLISH' ? p.greenFg : value === 'BEARISH' ? p.redFg : p.fgMuted;
            return (
              <Pressable
                key={value}
                onPress={() => { h.selection(); setTag(value); }}
                style={({ pressed }) => ({
                  paddingHorizontal: 10,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? (value === 'BULLISH' ? p.greenBg : value === 'BEARISH' ? p.redBg : p.pillBg) : 'transparent',
                  borderWidth: 1,
                  borderColor: active ? tint : p.border,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: active ? tint : p.fgMuted, fontSize: 10, fontWeight: '800' }}>
                  {tagLabel(value)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={submit}
          disabled={!draft.trim() || mutation.isPending}
          style={({ pressed }) => ({
            alignSelf: 'flex-end',
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: p.ctaBg,
            opacity: !draft.trim() || mutation.isPending ? 0.35 : pressed ? 0.75 : 1,
          })}
        >
          {mutation.isPending ? <ActivityIndicator color={p.ctaFg} /> : <Ionicons name="send" size={16} color={p.ctaFg} />}
        </Pressable>
      </View>

      {isLoading && (
        <View style={{ paddingVertical: 26, alignItems: 'center' }}>
          <ActivityIndicator color={p.fgMuted} />
        </View>
      )}
      {isError && (
        <View style={{ paddingVertical: 26, alignItems: 'center', gap: 8 }}>
          <Ionicons name="cloud-offline-outline" size={24} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
            Could not load discussions.
          </Text>
        </View>
      )}
      {!isLoading && !isError && posts.length === 0 && (
        <View style={{ paddingVertical: 30, alignItems: 'center', gap: 8 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
            Start the first public {sym} discussion.
          </Text>
        </View>
      )}
      {posts.map((post) => (
        <View
          key={post.id}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: p.border,
            backgroundColor: p.bgElev,
            padding: 14,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '800' }}>{post.author.displayName}</Text>
            <View style={{
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 8,
              backgroundColor:
                post.tag === 'BULLISH' ? p.greenBg :
                post.tag === 'BEARISH' ? 'rgba(239,68,68,0.14)' : p.pillBg,
              borderWidth: 1,
              borderColor: post.tag === 'WATCH' ? p.border : 'transparent',
            }}>
              <Text style={{
                color:
                  post.tag === 'BULLISH' ? p.greenFg :
                  post.tag === 'BEARISH' ? p.redFg : p.fgMuted,
                fontSize: 10,
                fontWeight: '800',
              }}>
                {tagLabel(post.tag)}
              </Text>
            </View>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', marginLeft: 'auto' as any }}>
              {formatRelativeTime(post.createdAt)}
            </Text>
            <Pressable onPress={() => onPostMenu(post)} hitSlop={10} style={{ marginLeft: 8 }}>
              <Ionicons name="ellipsis-horizontal" size={16} color={p.fgFaint} />
            </Pressable>
          </View>
          <Text style={{ color: p.fg, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>
            {post.body}
          </Text>
        </View>
      ))}
    </View>
  );
}

function tagLabel(tag: DiscussionPost['tag']): string {
  if (tag === 'BULLISH') return 'Bullish';
  if (tag === 'BEARISH') return 'Bearish';
  return 'Watch';
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
function DepositAddressModal({ visible, onClose, sym, wallet, p, h }: {
  visible: boolean; onClose: () => void;
  sym: string; wallet: Wallet | undefined; p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
}) {
  const [addr, setAddr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const network = sym.replace(/_ERC20|_TRC20/, '');
  useEffect(() => {
    if (!visible || !wallet) return;
    setLoading(true);
    cryptoWalletAPI.depositAddress(sym, network)
      .then((res) => setAddr(res.data.address))
      .catch(() => setAddr(null))
      .finally(() => setLoading(false));
  }, [sym, wallet, network, visible]);

  const qrUrl = addr
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${encodeURIComponent(addr)}&bgcolor=ffffff&color=000000`
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.58)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 360,
            borderRadius: 24,
            backgroundColor: p.bg,
            borderWidth: 1,
            borderColor: p.border,
            padding: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800' }}>Deposit {sym}</Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                Copy your address or scan the QR code.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? p.bgElev : p.pillBg,
              })}
            >
              <Ionicons name="close" size={19} color={p.fg} />
            </Pressable>
          </View>
          {!wallet ? (
            <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', paddingVertical: 18 }}>
              Create a {sym} wallet before depositing.
            </Text>
          ) : loading ? (
            <View style={{ paddingVertical: 34, alignItems: 'center' }}>
              <LoadingPulse size={42} icon="qr-code-outline" />
            </View>
          ) : addr ? (
            <>
              {qrUrl && (
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: 18 }}>
                    <Image source={{ uri: qrUrl }} style={{ width: 188, height: 188, borderRadius: 6 }} resizeMode="contain" />
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
                  padding: 12, borderRadius: 14,
                  backgroundColor: p.pillBg,
                  borderWidth: 1, borderColor: copied ? p.greenFg : p.border,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color={copied ? p.greenFg : p.fgMuted} />
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600', flex: 1, fontFamily: 'monospace' }} numberOfLines={1}>{addr}</Text>
                <Text style={{ color: copied ? p.greenFg : p.fgMuted, fontSize: 11, fontWeight: '800' }}>
                  {copied ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', paddingVertical: 18 }}>
              Unable to load deposit address
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
          RECENT ACTIVITY
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
      ) : txs.length === 0 ? (
        <View style={{ paddingVertical: 28, alignItems: 'center', gap: 8 }}>
          <Ionicons name="receipt-outline" size={26} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600' }}>
            No {sym} activity yet.
          </Text>
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
  const [isCountry, setIsCountry] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isFiat = FIAT_CODES.has(sym);
  // For fiat, the feed is the currency's country/economy news.
  const countryName = isFiat ? (getCurrencyMeta(sym)?.name ?? sym) : sym;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIsFallback(false);
    setIsCountry(false);
    setFetchFailed(false);
    setNews([]);

    async function load() {
      try {
        const { data } = await api.get('/news', { params: { sym } });
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? (data.items as NewsItem[]) : [];
        setNews(items);
        setIsFallback(!!data?.fallback);
        setIsCountry(data?.kind === 'country');
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
  }, [sym, reloadKey]);

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
          {isFiat ? `No recent ${countryName} news found.` : `No recent ${sym} news found.`}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 1 }}>
      {isCountry ? (
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
          {countryName.toUpperCase()} · ECONOMY & MARKETS
        </Text>
      ) : isFallback ? (
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
          TOP CRYPTO NEWS
        </Text>
      ) : null}
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

function SparklineChart({ points, color, palette: p, onHoverPrice, livePrice, markers }: {
  points: import('@/hooks/useOHLC').ChartPoint[];
  color: string;
  palette: Palette;
  onHoverPrice?: (price: number | null) => void;
  livePrice?: number | null;
  markers?: TradeMarker[];
}) {
  const W = 320;
  const H = 220;
  const PAD = 0;
  const HPAD = 0;
  const CARD_INSET = 0;
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

    // Project trade markers onto chart coords. X from timestamp (interpolated
    // across the series span), Y from the marker's execution price.
    const tFirst = series[0]?.timestamp ?? 0;
    const tLast = series[series.length - 1]?.timestamp ?? 1;
    const tSpan = tLast - tFirst || 1;
    const markerPts = (markers ?? []).map((m) => ({
      x: HPAD + ((m.ts - tFirst) / tSpan) * (W - HPAD * 2),
      y: PAD + (H - PAD * 2) * (1 - (m.price - min) / spread),
      side: m.side,
      price: m.price,
    })).filter((mp) => mp.x >= 0 && mp.x <= W);

    return { pts, step, last, linePath, areaPath, markerPts };
  }, [series, markers]);

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
    backgroundColor: color, borderWidth: 2, borderColor: p.bg,
    shadowColor: color, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 }, elevation: 4,
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value * vbToPxScale + CARD_INSET - 28 }],
    position: 'absolute', top: 4, left: 0,
    minWidth: 56, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, backgroundColor: p.fg,
    alignItems: 'center', justifyContent: 'center',
  }));

  if (!chart) {
    return (
      <View style={{ width: '100%', height: H, alignItems: 'center', justifyContent: 'center' }}>
        <LoadingPulse size={48} icon="trending-up-outline" />
      </View>
    );
  }

  const { last, linePath, areaPath, markerPts } = chart;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ position: 'relative' }}>
        <Animated.View style={{
          height: H, overflow: 'visible',
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
          {/* Buy/Sell trade markers — RN views so they stay circular under
              the non-uniform SVG scale, same trick as the tip dot. */}
          {svgPxW > 0 && markerPts.map((m, i) => {
            const isBuy = m.side === 'BUY';
            const dotColor = isBuy ? p.greenFg : p.redFg;
            const SZ = 16;
            return (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (m.x / W) * svgPxW + CARD_INSET - SZ / 2,
                  top:  m.y + CARD_INSET - SZ / 2,
                  width: SZ, height: SZ, borderRadius: SZ / 2,
                  backgroundColor: dotColor,
                  borderWidth: 2, borderColor: p.bg,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: dotColor, shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 0 }, elevation: 3,
                }}
              >
                <Ionicons name={isBuy ? 'arrow-up' : 'arrow-down'} size={9} color="#FFFFFF" />
              </View>
            );
          })}
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

function CandleChart({ candles, palette: p, upColor, downColor, onHoverPrice, markers }: {
  candles: Candle[];
  palette: Palette;
  upColor: string;
  downColor: string;
  onHoverPrice?: (price: number | null) => void;
  markers?: TradeMarker[];
}) {
  const W = 320;
  const H = 220;
  const PAD = 0;
  const CARD_INSET = 0;
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [hoverPriceLabel, setHoverPriceLabel] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [svgPxW, setSvgPxW] = useState(0);

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

    // Project trade markers onto candle coords. X via timestamp across the
    // candle span; Y via the marker's execution price.
    const tFirst = candles[0]?.timestamp ?? 0;
    const tLast = candles[candles.length - 1]?.timestamp ?? 1;
    const tSpan = tLast - tFirst || 1;
    const markerPts = (markers ?? []).map((m) => ({
      x: PAD + ((m.ts - tFirst) / tSpan) * innerW,
      y: yOf(m.price),
      side: m.side,
    })).filter((mp) => mp.x >= 0 && mp.x <= W);

    return { bars, slot, bodyW, markerPts };
  }, [candles, markers]);

  const pxToVB = (px: number) => svgPxW <= 0 ? NaN : ((px - CARD_INSET) * W) / svgPxW;

  const handleHover = (px: number) => {
    if (px < 0 || !chart) {
      if (onHoverPrice) onHoverPrice(null);
      setHoverDate(null);
      setHoverPriceLabel(null);
      setHoveredIndex(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const vbX = pxToVB(px);
    if (!Number.isFinite(vbX) || vbX < PAD || vbX > W - PAD) {
      if (onHoverPrice) onHoverPrice(null);
      setHoverDate(null);
      setHoverPriceLabel(null);
      setHoveredIndex(null);
      hoverOpacity.value = withTiming(0, { duration: 150 });
      return;
    }
    const idx = Math.min(chart.bars.length - 1, Math.max(0, Math.floor((vbX - PAD) / chart.slot)));
    const bar = chart.bars[idx];
    setHoveredIndex(idx);
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

  if (!chart) {
    return (
      <View style={{ width: '100%', height: H, alignItems: 'center', justifyContent: 'center' }}>
        <LoadingPulse size={48} icon="stats-chart-outline" />
      </View>
    );
  }

  const { bars, bodyW, markerPts } = chart;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ position: 'relative' }}>
        <Animated.View style={{
          height: H, overflow: 'visible',
        }}>
          <Svg
            width="100%" height={H} viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - svgPxW) > 0.5) setSvgPxW(w);
            }}
          >
            {bars.map((b, i) => {
              const c = b.up ? upColor : downColor;
              const active = hoveredIndex === i;
              const glowX = b.cx - Math.max(bodyW * 1.65, 5) / 2;
              const glowW = Math.max(bodyW * 1.65, 5);
              const glowY = Math.max(0, b.wickTop - 10);
              const glowH = Math.min(H - glowY, b.wickBottom - b.wickTop + 20);
              return (
                <Fragment key={i}>
                  {active && (
                    <>
                      <Rect x={glowX} y={glowY} width={glowW} height={glowH} fill={c} opacity={0.18} rx={4} />
                      <Rect x={glowX - 2} y={glowY - 2} width={glowW + 4} height={glowH + 4} fill={c} opacity={0.08} rx={6} />
                    </>
                  )}
                  <SvgLine x1={b.cx} x2={b.cx} y1={b.wickTop} y2={b.wickBottom} stroke={c} strokeWidth={active ? 2.5 : 1} opacity={active ? 1 : 0.92} />
                  <Rect
                    x={b.cx - bodyW / 2}
                    y={b.bodyTop}
                    width={bodyW}
                    height={b.bodyH}
                    fill={c}
                    rx={0.5}
                    stroke={active ? c : undefined}
                    strokeWidth={active ? 1.2 : 0}
                  />
                </Fragment>
              );
            })}
          </Svg>
          {/* Buy/Sell trade markers — RN views to stay circular under scale. */}
          {svgPxW > 0 && markerPts.map((m, i) => {
            const isBuy = m.side === 'BUY';
            const dotColor = isBuy ? upColor : downColor;
            const SZ = 16;
            return (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (m.x / W) * svgPxW + CARD_INSET - SZ / 2,
                  top:  m.y + CARD_INSET - SZ / 2,
                  width: SZ, height: SZ, borderRadius: SZ / 2,
                  backgroundColor: dotColor,
                  borderWidth: 2, borderColor: p.bg,
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: dotColor, shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 0 }, elevation: 3,
                }}
              >
                <Ionicons name={isBuy ? 'arrow-up' : 'arrow-down'} size={9} color="#FFFFFF" />
              </View>
            );
          })}
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

function formatRelativeTime(ts: number | string | Date): string {
  const time = typeof ts === 'number' ? ts : new Date(ts).getTime();
  const mins = Math.max(1, Math.round((Date.now() - time) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatPrice(n: number): string {
  if (n === 0)     return '0.00';
  if (n >= 1000)   return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.01)   return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(10);
}

function fmtUsdCompact(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
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
