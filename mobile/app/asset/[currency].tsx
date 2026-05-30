/**
 * Asset detail screen — works for every tradeable token, not just the
 * hardcoded CoinGecko list. Falls back to Binance REST for price + chart
 * when the coin isn't in the backend ticker feed.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line as SvgLine } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { BuyWidget } from '@/components/exchange/BuyWidget';
import { SellWidget } from '@/components/exchange/SellWidget';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS, withTiming, withRepeat, withSequence, Easing } from 'react-native-reanimated';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets, useTransactions } from '@/hooks';
import { api } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarkets, ID_TO_SYM, type CoinGeckoMarket } from '@/hooks/useMarkets';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useOHLC } from '@/hooks/useOHLC';
import { cryptoExchangeAPI, cryptoWalletAPI } from '@/lib/cryptoApi';
import type { Currency, Wallet } from '@/types';
import { CURRENCY_META } from '@/constants';
import { formatMoney } from '@/utils/format';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';
import { AssetTxRow, txBelongsToAsset } from '@/components/transactions/AssetTxRow';

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
      return {
        prices: data.map((k) => parseFloat(k[4])),
        timestamps: data.map((k) => k[0]), // open time ms
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
  const [buyOpen, setBuyOpen] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const insets = useSafeAreaInsets();

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

  const chartLoading = cgLoading || binanceChartLoading;
  const hasChart = !isFiat && (sym !== 'USDT' && sym !== 'USDT_ERC20' && sym !== 'USDT_TRC20');

  // Holdings
  const wallet = wallets?.find((w) => w.currency === sym);
  const balance = wallet ? Number(wallet.balance) : 0;
  const holdingsUsd = balance * price;
  const holdingsDelta = change !== 0 ? (holdingsUsd * change) / (100 + Math.abs(change)) : 0;

  const displayName = market?.name ?? friendlyName(sym);

  const stickyBar = (
    <View style={{
      flexDirection: 'row', gap: 10,
      paddingTop: 10, paddingBottom: Math.max(insets.bottom, 10) + 6,
      paddingHorizontal: 20,
      backgroundColor: p.bg,
      borderTopWidth: 1, borderTopColor: p.border,
    }}>
      <Pressable
        onPress={() => { h.medium(); setBuyOpen(true); }}
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
        onPress={() => { h.medium(); setSellOpen(true); }}
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
  );

  const buyModal = (
    <Modal visible={buyOpen} transparent animationType="slide" onRequestClose={() => setBuyOpen(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }} onPress={() => setBuyOpen(false)}>
          <Pressable style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Lock the asset to whichever coin the user is viewing.
                  Switching from BTC → ETH inside the Buy sheet would
                  contradict their navigation intent. */}
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
              {/* Same lock as Buy — selling ETH from the BTC screen is
                  a UX trap, not a feature. */}
              <SellWidget defaultAsset={sym} lockAsset={!isFiat} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (isFiat) {
    return (
      <ScreenShell title={CURRENCY_META[sym as Currency]?.name ?? sym} subtitle={`${sym} Currency`} scroll={false}>
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <FiatAssetView sym={sym as Currency} wallet={wallet} p={p} h={h} />
          </ScrollView>
          {stickyBar}
        </View>
        {buyModal}
        {sellModal}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={displayName} subtitle={`${sym} / USD`} scroll={false}>
      <View style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Hero price */}
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            <CoinIcon symbol={sym} size={56} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
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
                    points={chartPoints}
                    color={positive ? '#10b981' : '#ef4444'}
                    palette={p}
                    onHoverPrice={setHoverPrice}
                    livePrice={isLive ? wsPrice : null}
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
          <Panel style={{ marginTop: 18, marginBottom: 16 }}>
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

          {/* Recent transactions, filtered to this asset only */}
          <AssetTransactions sym={sym} p={p} />

          {/* Deposit QR for crypto */}
          <CryptoDepositSection sym={sym} wallet={wallet} p={p} h={h} />

          {/* News */}
          <NewsSection p={p} sym={sym} />
        </ScrollView>
        {stickyBar}
      </View>
      {buyModal}
      {sellModal}
    </ScreenShell>
  );
}


/* ── Deposit QR for crypto ─── */
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
    <Panel style={{ marginBottom: 24 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
          DEPOSIT {sym}
        </Text>
        {loading ? (
          <LoadingPulse size={36} icon="qr-code-outline" />
        ) : addr ? (
          <>
            {qrUrl && (
              <View style={{ alignItems: 'center', marginBottom: 14 }}>
                <Image source={{ uri: qrUrl }} style={{ width: 180, height: 180, borderRadius: 12 }} resizeMode="contain" />
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
                backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={18} color={copied ? p.greenFg : p.fgMuted} />
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>{addr}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center' }}>Unable to load deposit address</Text>
        )}
      </View>
    </Panel>
  );
}

/* ── Per-asset recent transactions ─────────────────────────────────
   STRICT filter: a row is shown here only when `tx.currency` (or the
   `asset` mirror) matches the page symbol — never description-based.
   The previous loose match was the source of the
   "500,000 USD spent → shown as 500,000 BTC" bug: a buy creates TWO
   ledger rows (one in spent currency, one in received), and the
   description on either side mentions both. Filtering by structured
   `currency` is the only way to keep them separated.

   Display is delegated to <AssetTxRow/>, which renders the amount
   using `tx.currency` directly so the unit is always correct
   regardless of which page is showing it.
   ─────────────────────────────────────────────────────────────────── */

function AssetTransactions({ sym, p }: { sym: string; p: Palette }) {
  const router = useRouter();
  const { data: txData, isLoading } = useTransactions(1);

  const txs = useMemo(() => {
    const all = (txData?.items ?? []) as any[];
    return all.filter((t) => txBelongsToAsset(t, sym)).slice(0, 6);
  }, [txData, sym]);

  // Don't render an empty panel — looks like a layout bug on a fresh
  // account. Loading state stays so the user sees something is
  // happening while we hydrate.
  if (!isLoading && txs.length === 0) return null;

  return (
    <Panel style={{ marginBottom: 16 }}>
      <View style={{ padding: 16, paddingBottom: 4 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
            YOUR {sym} ACTIVITY
          </Text>
          <Pressable
            onPress={() => router.push('/history')}
            hitSlop={6}
            style={({ pressed }) => ({
              opacity: pressed ? 0.65 : 1,
              flexDirection: 'row', alignItems: 'center', gap: 2,
            })}
          >
            <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 }}>
              VIEW ALL
            </Text>
            <Ionicons name="chevron-forward" size={11} color={p.fgMuted} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingVertical: 18, alignItems: 'center' }}>
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
    </Panel>
  );
}

/* ── News feed via CryptoCompare (free tier, no key) ─── */
interface NewsItem {
  title: string;
  source: string;
  url: string;
  published: number;
  imageUrl?: string;
  body?: string;
  categories?: string;
}

const SYM_KEYWORDS: Record<string, string[]> = {
  BTC: ['BTC', 'BITCOIN'],
  ETH: ['ETH', 'ETHEREUM'],
  SOL: ['SOL', 'SOLANA'],
  BNB: ['BNB'],
  XRP: ['XRP', 'RIPPLE'],
  ADA: ['ADA', 'CARDANO'],
  DOGE: ['DOGE', 'DOGECOIN'],
  MATIC: ['MATIC', 'POLYGON'],
  DOT: ['DOT', 'POLKADOT'],
  AVAX: ['AVAX', 'AVALANCHE'],
  USDT: ['USDT', 'TETHER'],
  USDC: ['USDC'],
  LTC: ['LTC', 'LITECOIN'],
  LINK: ['LINK', 'CHAINLINK'],
};

function matchesSym(item: NewsItem, sym: string): boolean {
  const keywords = SYM_KEYWORDS[sym] ?? [sym];
  const hay = (
    (item.title ?? '') + ' ' +
    (item.source ?? '') + ' ' +
    (item.body ?? '') + ' ' +
    (item.categories ?? '')
  ).toUpperCase();
  return keywords.some((k) => hay.includes(k));
}

// Symbols CryptoCompare's `categories` filter accepts. Anything outside
// this list still gets news via the keyword fallback below.
const CC_CATEGORIES = new Set([
  'BTC', 'ETH', 'XRP', 'LTC', 'BCH', 'ETC', 'ADA', 'DOGE', 'DOT', 'LINK',
  'SOL', 'AVAX', 'MATIC', 'TRX', 'BNB', 'USDT', 'USDC', 'XLM', 'XMR',
  'ATOM', 'NEAR', 'FIL', 'ALGO', 'VET', 'AAVE', 'ARB', 'OP', 'SUI', 'SHIB',
]);

function NewsSection({ p, sym }: { p: Palette; sym: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  // When we couldn't find asset-specific news and fell back to a
  // top-crypto feed, we soften the heading so we don't promise
  // something we didn't deliver.
  const [isFallback, setIsFallback] = useState(false);
  // Distinguish "fetch failed" from "fetch succeeded but empty" so the
  // empty state can offer a retry instead of misleading the user with
  // "no news found" when the request never landed.
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isFiat = FIAT_CODES.has(sym);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setIsFallback(false);
    setFetchFailed(false);
    setNews([]);

    if (isFiat) {
      setLoading(false);
      return;
    }

    // Hit the server proxy instead of a public CDN.  Previously the
    // client fetched CryptoCompare directly, which failed silently on
    // any user network where that CDN was throttled / blocked — the
    // user just saw "No news found for BTC" on every coin.  The
    // proxy uses one outbound IP (the server), caches for 60s, and
    // returns 503 on upstream failure so we can distinguish "no
    // news" from "couldn't reach".
    async function load() {
      try {
        const { data } = await api.get('/news', { params: { sym } });
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? (data.items as NewsItem[]) : [];
        setNews(items);
        setIsFallback(!!data?.fallback);
      } catch (e: any) {
        if (cancelled) return;
        // 503 from the proxy means every upstream failed.  Anything
        // else (timeout, network) ends up here too — both should
        // surface the retry state, not a misleading "no news" state.
        setFetchFailed(true);
        setNews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // reloadKey is intentional — bumping it re-runs the effect from
    // the retry button without re-mounting the whole panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sym, isFiat, reloadKey]);

  return (
    <Panel style={{ marginBottom: 24 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
          {isFallback ? 'TOP CRYPTO NEWS' : `${sym} NEWS`}
        </Text>
        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Ionicons name="newspaper-outline" size={28} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10 }}>Loading news…</Text>
          </View>
        ) : news.length > 0 ? (
          news.map((item, i) => (
            <Pressable
              key={i}
              onPress={() => item.url && Linking.openURL(item.url)}
              style={({ pressed }) => ({
                paddingVertical: 10,
                borderBottomWidth: i === news.length - 1 ? 0 : 1,
                borderBottomColor: p.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
              <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4 }}>
                {item.source} · {new Date(item.published * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </Text>
            </Pressable>
          ))
        ) : isFiat ? (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Ionicons name="cash-outline" size={28} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10, textAlign: 'center' }}>
              Market news is not available for fiat currencies.
            </Text>
          </View>
        ) : fetchFailed ? (
          // Distinct state: the request didn't land at all.  Offer a
          // retry instead of showing "no news found" (which led the
          // user to think their coin was newsless when in fact the
          // CDN was blocked).
          <View style={{ paddingVertical: 22, alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={28} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10, textAlign: 'center' }}>
              Couldn't reach the news feed.
            </Text>
            <Pressable
              onPress={() => setReloadKey((n) => n + 1)}
              style={({ pressed }) => ({
                marginTop: 12,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                backgroundColor: pressed ? p.border : p.pillBg,
                borderWidth: 1, borderColor: p.border,
                flexDirection: 'row', alignItems: 'center', gap: 6,
              })}
            >
              <Ionicons name="refresh" size={13} color={p.fg} />
              <Text style={{ color: p.fg, fontSize: 12, fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Ionicons name="newspaper-outline" size={28} color={p.fgFaint} />
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10, textAlign: 'center' }}>
              No recent {sym} news.
            </Text>
          </View>
        )}
      </View>
    </Panel>
  );
}

/* ── Sparkline chart ───────────────────────────────────────────
   Pro-grade upgrades over the v1 polyline:
     · Monotone-cubic interpolation (smooth, no overshoot).
     · Live-edge breathing dot when a WebSocket price is provided —
       the last historical point is replaced by the WS tick so the
       line literally moves with the market.
     · Crosshair price tag at the top of the chart on drag.
     · Pulsing halo around the live tip while connected.
     · Direction-aware glow color (green up / red down) but everything
       else stays mono so the chart fits the new design language.
   ─────────────────────────────────────────────────────────────── */

/** Monotone-cubic interpolation — Fritsch–Carlson. No overshoot, exact
 *  through every sample. Returns an SVG path string. */
function monotoneCubicPath(
  pts: { x: number; y: number }[],
): string {
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  // Slopes between successive points
  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const m:  number[] = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    dy[i] = pts[i + 1].y - pts[i].y;
    m[i]  = dx[i] === 0 ? 0 : dy[i] / dx[i];
  }

  // Tangents
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

  // Build path
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i];
    const c1x = pts[i].x     + h / 3;
    const c1y = pts[i].y     + (tangents[i]     * h) / 3;
    const c2x = pts[i + 1].x - h / 3;
    const c2y = pts[i + 1].y - (tangents[i + 1] * h) / 3;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${pts[i + 1].x} ${pts[i + 1].y}`;
  }
  return d;
}

function SparklineChart({ points, color, palette: p, onHoverPrice, livePrice }: {
  points: import('@/hooks/useOHLC').ChartPoint[];
  color: string;
  palette: Palette;
  onHoverPrice?: (price: number | null) => void;
  /** Optional WebSocket price. When provided, the chart's last point
   *  is REPLACED by this value so the line moves with the market in
   *  real time. Pass `null` to indicate the WS feed isn't connected. */
  livePrice?: number | null;
}) {
  const W = 320;
  const H = 160;
  const PAD = 6;
  // Card chrome — `padding: 8` + `borderWidth: 1` on each side of the
  // Animated.View. The SVG sits inside that, so screen-pixel x=0 of the
  // gesture (outer wrapper) is screen-pixel x=9 of the SVG content.
  const CARD_INSET = 9;
  const [hoverDate,  setHoverDate]  = useState<string | null>(null);
  const [hoverPriceLabel, setHoverPriceLabel] = useState<string | null>(null);
  // Rendered SVG width in screen pixels — captured on first layout, used
  // to convert both directions between gesture-pixel space and viewBox
  // space (the chart geometry lives in viewBox space at 0..W). Without
  // this, `e.x` from `Gesture.Pan` ended up off by a scale factor of
  // (containerPx / W) and offset by the card's padding+border, which is
  // what you see as the crosshair "sliding ahead" of your finger.
  const [svgPxW, setSvgPxW] = useState(0);

  // Stitch live price onto the end of the historical series.
  const series = useMemo(() => {
    if (!livePrice || !Number.isFinite(livePrice) || points.length === 0) return points;
    const last = points[points.length - 1];
    // Within 2% — overwrite the trailing candle so we don't add a spike.
    // Beyond — append a new sample so the line "moves forward" visibly.
    const delta = Math.abs(last.price - livePrice) / (last.price || 1);
    const next = { price: livePrice, timestamp: Date.now() };
    if (delta < 0.02) {
      return [...points.slice(0, -1), next];
    }
    return [...points, next];
  }, [points, livePrice]);

  const values = series.map((pt) => pt.price);

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
    val: v,
    ts: series[i]?.timestamp ?? 0,
  }));

  const last = pts[pts.length - 1];
  const linePath = monotoneCubicPath(pts);
  const areaPath = `${linePath} L ${last.x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;
  const grid = [0.25, 0.5, 0.75].map((f) => PAD + (H - PAD * 2) * f);

  const isLive = livePrice != null && Number.isFinite(livePrice);

  // ── Interaction ──
  const hoverX = useSharedValue(-1);
  const hoverY = useSharedValue(-1);
  const hoverOpacity = useSharedValue(0);

  // Convert a screen-pixel x (in the gesture-detector view's coords) into
  // viewBox-space x. The SVG sits CARD_INSET pixels in from the gesture
  // view's left edge and renders at `svgPxW` pixels wide, mapping to the
  // viewBox's 0..W range. Returns NaN until layout has happened.
  const pxToVB = (px: number) => {
    if (svgPxW <= 0) return NaN;
    return ((px - CARD_INSET) * W) / svgPxW;
  };

  const handleHover = (px: number) => {
    // Sentinel: the gesture passes -1 on release to hide the cursor.
    if (px < 0) {
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
    const idx = Math.min(pts.length - 1, Math.max(0, Math.round((vbX - PAD) / step)));
    const pt = pts[idx];
    // hoverX is stored in VIEWBOX space; the overlay styles below
    // convert back to pixels using `svgPxW / W` + CARD_INSET so the
    // cursor lands exactly on the SVG line under the user's finger.
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

  // viewBox → pixel scale, captured for the overlay translateX
  // worklets. When the chart hasn't laid out yet, fall back to 1:1 so
  // we don't NaN any transforms.
  const vbToPxScale = svgPxW > 0 ? svgPxW / W : 1;

  // ── Pulsing live-edge halo ──
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (isLive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900,  easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 900,  easing: Easing.inOut(Easing.quad) }),
        ),
        -1, false,
      );
    } else {
      pulse.value = withTiming(0, { duration: 200 });
    }
  }, [isLive, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 1.6 }],
  }));

  // Overlays sit on the OUTER gesture-detector view (the same coord
  // space as `e.x`), so their translateX must be in screen pixels.
  // hoverX/hoverY are stored in viewBox units, so we apply the scale
  // factor + the card's left inset to land exactly on the SVG line.
  const cursorStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [
      { translateX: hoverX.value * vbToPxScale + CARD_INSET },
      { translateY: hoverY.value + CARD_INSET },
    ],
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
    transform: [{ translateX: hoverX.value * vbToPxScale + CARD_INSET }],
    position: 'absolute',
    left: 0,
    top: PAD + CARD_INSET,
    width: 1,
    height: H - PAD * 2,
    backgroundColor: p.border,
  }));

  // Price-tag pill at the top of the crosshair. 28px = half the
  // pill's min-width so it stays centered on the cursor.
  const tagStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
    transform: [{ translateX: hoverX.value * vbToPxScale + CARD_INSET - 28 }],
    position: 'absolute',
    top: -2,
    left: 0,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: p.fg,
    alignItems: 'center',
    justifyContent: 'center',
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={{ position: 'relative' }}>
        <Animated.View style={{
          borderRadius: 16, backgroundColor: p.bgElev,
          borderWidth: 1, borderColor: p.border, padding: 8,
          overflow: 'hidden'
        }}>
          <Svg
            width="100%"
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            // Capture the rendered pixel width so the gesture handler
            // and overlay translateX worklets can convert between
            // viewBox space and screen-pixel space. Without this, the
            // crosshair drifts off the line by the (containerPx / W)
            // scale factor under the user's finger.
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - svgPxW) > 0.5) setSvgPxW(w);
            }}
          >
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
            {/* Soft halo behind the live edge */}
            <Circle cx={last.x} cy={last.y} r={8} fill={color} opacity={isLive ? 0.25 : 0.18} />
            <Circle cx={last.x} cy={last.y} r={isLive ? 4.5 : 4} fill={color} />
          </Svg>

          {/* Pulsing halo (rendered outside SVG so we can drive it with
              Reanimated's UI-thread values without re-rasterising the
              SVG every frame). Positioned in screen pixels — the old
              `% of parent` approach drifted off the line whenever the
              SVG's content width differed from the card's width. */}
          {isLive && svgPxW > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left:       (last.x / W) * svgPxW - 10,
                  top:         last.y                 - 10,
                  width: 20, height: 20, borderRadius: 10,
                  backgroundColor: color,
                },
                haloStyle,
              ]}
            />
          )}

          <Animated.View style={lineStyle} />
          <Animated.View style={cursorStyle} />

          {/* Top crosshair price tag */}
          {hoverPriceLabel && (
            <Animated.View style={tagStyle} pointerEvents="none">
              <Text style={{
                color: p.bg, fontSize: 10, fontWeight: '700',
                fontVariant: ['tabular-nums'],
              }}>
                {hoverPriceLabel}
              </Text>
            </Animated.View>
          )}

          {/* LIVE state is already shown next to the headline price at
              the top of the screen — surfacing it again in the chart
              corner was a duplicate. The pulsing live edge dot on the
              line already conveys "this is moving in real time". */}
        </Animated.View>
        {hoverDate && (
          <Text style={{
            position: 'absolute',
            bottom: -12, left: 0, right: 0,
            textAlign: 'center', color: p.fgFaint,
            fontSize: 11, fontWeight: '500',
          }}>{hoverDate}</Text>
        )}
      </View>
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
function FiatAssetView({ sym, wallet, p, h }: {
  sym: Currency;
  wallet: Wallet | undefined;
  p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
}) {
  const { data: txData } = useTransactions(1);
  const txs = (txData?.items ?? []).filter((t: any) => t.currency === sym).slice(0, 8);
  const balance = wallet ? Number(wallet.balance) : 0;
  const usdValue = wallet ? Number(wallet.fiatValueUsd) : 0;
  const fxRate = balance > 0 ? usdValue / balance : 0;

  const meta = CURRENCY_META[sym as Currency];
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 12 }}>
        <Text style={{ fontSize: 56, lineHeight: 64, color: p.fg }}>{meta?.flagOrIcon ?? sym.slice(0, 2)}</Text>
        <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 4 }}>{meta?.name ?? sym}</Text>
      </View>
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

      <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12, marginTop: 8 }}>
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

      {/* Bank Details */}
      <Panel style={{ marginTop: 8, marginBottom: 24 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 12 }}>
            BANK DETAILS
          </Text>
          <BankDetailRow label="Account Name" value="Tazdan Ltd" p={p} />
          <BankDetailRow label="Bank Name" value="Emirates NBD" p={p} />
          <BankDetailRow label="IBAN" value="AE00 0000 0000 0000 0000 000" p={p} />
          <BankDetailRow label="SWIFT" value="EBILAEAD" p={p} />
          <BankDetailRow label="Reference" value={sym} p={p} last />
        </View>
      </Panel>

      <NewsSection p={p} sym={sym} />
    </View>
  );
}

function BankDetailRow({ label, value, p, last }: {
  label: string; value: string; p: Palette; last?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Pressable
      onPress={() => {
        Clipboard.setStringAsync(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: p.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{value}</Text>
        <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={14} color={copied ? p.greenFg : p.fgFaint} />
      </View>
    </Pressable>
  );
}
