/**
 * Request-shape hardening shared by the whole API (wired in index.ts).
 */
import querystring from 'querystring';
import type { NextFunction, Request, Response } from 'express';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_QUERY_KEYS = 100;

/**
 * Express `query parser`: every value is a plain string.
 *
 * The default (qs, "extended") turns `?status[not]=X` into an object, which
 * flowed straight into Prisma `where` clauses as an operator, and `?a=1&a=2`
 * into arrays that crash `.toUpperCase()` handlers. Here nested syntax is just
 * a literal key, repeated keys keep the last value, prototype keys are
 * dropped and the number of keys is capped.
 */
export function parseQueryString(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!str) return out;
  const parsed = querystring.parse(str, '&', '=', { maxKeys: MAX_QUERY_KEYS });
  for (const key of Object.keys(parsed)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const v = parsed[key];
    const value = Array.isArray(v) ? v[v.length - 1] : v;
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/**
 * JSON body reviver: drops `__proto__` keys, and `constructor`/`prototype`
 * keys holding objects, so no parsed body can carry a prototype-pollution
 * gadget into a merge or Object.assign anywhere downstream.
 */
export function jsonReviver(key: string, value: unknown): unknown {
  if (key === '__proto__') return undefined;
  if ((key === 'constructor' || key === 'prototype') && value !== null && typeof value === 'object') return undefined;
  return value;
}

/**
 * API responses carry balances, statements and personal data: never cache
 * them in browsers or shared proxies unless a route explicitly opts in
 * (public market data sets its own Cache-Control later).
 */
export function noStoreApi(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
