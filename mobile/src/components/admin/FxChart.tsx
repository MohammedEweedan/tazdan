/**
 * FX price chart for the admin surfaces. Renders a price line and (optionally)
 * volume bars along the bottom from a series of `{ t, price, volumeUsd? }`
 * points. Promoted out of app/admin/index.tsx so both the admin hub and the
 * revamped rates screen share one implementation.
 *
 *   <FxChart history={usdLydHistory} p={p} />            // line + volume (USD/LYD)
 *   <FxChart history={eurLydHistory} p={p} showVolume={false} />  // line only
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect, Line as SvgLine } from 'react-native-svg';

export type FxPoint = { t: number; price: number; volumeUsd?: number };

export function FxChart({
  history,
  p,
  showVolume = true,
  height = 120,
}: {
  history: FxPoint[];
  p: any;
  showVolume?: boolean;
  height?: number;
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

  return (
    <View style={{ marginTop: 12 }}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0.5].map((f) => {
          const y = lineTop + lineH * f;
          return <SvgLine key={f} x1={0} x2={W} y1={y} y2={y} stroke={p.border} strokeWidth={1} strokeDasharray="3,4" />;
        })}
        <Path d={linePath} stroke={color} strokeWidth={2} fill="none" />
        {showVolume && vols.map((v, i) => {
          const h = (v / maxVol) * VOL_H;
          return <Rect key={i} x={xOf(i) - barW / 2} y={H - PAD - h} width={barW} height={h} fill={p.fgMuted} opacity={0.5} />;
        })}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10 }}>lo {min.toFixed(4)}</Text>
        <Text style={{ color: p.fgFaint, fontSize: 10 }}>hi {max.toFixed(4)}</Text>
      </View>
    </View>
  );
}
