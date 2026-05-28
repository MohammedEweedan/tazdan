/**
 * SVG sparkline. Smooth filled area + crisp top stroke. Used in market rows
 * and crypto wallet cards.
 */

import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  width = 80,
  height = 26,
  color = '#737373',
  strokeWidth = 1.5,
}: Props) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y] as const;
  });

  const stroke = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ');
  const fill = `${stroke} L${width},${height} L0,${height} Z`;
  const id = `sl-${Math.round(data[0] * 1000)}`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%"  stopColor={color} stopOpacity="0.35" />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={fill} fill={`url(#${id})`} />
      <Path d={stroke} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
