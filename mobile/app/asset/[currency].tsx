/**
 * Asset detail screen — opens when the user taps a held crypto on Home or
 * a coin from the Buy picker.
 *
 * Real-time data sources:
 *   - `useMarkets()`   — CoinGecko `/coins/markets` (price, % change per
 *                        range, market cap, volume, ATH, sparkline).
 *   - `useLivePrice()` — Binance WebSocket miniTicker for second-by-second
 *                        price updates that override the REST snapshot.
 *   - `useOHLC()`      — CoinGecko `/market_chart` for the selected range,
 *                        already down-sampled to ~60 points.
 *
 * Holdings USD value re-renders on every WebSocket tick because it's
 * derived from `livePrice * wallet.balance` inside the component.
 */

import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Line as SvgLine } from 'react-native-svg';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useWallets, useTransactions } from '@/hooks';
import { useMarkets, ID_TO_SYM, type CoinGeckoMarket } from '@/hooks/useMarkets';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useOHLC } from '@/hooks/useOHLC';
import type { Currency, Wallet } from '@/types';
import { CURRENCY_META } from '@/constants';
import { formatMoney } from '@/utils/format';
import { CurrencyBadge } from '@/components/ui/CurrencyBadge';

type Range = '1H' | '24H' | '7D' | '30D';

/** Set of fiat ISO codes the app supports. Derived from CURRENCY_META so
 *  adding LYD/SAR/etc. lights up automatically across this screen. */
const FIAT_CURRENCIES = new Set(
  Object.values(CURRENCY_META).filter((m) => m.kind === 'fiat').map((m) => m.code),
);

/** Reverse of `ID_TO_SYM` so we can look up a CoinGecko id by ticker. */
const SYM_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ID_TO_SYM).map(([id, sym]) => [sym, id]),
);

export default function AssetDetail() {
  const { currency } = useLocalSearchParams<{ currency: string }>();
  const sym = (currency ?? 'BTC').toUpperCase() as Currency;
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();

  const { data: markets, isLoading: marketsLoading } = useMarkets();
  const { data: wallets } = useWallets();
  const [range, setRange] = useState<Range>('24H');

  // CoinGecko market record for this currency (may be undefined for fiat).
  const market: CoinGeckoMarket | undefined = useMemo(
    () => markets?.find((m) => ID_TO_SYM[m.id] === sym),
    [markets, sym],
  );
  const coinId = SYM_TO_ID[sym];

  // Real-time price from Binance WS. USDT is a stablecoin and isn't
  // tradeable as USDT/USDT so the hook silently fails and we fall back
  // to the REST snapshot (~$1.00).
  const wsPrice = useLivePrice(sym);
  const price = wsPrice ?? market?.current_price ?? 0;
  const isLive = wsPrice !== null && sym !== 'USDT';

  // Pick the right pre-computed % change for the selected timeframe so
  // the pill stays consistent with the chart shape below it.
  const change = useMemo(() => {
    if (!market) return 0;
    switch (range) {
      case '1H':  return market.price_change_percentage_1h_in_currency  ?? 0;
      case '24H': return market.price_change_percentage_24h             ?? 0;
      case '7D':  return market.price_change_percentage_7d_in_currency  ?? 0;
      case '30D': return market.price_change_percentage_30d_in_currency ?? 0;
    }
  }, [market, range]);
  const positive = change >= 0;

  // Real OHLC for the chart. While loading we render a skeleton.
  // Pass `undefined` for fiat tickers — the hook short-circuits and we
  // render a "no chart" panel below instead of showing BTC's chart for
  // a USDT page.
  const { data: ohlc, isLoading: ohlcLoading } = useOHLC(coinId, range);
  const series = ohlc ?? [];
  const hasChart = !!coinId;

  // Holdings — value fluctuates on every price tick because we recompute
  // here instead of trusting the stale `wallet.fiatValueUsd` field.
  const wallet = wallets?.find((w) => w.currency === sym);
  const balance = wallet ? Number(wallet.balance) : 0;
  const holdingsUsd = balance * price;
  // Compute the holdings' P/L for the selected range using the same %
  // change so users see "your $1,200 of BTC moved +2.3% (+$28) in 24H".
  const holdingsDelta = (holdingsUsd * change) / (100 + change || 1);

  const isFiat = FIAT_CURRENCIES.has(sym);
  if (isFiat) {
    return (
      <ScreenShell title={CURRENCY_META[sym]?.name ?? sym} subtitle={`${sym} Currency`}>
        <FiatAssetView sym={sym} wallet={wallet} p={p} h={h} router={router} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={market?.name ?? sym} subtitle={`${sym} / USD`}>
      {/* Hero price */}
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{
            color: p.fg, fontSize: 40, fontWeight: '800',
            letterSpacing: -1.2, fontVariant: ['tabular-nums'],
          }}>
            ${formatPrice(price)}
          </Text>
          {/* Live badge — green dot when WebSocket is feeding ticks */}
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
              fontSize: 9, fontWeight: '800', letterSpacing: 0.5,
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

      {/* Chart — only crypto assets have a meaningful USD chart. */}
      {hasChart ? (
        <>
          <View style={{ marginTop: 22 }}>
            {ohlcLoading ? (
              <View style={{
                height: 160, borderRadius: 16,
                backgroundColor: p.bgElev,
                borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator color={p.fgMuted} />
              </View>
            ) : (
              <SparklineChart
                values={series}
                color={positive ? '#10b981' : '#ef4444'}
                palette={p}
              />
            )}
          </View>

          {/* Timeframe selector */}
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
        // Fiat assets (USD/EUR/GBP/AED/SAR/EGP/USDT) — no volatile USD chart.
        <View style={{
          marginTop: 22, paddingVertical: 32, paddingHorizontal: 20, borderRadius: 16,
          backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
          alignItems: 'center',
        }}>
          <Ionicons name="cash-outline" size={28} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '600', marginTop: 10, textAlign: 'center' }}>
            {sym === 'USDT'
              ? 'USDT is pegged 1:1 to the US dollar — no chart to show.'
              : `${sym} is a fiat currency — no crypto chart to show.`}
          </Text>
        </View>
      )}

      {/* Stat tiles */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <StatTile
          label="24H VOLUME"
          value={market ? fmtUsdCompact(market.total_volume) : '—'}
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

      {/* Holdings panel — recomputed every render → fluctuates with WS ticks */}
      <Panel style={{ marginTop: 18 }}>
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
              YOUR HOLDINGS
            </Text>
            {wallet && balance > 0 && (
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
                  fontSize: 10, fontWeight: '800',
                }}>
                  {positive ? '+' : ''}${Math.abs(holdingsDelta).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>

          {wallet && balance > 0 ? (
            <>
              <Text style={{
                color: p.fg, fontSize: 26, fontWeight: '800',
                fontVariant: ['tabular-nums'], marginTop: 8, letterSpacing: -0.4,
              }}>
                ${holdingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                {balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} {sym}
                {' · '}
                <Text style={{ color: positive ? p.greenFg : p.redFg }}>
                  {positive ? '+' : ''}{change.toFixed(2)}% over {range}
                </Text>
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
          <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '800' }}>Buy</Text>
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
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '800' }}>Sell</Text>
        </Pressable>
      </View>

      {marketsLoading && !market && (
        <Text style={{ color: p.fgMuted, fontSize: 12, textAlign: 'center', marginBottom: 12 }}>
          Loading market data…
        </Text>
      )}
    </ScreenShell>
  );
}

/* ── Sparkline (SVG path) ─── */
function SparklineChart({
  values, color, palette: p,
}: {
  values: number[];
  color: string;
  palette: Palette;
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
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
          No chart data
        </Text>
      </View>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (W - PAD * 2) / (values.length - 1);

  const pts = values.map((v, i) => {
    const x = PAD + i * step;
    const y = PAD + (H - PAD * 2) * (1 - (v - min) / range);
    return { x, y };
  });

  const last = pts[pts.length - 1];

  const linePath = pts
    .map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`))
    .join(' ');

  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H - PAD} L ${pts[0].x} ${H - PAD} Z`;

  // 4 horizontal grid lines.
  const grid = [0.25, 0.5, 0.75].map((f) => PAD + (H - PAD * 2) * f);

  return (
    <View style={{
      borderRadius: 16,
      backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border,
      padding: 8,
    }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {grid.map((y, i) => (
          <SvgLine
            key={i}
            x1={PAD} x2={W - PAD} y1={y} y2={y}
            stroke={p.border} strokeWidth={1} strokeDasharray="3,4"
          />
        ))}
        <Path d={areaPath} fill="url(#grad)" />
        <Path d={linePath} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={last.x} cy={last.y} r={8} fill={color} opacity={0.25} />
        <Circle cx={last.x} cy={last.y} r={4} fill={color} />
      </Svg>
    </View>
  );
}

function StatTile({
  label, value, icon, palette: p,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  palette: Palette;
}) {
  return (
    <View style={{
      flex: 1,
      borderRadius: 16,
      backgroundColor: p.bgElev,
      borderWidth: 1, borderColor: p.border,
      padding: 14,
      gap: 6,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={12} color={p.fgMuted} />
        <Text style={{ color: p.fgMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ color: p.fg, fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </Text>
    </View>
  );
}

/* ── Helpers ─── */

/** Smart price formatter — more decimals for cheap coins (DOGE, ADA, …). */
function formatPrice(n: number): string {
  if (n === 0)    return '0.00';
  if (n >= 1000)  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1)     return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (n >= 0.01)  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
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

/* ── Fiat asset detail — deposit / withdraw view (no chart) ─── */
function FiatAssetView({ sym, wallet, p, h, router }: {
  sym: Currency;
  wallet: Wallet | undefined;
  p: Palette;
  h: { selection: () => void; medium: () => void; light: () => void };
  router: { push: (href: any) => void };
}) {
  const { data: txData } = useTransactions(1);
  const txs = (txData?.items ?? [])
    .filter((t: any) => t.currency === sym)
    .slice(0, 8);

  const balance = wallet ? Number(wallet.balance) : 0;
  const usdValue = wallet ? Number(wallet.fiatValueUsd) : 0;
  const fxRate = balance > 0 ? usdValue / balance : 0;

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      {/* Balance card */}
      <View
        style={{
          borderRadius: 20, padding: 20, marginBottom: 20,
          backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{
              color: p.fgMuted, fontSize: 11, fontWeight: '700',
              letterSpacing: 1.0, textTransform: 'uppercase',
            }}
          >
            Available Balance
          </Text>
          <CurrencyBadge code={sym} size="sm" variant="chip" />
        </View>
        <Text
          style={{
            color: p.fg, fontSize: 38, fontWeight: '800',
            letterSpacing: -1.4, marginTop: 8, fontVariant: ['tabular-nums'],
          }}
        >
          {formatMoney(balance, sym as Currency, { showSymbol: true })}
        </Text>
        {sym !== 'USD' && fxRate > 0 && (
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 6 }}>
            ≈ {formatMoney(usdValue, 'USD', { showSymbol: true })}
            {' · '}1 {sym} = {formatMoney(fxRate, 'USD', { showSymbol: true, maxDecimals: 4 })}
          </Text>
        )}
      </View>

      {/* Action buttons — use palette-driven press states so dark and
          light modes both render correctly. The previous design used a
          hardcoded '#000' pressed background which was invisible on the
          new charcoal theme. */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
        <Pressable
          onPress={() => { h.medium(); router.push(`/topup?currency=${sym}` as any); }}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26,
            backgroundColor: p.ctaBg,
            opacity: pressed ? 0.85 : 1,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 6,
          })}
        >
          <Ionicons name="arrow-down-circle-outline" size={18} color={p.ctaFg} />
          <Text style={{ color: p.ctaFg, fontSize: 15, fontWeight: '800' }}>Deposit</Text>
        </Pressable>
        <Pressable
          onPress={() => { h.medium(); router.push(`/send?currency=${sym}` as any); }}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 6,
          })}
        >
          <Ionicons name="paper-plane-outline" size={16} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '800' }}>Withdraw</Text>
        </Pressable>
      </View>

      {/* Recent transactions */}
      <Text style={{
        color: p.fgFaint, fontSize: 11, fontWeight: '700',
        letterSpacing: 0.6, marginBottom: 12,
      }}>
        RECENT ACTIVITY
      </Text>
      {txs.length > 0 ? (
        txs.map((t: any) => {
          const amt = Number(t.amount);
          const positive = amt >= 0;
          return (
            <View key={t.id} style={{
              flexDirection: 'row', alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: p.border,
              gap: 12,
            }}>
              <View style={{
                width: 38, height: 38, borderRadius: 19,
                backgroundColor: p.pillBg, borderWidth: 1, borderColor: p.border,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Ionicons
                  name={positive ? 'arrow-down' : 'arrow-up'}
                  size={16}
                  color={positive ? p.greenFg : p.fg}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                  {t.description || t.type}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{
                color: positive ? p.greenFg : p.fg,
                fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'],
              }}>
                {positive ? '+' : ''}{Math.abs(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {sym}
              </Text>
            </View>
          );
        })
      ) : (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <Ionicons name="receipt-outline" size={24} color={p.fgFaint} />
          <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 10 }}>
            No transactions yet
          </Text>
        </View>
      )}
    </View>
  );
}
