'use client';

/**
 * Link-analysis graph for the fraud centre: customers joined by a shared
 * device or a shared payout account. Plain SVG with a small deterministic
 * force layout (same input → same picture). Node type is carried by shape
 * (circle / square / diamond) as well as colour, so identity never relies on
 * colour alone; a table view lists every link.
 */
import { useMemo, useState } from 'react';
import { Box, Button, HStack, Table, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { useCockpitColors } from './ui';

export interface GraphNode { id: string; type: 'customer' | 'device' | 'account'; label: string }
export interface GraphEdge { from: string; to: string; kind: string }

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }

function layout(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number) {
  const pos = new Map(nodes.map((n) => [n.id, { x: w * (0.15 + 0.7 * hash(n.id)), y: h * (0.15 + 0.7 * hash(`${n.id}y`)), vx: 0, vy: 0 }]));
  const k = Math.min(110, Math.sqrt((w * h) / Math.max(1, nodes.length)) * 0.5);
  for (let it = 0; it < 260; it++) {
    const temp = 1 - it / 260;
    for (const a of nodes) {
      const pa = pos.get(a.id)!;
      for (const b of nodes) {
        if (a.id === b.id) continue;
        const pb = pos.get(b.id)!;
        const dx = pa.x - pb.x; const dy = pa.y - pb.y; const d2 = Math.max(1, dx * dx + dy * dy);
        if (d2 > 9 * k * k) continue; // short-range only, so separate clusters don't fling each other to the edges
        const f = (k * k) / d2;
        pa.vx += dx * f * 0.02; pa.vy += dy * f * 0.02;
      }
    }
    for (const e of edges) {
      const pa = pos.get(e.from); const pb = pos.get(e.to);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x; const dy = pb.y - pa.y; const d = Math.max(1, Math.hypot(dx, dy));
      const f = ((d - k) / d) * 0.06;
      pa.vx += dx * f; pa.vy += dy * f; pb.vx -= dx * f; pb.vy -= dy * f;
    }
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      p.vx += (w / 2 - p.x) * 0.012; p.vy += (h / 2 - p.y) * 0.012; // pull to centre
      const step = Math.min(12 * temp + 1, Math.hypot(p.vx, p.vy));
      const len = Math.hypot(p.vx, p.vy) || 1;
      p.x = Math.max(30, Math.min(w - 30, p.x + (p.vx / len) * step));
      p.y = Math.max(28, Math.min(h - 28, p.y + (p.vy / len) * step));
      p.vx *= 0.5; p.vy *= 0.5;
    }
  }
  return pos;
}

export function NetworkGraph({ nodes, edges, onCustomer, height = 420 }: { nodes: GraphNode[]; edges: GraphEdge[]; onCustomer?: (id: string) => void; height?: number }) {
  const c = useCockpitColors();
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const w = 900; const h = height;
  const pos = useMemo(() => layout(nodes, edges, w, h), [nodes, edges, h]);
  const linked = useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    for (const e of edges) { if (e.from === hover) s.add(e.to); if (e.to === hover) s.add(e.from); }
    return s;
  }, [hover, edges]);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (!nodes.length) return <Text fontSize="sm" color={c.muted} p={4}>No shared devices or shared payout accounts between customers.</Text>;

  const shape = (n: GraphNode, x: number, y: number, active: boolean) => {
    const stroke = c.surface; const sw = 2;
    if (n.type === 'customer') return <circle cx={x} cy={y} r={active ? 8 : 7} fill={c.series1} stroke={stroke} strokeWidth={sw} />;
    if (n.type === 'device') return <rect x={x - 6} y={y - 6} width={12} height={12} rx={2} fill={c.seriesPrev} stroke={stroke} strokeWidth={sw} />;
    return <path d={`M${x},${y - 8} L${x + 8},${y} L${x},${y + 8} L${x - 8},${y} Z`} fill={c.surface} stroke={c.muted} strokeWidth={2} />;
  };

  return (
    <Box>
      <HStack justify="space-between" mb={2} flexWrap="wrap">
        <HStack spacing={4} fontSize="xs" color={c.muted}>
          <HStack spacing={1.5}><Box as="svg" w="14px" h="14px"><circle cx="7" cy="7" r="6" fill={c.series1} /></Box><Text>Customer</Text></HStack>
          <HStack spacing={1.5}><Box as="svg" w="14px" h="14px"><rect x="1" y="1" width="12" height="12" rx="2" fill={c.seriesPrev} /></Box><Text>Shared device</Text></HStack>
          <HStack spacing={1.5}><Box as="svg" w="14px" h="14px"><path d="M7,0 L14,7 L7,14 L0,7 Z" fill="none" stroke={c.muted} strokeWidth="2" /></Box><Text>Shared payout account</Text></HStack>
        </HStack>
        <Button size="xs" variant="ghost" onClick={() => setTable((v) => !v)} aria-pressed={table}>{table ? 'Graph' : 'Table'}</Button>
      </HStack>
      {table ? (
        <Box maxH={`${h}px`} overflow="auto">
          <Table size="sm">
            <Thead><Tr><Th>Customer</Th><Th>Linked through</Th><Th>Link</Th></Tr></Thead>
            <Tbody>{edges.map((e, i) => (
              <Tr key={i}><Td>{byId.get(e.from)?.label ?? e.from.slice(0, 8)}</Td><Td>{e.kind === 'device' ? 'device' : 'payout account'}</Td><Td>{byId.get(e.to)?.label}</Td></Tr>
            ))}</Tbody>
          </Table>
        </Box>
      ) : (
        <Box overflowX="auto">
          <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ minWidth: 560, display: 'block' }} role="img" aria-label="Customers linked by shared devices or payout accounts">
            {edges.map((e, i) => {
              const a = pos.get(e.from); const b = pos.get(e.to);
              if (!a || !b) return null;
              const on = !linked || (linked.has(e.from) && linked.has(e.to));
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? c.muted : c.border} strokeWidth={on && linked ? 2 : 1} strokeDasharray={e.kind === 'device' ? undefined : '4 3'} />;
            })}
            {nodes.map((n) => {
              const p = pos.get(n.id)!;
              const on = !linked || linked.has(n.id);
              return (
                <g key={n.id} opacity={on ? 1 : 0.25} style={{ cursor: n.type === 'customer' && onCustomer ? 'pointer' : 'default' }}
                  onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onClick={() => n.type === 'customer' && onCustomer?.(n.id)}>
                  <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
                  {shape(n, p.x, p.y, hover === n.id)}
                  {(n.type === 'customer' || hover === n.id) ? (
                    <text x={p.x > w - 110 ? p.x - 11 : p.x + 11} y={p.y + 4} textAnchor={p.x > w - 110 ? 'end' : 'start'} fontSize="11" fill={c.text}
                      stroke={c.surface} strokeWidth={4} strokeLinejoin="round" style={{ paintOrder: 'stroke' }}>{n.label}</text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </Box>
      )}
    </Box>
  );
}
