'use client';

/**
 * Cockpit charts — plain SVG so the marks follow the data-viz spec exactly:
 * 2px lines, recessive grid, one y-axis, crosshair + tooltip on hover, a
 * legend whenever there are two or more series, and a table view for
 * screen readers and exact values. Colour is validated (see palette check in
 * docs/CONTROL_COCKPIT.md); text always uses text tokens, never series colour.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, HStack, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { useCockpitColors } from './ui';

export interface LineSeries { key: string; label: string; color: string; dashed?: boolean }

export function LineChart({ data, xKey, series, height = 220, format = (n) => String(n), area = false, band, markerIndex, markerLabel, zeroBased = true }: {
  data: Array<Record<string, any>>; xKey: string; series: LineSeries[]; height?: number; format?: (n: number) => string; area?: boolean;
  /** Shaded interval (e.g. a forecast's 80% range) drawn under the lines. */
  band?: { lowKey: string; highKey: string; color: string; label: string };
  /** Vertical rule at this index (e.g. "today" between history and forecast). */
  markerIndex?: number; markerLabel?: string;
  /** Counts and volumes start at zero; prices (FX rates) zoom to their range. */
  zeroBased?: boolean;
}) {
  const c = useCockpitColors();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  // Size the drawing to the container so axis text stays at its real size.
  const [width, setWidth] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [table]);
  const pad = { top: 12, right: 12, bottom: 24, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const [min, max] = useMemo(() => {
    const keys = [...series.map((s) => s.key), ...(band ? [band.lowKey, band.highKey] : [])];
    const vals = data.flatMap((d) => keys.map((k) => d[k])).filter((v) => v !== null && v !== undefined).map(Number).filter(Number.isFinite);
    const hi = Math.max(0, ...vals);
    if (zeroBased || !vals.length) {
      // Small whole-number series (counts) get whole-number ticks 0–4.
      if (hi <= 4 && vals.every(Number.isInteger)) return [0, 4];
      if (hi <= 0) return [0, 1];
      const mag = 10 ** Math.floor(Math.log10(hi));
      return [0, Math.ceil(hi / mag) * mag];
    }
    const lo = Math.min(...vals);
    const span = hi - lo || Math.abs(hi) * 0.01 || 1;
    return [lo - span * 0.15, hi + span * 0.15];
  }, [data, series, band, zeroBased]);

  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / (max - min)) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  // ~6px per character at 10px; the last label is end-anchored, so a regular
  // tick needs about 1.5 label widths of clearance before it.
  const tickLabelW = Math.max(30, ...data.slice(0, 50).map((d) => String(d[xKey]).slice(5).length * 6));
  const xTickEvery = Math.max(1, Math.ceil(data.length / Math.max(3, Math.floor(innerW / Math.max(90, tickLabelW + 24)))));

  // Points with no value for a key (null/undefined) are skipped, so a series
  // can cover only part of the x range (history vs forecast).
  const path = (key: string) => {
    let out = ''; let pen = false;
    data.forEach((d, i) => {
      if (d[key] === null || d[key] === undefined) { pen = false; return; }
      out += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(Number(d[key])).toFixed(1)} `;
      pen = true;
    });
    return out.trim();
  };
  const bandPath = () => {
    if (!band) return '';
    const idx = data.map((d, i) => (d[band.lowKey] !== null && d[band.lowKey] !== undefined ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) return '';
    const top = idx.map((i, n) => `${n ? 'L' : 'M'}${x(i).toFixed(1)},${y(Math.max(min, Number(data[i][band.highKey]))).toFixed(1)}`).join(' ');
    const bottom = [...idx].reverse().map((i) => `L${x(i).toFixed(1)},${y(Math.max(min, Number(data[i][band.lowKey]))).toFixed(1)}`).join(' ');
    return `${top} ${bottom} Z`;
  };
  const has = (d: Record<string, any>, k: string) => d[k] !== null && d[k] !== undefined;

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !data.length) return;
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - pad.left) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  if (!data.length) return <Text fontSize="sm" color={c.muted} p={4}>No data in this period.</Text>;

  return (
    <Box>
      <HStack justify="space-between" mb={2} minH="20px">
        {series.length >= 2 || band ? (
          <HStack spacing={4} flexWrap="wrap">
            {series.map((s) => (
              <HStack key={s.key} spacing={1.5}>
                <Box as="svg" w="16px" h="8px"><line x1="0" y1="4" x2="16" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} /></Box>
                <Text fontSize="xs" color={c.muted}>{s.label}</Text>
              </HStack>
            ))}
            {band ? (
              <HStack spacing={1.5}>
                <Box w="16px" h="8px" bg={band.color} opacity={0.18} borderRadius="2px" />
                <Text fontSize="xs" color={c.muted}>{band.label}</Text>
              </HStack>
            ) : null}
          </HStack>
        ) : <Box />}
        <Button size="xs" variant="ghost" onClick={() => setTable((v) => !v)} aria-pressed={table}>{table ? 'Chart' : 'Table'}</Button>
      </HStack>
      {table ? (
        <Box maxH={`${height}px`} overflow="auto">
          <Table size="sm">
            <Thead><Tr><Th>{xKey}</Th>{series.map((s) => <Th key={s.key} isNumeric>{s.label}</Th>)}{band ? <Th isNumeric>{band.label}</Th> : null}</Tr></Thead>
            <Tbody>{data.map((d) => (
              <Tr key={d[xKey]}><Td>{d[xKey]}</Td>
                {series.map((s) => <Td key={s.key} isNumeric>{has(d, s.key) ? format(Number(d[s.key])) : '—'}</Td>)}
                {band ? <Td isNumeric>{has(d, band.lowKey) ? `${format(Math.max(0, Number(d[band.lowKey])))} – ${format(Number(d[band.highKey]))}` : '—'}</Td> : null}
              </Tr>
            ))}</Tbody>
          </Table>
        </Box>
      ) : (
        <Box ref={ref} position="relative" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={series.map((s) => s.label).join(', ')}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={c.border} strokeWidth={1} />
                <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={c.faint}>{format(t)}</text>
              </g>
            ))}
            {data.map((d, i) => ((i % xTickEvery === 0 && x(data.length - 1) - x(i) >= tickLabelW * 1.6) || i === data.length - 1) ? (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === data.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'} fontSize="10" fill={c.faint}>{String(d[xKey]).slice(5)}</text>
            ) : null)}
            {band ? <path d={bandPath()} fill={band.color} opacity={0.14} stroke="none" /> : null}
            {markerIndex !== undefined && markerIndex >= 0 && markerIndex < data.length ? (
              <g>
                <line x1={x(markerIndex)} x2={x(markerIndex)} y1={pad.top} y2={pad.top + innerH} stroke={c.faint} strokeWidth={1} />
                {markerLabel ? <text x={x(markerIndex) + 4} y={pad.top + 10} fontSize="10" fill={c.muted}>{markerLabel}</text> : null}
              </g>
            ) : null}
            {area && series[0] ? (
              <path d={`${path(series[0].key)} L${x(data.length - 1)},${y(min)} L${x(0)},${y(min)} Z`} fill={series[0].color} opacity={0.1} />
            ) : null}
            {series.map((s) => (
              <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {hover !== null ? (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke={c.muted} strokeWidth={1} strokeDasharray="3 3" />
                {series.filter((s) => has(data[hover], s.key)).map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]))} r={4} fill={s.color} stroke={c.surface} strokeWidth={2} />
                ))}
              </g>
            ) : null}
          </svg>
          {hover !== null ? (
            <Box position="absolute" top="4px" left={`${(x(hover) / width) * 100}%`} transform={x(hover) > width * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)'}
              bg={c.surface} border="1px solid" borderColor={c.border} borderRadius="6px" px={2.5} py={1.5} pointerEvents="none" boxShadow="sm" zIndex={2}>
              <Text fontSize="11px" color={c.muted}>{String(data[hover][xKey])}</Text>
              {series.filter((s) => has(data[hover], s.key)).map((s) => (
                <HStack key={s.key} spacing={1.5}>
                  <Box w="8px" h="2px" bg={s.color} />
                  <Text fontSize="12px" color={c.text} fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>{format(Number(data[hover][s.key]))}</Text>
                  {series.length > 1 ? <Text fontSize="11px" color={c.muted}>{s.label}</Text> : null}
                </HStack>
              ))}
              {band && has(data[hover], band.lowKey) ? (
                <Text fontSize="11px" color={c.muted}>{band.label}: {format(Math.max(0, Number(data[hover][band.lowKey])))} – {format(Number(data[hover][band.highKey]))}</Text>
              ) : null}
            </Box>
          ) : null}
        </Box>
      )}
    </Box>
  );
}

/** Horizontal magnitude bars, one hue, direct labels (values in text ink). */
export function BarList({ items, format = (n) => String(n), color }: {
  items: Array<{ label: string; value: number; sub?: string }>; format?: (n: number) => string; color?: string;
}) {
  const c = useCockpitColors();
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;
  if (!items.length) return <Text fontSize="sm" color={c.muted}>No data.</Text>;
  return (
    <Box display="grid" gap={2.5}>
      {items.map((it) => (
        <Box key={it.label} title={`${it.label}: ${format(it.value)}`}>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="12px" color={c.text}>{it.label}{it.sub ? <Text as="span" color={c.faint}> · {it.sub}</Text> : null}</Text>
            <Text fontSize="12px" color={c.text} fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>{format(it.value)}</Text>
          </HStack>
          <Box h="8px" bg={c.surface2} borderRadius="4px" overflow="hidden">
            <Box h="100%" w={`${Math.max(it.value > 0 ? 1.5 : 0, (it.value / max) * 100)}%`} bg={color ?? c.series1} borderRadius="0 4px 4px 0" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
