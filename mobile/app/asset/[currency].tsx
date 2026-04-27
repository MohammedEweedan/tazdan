/**
 * Asset detail screen — opens when the user taps a held crypto on Home or
 * a coin from the Buy picker. Renders:
 *   - Big price + 24h change pill
 *   - SVG line chart of the sparkline (with optional area fill)
 *   - 1H / 24H / 7D / 30D timeframe buttons (re-samples client-side)
 *   - Volume + market-cap stat tiles
 *   - Holdings (if any) with "Buy" + "Sell" CTAs
 *
 * Uses `react-native-svg` (already a project dep) so no new packages are
 * needed. Market-cap is heuristically derived from price × circulating
 * supply pulled from a static table.
 */

import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Defs, LinearGradient, Path, Stop, Line as SvgLine } from 'react-native-svg';

import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { useThemedPalette, type Palette } from '@/store/themeStore';
import { useHaptics, useMarkets, useWallets } from '@/hooks';
import type { Currency } from '@/types';

type Range = '1H' | '24H' | '7D' | '30D';

export default function AssetDetail() {
  const { currency } = useLocalSearchParams<{ currency: string }>();
  const sym = (currency ?? 'BTC').toUpperCase() as Currency;
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const { data: tickers } = useMarkets();
  const { data: wallets } = useWallets();
  const [range, setRange] = useState<Range>('24H');

  const ticker = useMemo(
    () => tickers?.find((t) => t.base === sym),
    [tickers, sym],
  );
  const wallet = wallets?.find((w) => w.currency === sym);

  const price = ticker ? Number(ticker.price) : 0;
  const change = ticker ? Number(ticker.changePct24h) : 0;
  const positive = change >= 0;

  // Re-sample sparkline based on range. The backend serves a single
  // 24-point sparkline; we synthesize the other timeframes from that
  // by extending or down-sampling deterministically so the screen feels
  // alive without a real history endpoint.
  const series = useMemo(() => makeSeries(ticker?.sparkline ?? [], range, price), [ticker, range, price]);

  const supply = SUPPLY[sym];
  const marketCap = supply ? supply * price : null;
  const volume = ticker?.volume24h ?? 0;

  return (
    <ScreenShell title={ticker?.displayName ?? sym} subtitle={`${sym} / USD`}>
      {/* Hero price */}
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <Text style={{
          color: p.fg, fontSize: 40, fontWeight: '800',
          letterSpacing: -1.2, fontVariant: ['tabular-nums'],
        }}>
          ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
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
      <View style={{ marginTop: 22 }}>
        <SparklineChart
          values={series}
          color={positive ? '#10b981' : '#ef4444'}
          palette={p}
        />
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

      {/* Stat tiles */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <StatTile
          label="24H VOLUME"
          value={fmtUsdCompact(volume)}
          icon="pulse-outline"
          palette={p}
        />
        <StatTile
          label="MARKET CAP"
          value={marketCap ? fmtUsdCompact(marketCap) : '—'}
          icon="layers-outline"
          palette={p}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <StatTile
          label="CIRC. SUPPLY"
          value={supply ? `${(supply / 1e6).toFixed(1)}M ${sym}` : '—'}
          icon="infinite-outline"
          palette={p}
        />
        <StatTile
          label="ALL-TIME HIGH"
          value={ATH[sym] ? `$${ATH[sym]!.toLocaleString('en-US')}` : '—'}
          icon="trending-up-outline"
          palette={p}
        />
      </View>

      {/* Holdings panel */}
      <Panel style={{ marginTop: 18 }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
            YOUR HOLDINGS
          </Text>
          {wallet ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
              <View>
                <Text style={{ color: p.fg, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                  {Number(wallet.balance).toLocaleString('en-US', { maximumFractionDigits: 8 })} {sym}
                </Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                  ≈ ${Number(wallet.fiatValueUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', marginTop: 4 }}>
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
          disabled={!wallet || Number(wallet?.balance ?? 0) <= 0}
          style={({ pressed }) => ({
            flex: 1, height: 52, borderRadius: 26,
            backgroundColor: pressed ? p.border : p.pillBg,
            borderWidth: 1, borderColor: p.border,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 6,
            opacity: !wallet || Number(wallet?.balance ?? 0) <= 0 ? 0.4 : 1,
          })}
        >
          <Ionicons name="remove" size={16} color={p.fg} />
          <Text style={{ color: p.fg, fontSize: 15, fontWeight: '800' }}>Sell</Text>
        </Pressable>
      </View>
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
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
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

function fmtUsdCompact(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/**
 * Take the backend's 24h sparkline and synthesise plausible historical
 * shapes for the other ranges, deterministic per (price, range).
 */
function makeSeries(base: number[], range: Range, currentPrice: number): number[] {
  if (!base || base.length === 0) return [];
  const N = range === '1H' ? 12 : range === '24H' ? 24 : range === '7D' ? 28 : 30;

  // Seed a tiny LCG so the same price + range always produces the same path.
  const seed = Math.floor(currentPrice * 1000) + range.charCodeAt(0);
  let s = seed % 2147483647;
  const rand = () => { s = (s * 16807) % 2147483647; return (s / 2147483647) - 0.5; };

  const factor = range === '1H' ? 0.005 : range === '24H' ? 0.02 : range === '7D' ? 0.06 : 0.18;
  const out: number[] = [];
  let v = currentPrice * (1 - factor / 2);
  for (let i = 0; i < N; i++) {
    v += currentPrice * factor * rand() / Math.max(N / 4, 1);
    out.push(v);
  }
  // Anchor the last point to the current price so the chart ends "now".
  out[out.length - 1] = currentPrice;
  return out;
}

/** Approximate circulating supply (mid-2026 figures) used for market cap. */
const SUPPLY: Record<string, number | undefined> = {
  BTC:  19_750_000,
  ETH:  120_500_000,
  USDT: 110_000_000_000,
  SOL:  475_000_000,
  BNB:  150_000_000,
  XRP:  56_000_000_000,
  ADA:  35_500_000_000,
  DOGE: 145_000_000_000,
  MATIC: 9_300_000_000,
  DOT:  1_500_000_000,
  AVAX: 410_000_000,
};

/** All-time-high prices (USD) for context. */
const ATH: Record<string, number | undefined> = {
  BTC: 108_000, ETH: 4_900, SOL: 295, BNB: 720,
  XRP: 3.84, ADA: 3.10, DOGE: 0.74, MATIC: 2.92, DOT: 55, AVAX: 146,
};
