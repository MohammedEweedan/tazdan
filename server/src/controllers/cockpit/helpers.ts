/**
 * Shared helpers for Control Cockpit endpoints.
 */
import type { Request } from 'express';
import { prisma } from '../../utils/prisma';
import { usdRate } from '../../utils/kycLimits';

export type Period = 'today' | '7d' | '30d' | 'quarter' | 'year';
const PERIOD_MS: Record<Exclude<Period, 'today'>, number> = {
  '7d': 7 * 86400_000,
  '30d': 30 * 86400_000,
  quarter: 90 * 86400_000,
  year: 365 * 86400_000,
};

/** Current window and the immediately preceding window of equal length. */
export function periodWindow(raw: unknown): { period: Period; from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const period = (['today', '7d', '30d', 'quarter', 'year'].includes(String(raw)) ? raw : '30d') as Period;
  const to = new Date();
  let from: Date;
  if (period === 'today') {
    from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  } else {
    from = new Date(to.getTime() - PERIOD_MS[period]);
  }
  const len = to.getTime() - from.getTime();
  return { period, from, to, prevFrom: new Date(from.getTime() - len), prevTo: from };
}

/** Memoised USD converter for one request (live prices, static fallback). */
export function usdConverter() {
  const cache = new Map<string, Promise<number>>();
  const rate = (currency: string) => {
    const c = currency.toUpperCase();
    if (!cache.has(c)) cache.set(c, usdRate(c).catch(() => 0));
    return cache.get(c)!;
  };
  return {
    rate,
    async sum(rows: Array<{ currency: string; amount: unknown }>): Promise<number> {
      let total = 0;
      for (const r of rows) total += Math.abs(Number(r.amount ?? 0)) * (await rate(r.currency));
      return Math.round(total * 100) / 100;
    },
  };
}

let systemIds: { at: number; ids: string[] } | null = null;
/** Internal accounts (platform treasury mirror, support bot) — never counted as customers. */
export async function systemUserIds(): Promise<string[]> {
  if (systemIds && Date.now() - systemIds.at < 10 * 60_000) return systemIds.ids;
  const rows = await prisma.user.findMany({ where: { username: { in: ['platform', 'support'] } }, select: { id: true } });
  systemIds = { at: Date.now(), ids: rows.map((r) => r.id) };
  return systemIds.ids;
}

export function pageParams(req: Request, maxLimit = 100) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
  return { page, limit, skip: (page - 1) * limit };
}

export function pct(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Mask everything except the first character of each word and the domain of an email. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 2)}***@${domain ?? ''}`;
}
export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  return `${phone.slice(0, 4)}****${phone.slice(-2)}`;
}
