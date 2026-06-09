/**
 * FX price chart for the admin surfaces. Renders a price line and (optionally)
 * volume bars along the bottom from a series of `{ t, price, volumeUsd? }`
 * points. Promoted out of app/admin/index.tsx so both the admin hub and the
 * revamped rates screen share one implementation.
 *
 *   <FxChart history={usdLydHistory} p={p} />                         // sparkline + volume
 *   <FxChart history={usdLydHistory} p={p} mode="candles" />           // candlestick view
 *   <FxChart history={eurLydHistory} p={p} showVolume={false} />       // line only
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Line as SvgLine, G } from 'react-native-svg';

export type FxPoint = { t: number; price: number; volumeUsd?: number };
export type FxChartMode = 'sparkline' | 'candles';

export function FxChart({
  history,
  p,
  showVolume = true,
  height = 120,
  mode = 'sparkline',
}: {
  history: FxPoint[];
  p: any;
  showVolume?: boolean;
  height?: number;
  mode?: FxChartMode;
}) {
  const W = 320;
  const H = height;
  const PAD = 4;
  const VOL_H = showVolume ? 28 : 0;

  if (history.length < 2) {
    return (
      <View style={{ height: H, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
        <Ionicons name="pulse-outline" size={28} color={p.fgFaint} />
        <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 6 }}>Collecting price history…</Text>
      </View>
    );
  }

  const prices = history.map((h) => h.price);
  const vols = history.map((h) => h.volumeUsd ?? 0);
  const min = Math.min(...prices), max = Math.max(...prices);
  const spread = max - min || 1;
  const maxVol = Math.max(...vols, 1);
  const lineTop = PAD, lineBottom = H - VOL_H - PAD;
  const lineH = lineBottom - lineTop;
  const step = (W - PAD * 2) / (history.length - 1);
  const xOf = (i: number) => PAD + i * step;
  const yOf = (v: number) => lineTop + lineH * (1 - (v - min) / spread);
  const linePath = prices.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(' ');
  const up = prices[prices.length - 1] >= prices[0];
  const color = up ? p.greenFg : p.redFg;
  const barW = Math.max(1, step * 0.6);
  const bucketSize = Math.max(1, Math.ceil(history.length / 24));
  const candles = [];
  for (let i = 0; i < history.length; i += bucketSize) {
    const slice = history.slice(i, i + bucketSize);
    const open = slice[0].price;
    const close = slice[slice.length - 1].price;
    const high = Math.max(...slice.map((s) => s.price));
    const low = Math.min(...slice.map((s) => s.price));
    candles.push({ open, high, low, close });
  }
  const candleSlot = (W - PAD * 2) / Math.max(1, candles.length);
  const candleW = Math.max(2, candleSlot * 0.48);

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {mode === 'candles' ? (
          candles.map((c, i) => {
            const x = PAD + candleSlot * i + candleSlot / 2;
            const yHigh = yOf(c.high);
            const yLow = yOf(c.low);
            const yOpen = yOf(c.open);
            const yClose = yOf(c.close);
            const green = c.close >= c.open;
            const bodyTop = Math.min(yOpen, yClose);
            const bodyH = Math.max(2, Math.abs(yClose - yOpen));
            const candleColor = green ? p.greenFg : p.redFg;
            return (
              <G key={`${i}-${c.open}-${c.close}`}>
                <SvgLine x1={x} x2={x} y1={yHigh} y2={yLow} stroke={candleColor} strokeWidth={1.4} />
                <Rect
                  x={x - candleW / 2}
                  y={bodyTop}
                  width={candleW}
                  height={bodyH}
                  rx={1.5}
                  fill={candleColor}
                  opacity={0.9}
                />
              </G>
            );
          })
        ) : (
          <>
            <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
            {showVolume && vols.map((v, i) => {
              const h = (v / maxVol) * VOL_H;
              return <Rect key={i} x={xOf(i) - barW / 2} y={H - PAD - h} width={barW} height={h} fill={p.fgMuted} opacity={0.5} />;
            })}
          </>
        )}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10 }}>lo {min.toFixed(4)}</Text>
        <Text style={{ color: p.fgFaint, fontSize: 10 }}>hi {max.toFixed(4)}</Text>
      </View>
    </View>
  );
}
