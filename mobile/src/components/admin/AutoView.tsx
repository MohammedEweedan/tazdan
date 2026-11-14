/**
 * Renders any cockpit response readably on a phone: numbers and short
 * values as a stat grid and key/value list, arrays of records as rows
 * (first descriptive field as the title, a few more as the subtitle), and
 * nested objects as their own sections. Used for read-only dashboards so the
 * mobile admin shows everything the web cockpit's endpoint returns.
 */
import { ReactNode, useState } from 'react';
import { Empty, JsonSheet, KV, Pill, Row, Section, dateTime, num } from '@/components/admin/cockpit';

const TITLE_KEYS = ['name', 'title', 'label', 'reference', 'code', 'type', 'action', 'asset', 'currency', 'pair', 'check', 'metric', 'email', 'id'];
const STATUS_KEYS = ['status', 'state', 'outcome', 'severity', 'ok'];
const isDate = (k: string, v: unknown) => typeof v === 'string' && /(At|Date|date|at)$/.test(k) && !Number.isNaN(Date.parse(v));
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function scalar(k: string, v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return num(v, Math.abs(v) < 10 ? 4 : 2);
  if (isDate(k, v)) return dateTime(v as string);
  return String(v);
}

function recordTitle(r: Record<string, any>): string {
  for (const k of TITLE_KEYS) if (r[k] != null && typeof r[k] !== 'object') return scalar(k, r[k]);
  return 'Record';
}

function recordSubtitle(r: Record<string, any>, title: string): string {
  return Object.entries(r)
    .filter(([k, v]) => v != null && typeof v !== 'object' && !STATUS_KEYS.includes(k) && scalar(k, v) !== title && !/Id$|^id$/.test(k))
    .slice(0, 4).map(([k, v]) => `${label(k)} ${scalar(k, v)}`).join(' · ');
}

function statusOf(r: Record<string, any>): string | null {
  for (const k of STATUS_KEYS) {
    if (typeof r[k] === 'string') return r[k];
    if (typeof r[k] === 'boolean') return r[k] ? 'OK' : 'FAILED';
  }
  return null;
}

export function AutoView({ data, title, depth = 0 }: { data: any; title?: string; depth?: number }) {
  const [raw, setRaw] = useState<any>(null);
  if (data == null) return <Empty text="No data." />;
  if (Array.isArray(data)) {
    const rows = data.filter((x) => x && typeof x === 'object');
    if (!rows.length) return data.length ? <Section title={title}><KV items={data.slice(0, 30).map((v, i) => [String(i + 1), String(v)])} /></Section> : null;
    return (
      <Section title={title} subtitle={`${rows.length} ${rows.length === 1 ? 'item' : 'items'}`}>
        {rows.slice(0, 50).map((r, i) => {
          const t = recordTitle(r);
          const st = statusOf(r);
          return <Row key={r.id ?? i} last={i === Math.min(rows.length, 50) - 1} title={t} subtitle={recordSubtitle(r, t)} right={st ? <Pill label={st} /> : undefined} onPress={() => setRaw(r)} />;
        })}
        <JsonSheet value={raw} onClose={() => setRaw(null)} />
      </Section>
    );
  }
  if (typeof data !== 'object') return <Section title={title}><KV items={[[title ?? 'Value', scalar('', data)]]} /></Section>;
  const scalars = Object.entries(data).filter(([, v]) => v == null || typeof v !== 'object');
  const nested = Object.entries(data).filter(([, v]) => v != null && typeof v === 'object');
  const out: ReactNode[] = [];
  if (scalars.length) out.push(<Section key="_s" title={title}><KV items={scalars.map(([k, v]) => [label(k), scalar(k, v)])} /></Section>);
  for (const [k, v] of nested) {
    if (depth >= 3) { out.push(<Section key={k} title={label(k)}><Row last title="Open record" onPress={() => setRaw(v)} /></Section>); continue; }
    out.push(<AutoView key={k} data={v} title={title && depth ? `${title} · ${label(k)}` : label(k)} depth={depth + 1} />);
  }
  return <>{out}<JsonSheet value={raw} onClose={() => setRaw(null)} /></>;
}
