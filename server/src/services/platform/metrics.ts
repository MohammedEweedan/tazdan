/**
 * In-process request metrics for the Control Cockpit.
 *
 * Each response is recorded under a route group (method + mount, e.g.
 * "POST /api/withdrawals") into a ring buffer of recent samples, from which
 * p50/p95/p99 latency, throughput and error rate are computed over a
 * window. Event-loop lag is sampled too. Periodic snapshots are persisted to
 * SystemMetricSample so the cockpit can show history across restarts.
 *
 * Per-process by design: with several workers each reports its own view;
 * the snapshot table carries the pid so they can be told apart.
 */
import type { NextFunction, Request, Response } from 'express';
import { monitorEventLoopDelay } from 'perf_hooks';
import { prisma } from '../../utils/prisma';
import { logger } from '../../utils/logger';

interface Sample { at: number; ms: number; status: number }

const MAX_SAMPLES_PER_GROUP = 2_000;
const groups = new Map<string, Sample[]>();
const startedAt = Date.now();

const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();

/** Collapse ids so routes group together: /api/users/123/balances → /api/users/:id/balances */
export function routeGroup(method: string, path: string): string {
  const clean = path.split('?')[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/c[a-z0-9]{20,}/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:n')
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, '/:token');
  const parts = clean.split('/').slice(0, 5).join('/');
  return `${method.toUpperCase()} ${parts}`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const key = routeGroup(req.method, req.originalUrl);
    let buf = groups.get(key);
    if (!buf) { buf = []; groups.set(key, buf); }
    buf.push({ at: Date.now(), ms, status: res.statusCode });
    if (buf.length > MAX_SAMPLES_PER_GROUP) buf.splice(0, buf.length - MAX_SAMPLES_PER_GROUP);
  });
  next();
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 10) / 10;
}

export interface GroupStats {
  group: string;
  count: number;
  perMinute: number;
  errorRate: number;     // 5xx / count
  clientErrorRate: number; // 4xx / count
  p50: number;
  p95: number;
  p99: number;
}

export function snapshot(windowMs = 15 * 60_000) {
  const since = Date.now() - windowMs;
  const out: GroupStats[] = [];
  const all: number[] = [];
  let total = 0;
  let errors = 0;
  for (const [group, buf] of groups) {
    const recent = buf.filter((s) => s.at >= since);
    if (!recent.length) continue;
    const ms = recent.map((s) => s.ms).sort((a, b) => a - b);
    const e5 = recent.filter((s) => s.status >= 500).length;
    const e4 = recent.filter((s) => s.status >= 400 && s.status < 500).length;
    total += recent.length;
    errors += e5;
    all.push(...ms);
    out.push({
      group,
      count: recent.length,
      perMinute: Math.round((recent.length / (windowMs / 60_000)) * 10) / 10,
      errorRate: e5 / recent.length,
      clientErrorRate: e4 / recent.length,
      p50: percentile(ms, 50),
      p95: percentile(ms, 95),
      p99: percentile(ms, 99),
    });
  }
  all.sort((a, b) => a - b);
  out.sort((a, b) => b.count - a.count);
  return {
    windowMinutes: windowMs / 60_000,
    totals: {
      requests: total,
      perMinute: Math.round((total / (windowMs / 60_000)) * 10) / 10,
      errorRate: total ? errors / total : 0,
      p50: percentile(all, 50),
      p95: percentile(all, 95),
      p99: percentile(all, 99),
    },
    eventLoopLagMs: {
      p50: Math.round(loop.percentile(50) / 1e4) / 100,
      p99: Math.round(loop.percentile(99) / 1e4) / 100,
      max: Math.round(loop.max / 1e4) / 100,
    },
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576),
      node: process.version,
    },
    groups: out,
  };
}

let sampler: NodeJS.Timeout | null = null;

/** Persist a compact snapshot every 5 minutes (one worker is enough). */
export function startMetricsSampler(intervalMs = 5 * 60_000): void {
  if (sampler) return;
  sampler = setInterval(() => {
    const s = snapshot(intervalMs);
    void prisma.systemMetricSample.create({
      data: { kind: 'API', data: { ...s, groups: s.groups.slice(0, 40) } as any },
    }).catch((err) => logger.warn('[metrics] snapshot write failed', { err: (err as Error).message }));
  }, intervalMs);
  sampler.unref?.();
}
