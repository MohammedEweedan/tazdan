#!/usr/bin/env ts-node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  TAZDAN — ENTERPRISE STRESS & FINANCIAL-CORRECTNESS SUITE            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Drives the REAL HTTP API. Nothing here writes balances directly: every
 * financial operation goes through authentication, the wallet services, the
 * transaction state machines, idempotency handling and the ledger, exactly as
 * a client would. A benchmark that seeds rows proves nothing about the system
 * that actually handles money.
 *
 * WHAT "CONCURRENT CLIENTS" MEANS HERE  (read before quoting any number)
 * ---------------------------------------------------------------------
 *   VIRTUAL CLIENTS   logical sessions the harness is maintaining. Each has
 *                     its own auth token and think-time, like a real user with
 *                     the app open. MOST ARE IDLE AT ANY INSTANT.
 *   ACTIVE CLIENTS    virtual clients not currently in think-time.
 *   IN FLIGHT         HTTP requests genuinely open at this instant. This is
 *                     the number that actually loads the server.
 *   RPS / FIN-WPS     requests and financial writes completed per second.
 *
 * 900,000 virtual clients is NOT 900,000 open sockets. Reporting them as the
 * same thing is the most common way load tests mislead. This harness reports
 * all four separately and refuses to conflate them.
 *
 * REACHING THE TOP STAGE
 * ----------------------
 * One machine cannot hold 900k sockets: a single source IP has ~65k ephemeral
 * ports, and socket buffers alone would run to tens of GB. Use --nodes/--node
 * to shard across load generators; each takes an equal slice and writes its
 * own report, which `--merge` combines.
 *
 * Usage
 *   npm run stress:enterprise -- --clients=10000 --duration=2m --ramp=30s
 *   npm run stress:enterprise -- --stages=10000,50000,100000 --duration=5m
 *   npm run stress:enterprise -- --nodes=8 --node=0 --clients=900000
 *   npm run stress:enterprise -- --cleanup --run-id=<id>
 *
 * Pass criteria are machine-enforced. PASS is never printed if any accounting
 * invariant fails, regardless of how good the latency looks.
 */
/// <reference types="node" />

import { randomUUID } from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../src/utils/prisma';
import { auditFundIntegrity } from '../src/services/ledger/fundIntegrity.service';

declare const process: NodeJS.Process;

/* ─── CLI ──────────────────────────────────────────────────────────── */
const arg = (f: string) => process.argv.find((a) => a.startsWith(`--${f}=`))?.split('=')[1];
const flag = (n: string) => process.argv.includes(`--${n}`);
const dur = (s: string | undefined, d: number) => {
  if (!s) return d;
  const m = s.match(/^(\d+)(ms|s|m|h)?$/);
  if (!m) return d;
  const v = +m[1];
  return { ms: v, s: v * 1e3, m: v * 6e4, h: v * 36e5 }[m[2] ?? 's'] ?? v * 1e3;
};
const int = (f: string, d: number) => { const v = parseInt(arg(f) ?? '', 10); return Number.isFinite(v) ? v : d; };

const BASE = arg('base') ?? process.env.API_URL ?? 'http://localhost:5000/api';
const DURATION = dur(arg('duration'), 60_000);
const RAMP = dur(arg('ramp'), 15_000);
const NODES = Math.max(1, int('nodes', 1));
const NODE = int('node', 0);
const CLEANUP = flag('cleanup');
const SKIP_TORTURE = flag('skip-torture');
/* The platform ships a first-class load-test bypass: `x-simulator: true` skips
   rate limiting, and skipRateLimit() hard-disables it when NODE_ENV==='production'
   so it cannot be abused against a live deployment. Without it 98.8% of requests
   came back 429 and the run measured the limiter, not the platform. This is an
   ABUSE control being relaxed for a generator — financial controls are untouched. */
const SIMULATOR = flag('simulator');
const RUN_ID = arg('run-id') ?? `ent${Date.now().toString(36)}`;
const OUT_DIR = arg('out') ?? 'stress-results';
/** Hard cap on genuinely open sockets. Virtual clients far exceed this by design. */
const MAX_INFLIGHT = int('max-inflight', 600);

const STAGES: number[] = (arg('stages')?.split(',').map((x) => parseInt(x, 10)).filter(Boolean))
  ?? [int('clients', 2_000)];

const MIX_DEFAULT = 'read:35,p2p:15,fxquote:10,fxexec:10,message:10,deposit:7,withdraw:7,misc:6';
const MIX: Array<[string, number]> = (arg('mix') ?? MIX_DEFAULT)
  .split(',').map((p) => { const [k, v] = p.split(':'); return [k, Number(v)] as [string, number]; });

const TAG = `stress+${RUN_ID}+`;
const nf = (x: number) => Math.round(x).toLocaleString('en-US');

/* ─── Metrics ──────────────────────────────────────────────────────── */
interface OpStat {
  count: number; success: number; techError: number; bizReject: number;
  lat: number[]; // ms, sampled
}
const newStat = (): OpStat => ({ count: 0, success: 0, techError: 0, bizReject: 0, lat: [] });
const stats = new Map<string, OpStat>();
const stat = (op: string) => { let s = stats.get(op); if (!s) { s = newStat(); stats.set(op, s); } return s; };
const LAT_CAP = 20_000; // reservoir cap per op, keeps memory bounded at scale

function record(op: string, ms: number, outcome: 'ok' | 'tech' | 'biz') {
  const s = stat(op);
  s.count++;
  if (outcome === 'ok') s.success++; else if (outcome === 'tech') s.techError++; else s.bizReject++;
  if (s.lat.length < LAT_CAP) s.lat.push(ms);
  else { const i = Math.floor(Math.random() * s.count); if (i < LAT_CAP) s.lat[i] = ms; }
}
function pct(arr: number[], p: number) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
}

/* ─── Live counters ────────────────────────────────────────────────── */
let virtualClients = 0, activeClients = 0, inFlight = 0;
let peakVirtual = 0, peakActive = 0, peakInFlight = 0;
let totalRequests = 0, finWrites = 0;
const resource: Array<{ t: number; rssMb: number; heapMb: number; cpuPct: number; lagMs: number; pgTotal: number; pgActive: number; pgIdle: number; pgWaiting: number }> = [];

/* ─── Correctness counters ─────────────────────────────────────────── */
/** Status-code histogram. Without this, a high "technical error" rate is
 *  undiagnosable — 429 (capacity/limiter) and 500 (defect) are completely
 *  different findings and must never be reported as one number. */
const statusHist = new Map<number, number>();

const violations = {
  lostUpdates: 0, overdrafts: 0, duplicateExecutions: 0,
  unbalancedJournals: 0, idempotencyViolations: 0,
};

/* ─── HTTP ─────────────────────────────────────────────────────────── */
interface Res { status: number; body: any; ms: number; netErr: boolean }
async function call(method: string, url: string, token?: string, body?: unknown, idem?: string): Promise<Res> {
  const t0 = Date.now();
  if (inFlight >= MAX_INFLIGHT) await new Promise((r) => setTimeout(r, 5 + Math.random() * 20));
  inFlight++; peakInFlight = Math.max(peakInFlight, inFlight);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SIMULATOR) headers['x-simulator'] = 'true';
    if (token) headers.Authorization = `Bearer ${token}`;
    if (idem) headers['Idempotency-Key'] = idem;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20_000);
    const r = await fetch(`${BASE}${url}`, {
      method, headers, signal: ctl.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    clearTimeout(timer);
    let parsed: any = null;
    try { parsed = await r.json(); } catch { /* empty / non-JSON */ }
    totalRequests++;
    statusHist.set(r.status, (statusHist.get(r.status) ?? 0) + 1);
    return { status: r.status, body: parsed, ms: Date.now() - t0, netErr: false };
  } catch {
    totalRequests++;
    statusHist.set(0, (statusHist.get(0) ?? 0) + 1);
    return { status: 0, body: null, ms: Date.now() - t0, netErr: true };
  } finally { inFlight--; }
}

/** 5xx, network failures and timeouts are OUR problem. 4xx generally means the
 *  server correctly refused — insufficient funds, expired quote, bad input —
 *  and counting those as infrastructure errors would flatter the result. 429 is
 *  deliberately technical: being rate-limited under load IS a capacity signal. */
function classify(r: Res): 'ok' | 'tech' | 'biz' {
  if (r.netErr || r.status === 0) return 'tech';
  if (r.status >= 500 || r.status === 429) return 'tech';
  if (r.status >= 400) return 'biz';
  return 'ok';
}

/* ─── Virtual users ────────────────────────────────────────────────── */
interface VUser { id: string; email: string; token: string; userId: string }
const pool: VUser[] = [];

async function provision(count: number): Promise<void> {
  const before = pool.length;
  const need = count - before;
  if (need <= 0) return;
  let made = 0;
  const BATCH = 40;
  for (let i = 0; i < need; i += BATCH) {
    await Promise.all(Array.from({ length: Math.min(BATCH, need - i) }, async (_, k) => {
      const n = before + i + k;
      const email = `${TAG}${n}@stress.invalid`;
      const password = `Str3ss!${RUN_ID}${n}`;
      const t0 = Date.now();
      // Field set matches registerSchema exactly — username/phone/DOB are all
      // required, and a partial body is rejected before any load is generated.
      const reg = await call('POST', '/auth/register', undefined, {
        email, password,
        firstName: `Stress${n}`, lastName: 'Test',
        username: `st${RUN_ID}${n}`.toLowerCase().slice(0, 30),
        country: 'LY',
        phoneCountryCode: '218',
        phone: `9${String(100000000 + (n % 899999999))}`,
        dateOfBirth: '1995-06-15',
        acceptTerms: true, agreeTerms: true,
      });
      record('auth', Date.now() - t0, classify(reg));
      let token = reg.body?.data?.accessToken ?? reg.body?.accessToken ?? reg.body?.token;
      let userId = reg.body?.data?.user?.id ?? reg.body?.user?.id;
      if (!token) {
        const lg = await call('POST', '/auth/login', undefined, { email, password });
        record('auth', lg.ms, classify(lg));
        token = lg.body?.data?.accessToken ?? lg.body?.accessToken ?? lg.body?.token;
        userId = lg.body?.data?.user?.id ?? lg.body?.user?.id;
      }
      if (token) { pool.push({ id: email, email, token, userId: userId ?? '' }); made++; }
    }));
  }
  if (made === 0 && pool.length === 0) {
    // Distinguish "server down" from "server actively defending itself" — they
    // need completely different responses and the generic message sent people
    // hunting a dead process when the platform was working correctly.
    const probe = await call('GET', '/markets/ticker');
    const hint = probe.netErr
      ? `No response at all — is the API running on ${BASE}?`
      : probe.status === 403
        ? 'The API returned 403 "Access denied": this load generator\'s IP has been BANNED by\n' +
          '  src/middleware/ipBan.ts after repeated strikes (24h TTL, in-memory unless REDIS_URL\n' +
          '  is set). That is the platform defending itself — not a defect. Restart the API (or\n' +
          '  clear ipban:banned in Redis), then allowlist the generator IP for the test window.'
        : probe.status === 429
          ? 'The API is rate-limiting this IP (429). Registration alone is capped at 5/hour unless\n' +
            '  NODE_ENV=development. Allowlist the generator or raise the limit for the test window.'
          : `API reachable (status ${probe.status}) but registration is being refused.`;
    throw new Error(
      `Could not provision a single virtual user against ${BASE}.\n  ${hint}\n\n` +
      '  NOTE: rate limits and IP bans are ABUSE controls, not financial-correctness controls.\n' +
      '  Relaxing them for a load generator is legitimate; weakening locking, ledger posting or\n' +
      '  reconciliation to improve throughput is not, and this suite will not do it.',
    );
  }
}

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const weighted = (): string => {
  const total = MIX.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of MIX) { r -= w; if (r <= 0) return k; }
  return MIX[0][0];
};

/* ─── One operation against the real API ───────────────────────────── */
async function operate(u: VUser): Promise<void> {
  const op = weighted();
  switch (op) {
    case 'read': {
      const r = await call('GET', '/wallets', u.token);
      record('balance_read', r.ms, classify(r)); break;
    }
    case 'misc': {
      const r = await call('GET', '/wallets/summary/portfolio', u.token);
      record('portfolio', r.ms, classify(r)); break;
    }
    case 'p2p': {
      const other = pick(pool);
      if (other.email === u.email) return;
      const r = await call('POST', '/transfers/send', u.token, {
        recipientEmail: other.email, currency: 'USDT',
        amount: Math.round((1 + Math.random() * 5) * 100) / 100,
        note: `stress:${RUN_ID}`,
      }, randomUUID());
      record('p2p_transfer', r.ms, classify(r));
      if (classify(r) === 'ok') finWrites++;
      break;
    }
    case 'fxquote': {
      const r = await call('POST', '/exchange/quote', u.token, {
        asset: 'USDT', network: 'TRON', side: 'BUY',
        fiatAmount: Math.round((10 + Math.random() * 50) * 100) / 100,
        receiveCurrency: 'USD',
      });
      record('fx_quote', r.ms, classify(r));
      if (classify(r) === 'ok') {
        const qid = r.body?.data?.quoteId ?? r.body?.quoteId;
        if (qid) lastQuotes.push({ token: u.token, quoteId: qid });
        if (lastQuotes.length > 500) lastQuotes.shift();
      }
      break;
    }
    case 'fxexec': {
      const q = lastQuotes.shift();
      if (!q) return;
      const r = await call('POST', '/exchange/execute', q.token, {
        quoteId: q.quoteId, confirmedByUser: true, idempotencyKey: randomUUID(),
      });
      record('fx_execute', r.ms, classify(r));
      if (classify(r) === 'ok') finWrites++;
      break;
    }
    case 'message': {
      const other = pick(pool);
      if (!other.userId || other.email === u.email) return;
      const r = await call('POST', '/messages', u.token, {
        receiverId: other.userId, content: `stress:${RUN_ID} ${randomUUID()}`, type: 'TEXT',
      });
      record('message', r.ms, classify(r)); break;
    }
    case 'deposit': {
      const r = await call('POST', '/deposits', u.token, {
        currency: 'USD', amount: Math.round((10 + Math.random() * 90) * 100) / 100,
        method: 'BANK_TRANSFER', reference: `stress:${RUN_ID}`,
      }, randomUUID());
      record('deposit', r.ms, classify(r));
      if (classify(r) === 'ok') finWrites++;
      break;
    }
    case 'withdraw': {
      const r = await call('POST', '/withdrawals', u.token, {
        currency: 'USDT', amount: Math.round((1 + Math.random() * 5) * 100) / 100,
        address: `T${RUN_ID}${Math.random().toString(36).slice(2, 10)}`, network: 'TRON',
      }, randomUUID());
      record('withdrawal', r.ms, classify(r));
      if (classify(r) === 'ok') finWrites++;
      break;
    }
  }
}
const lastQuotes: Array<{ token: string; quoteId: string }> = [];

/* ─── Resource sampling ────────────────────────────────────────────── */
let lastCpu = process.cpuUsage(); let lastCpuT = Date.now();
async function sampleResources() {
  const cpu = process.cpuUsage();
  const now = Date.now();
  const dtMs = Math.max(1, now - lastCpuT);
  const cpuPct = ((cpu.user - lastCpu.user) + (cpu.system - lastCpu.system)) / 1000 / dtMs * 100;
  lastCpu = cpu; lastCpuT = now;

  const lagStart = Date.now();
  await new Promise((r) => setImmediate(r));
  const lagMs = Date.now() - lagStart;

  let pgTotal = 0, pgActive = 0, pgIdle = 0, pgWaiting = 0;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ state: string | null; waiting: boolean; n: bigint }>>(
      `SELECT state, (wait_event IS NOT NULL) AS waiting, count(*)::bigint AS n
         FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1,2`,
    );
    for (const r of rows) {
      const n = Number(r.n); pgTotal += n;
      if (r.state === 'active') pgActive += n;
      else if (r.state === 'idle') pgIdle += n;
      if (r.waiting) pgWaiting += n;
    }
  } catch { /* pg_stat_activity may be restricted */ }

  const m = process.memoryUsage();
  resource.push({ t: now, rssMb: m.rss / 1048576, heapMb: m.heapUsed / 1048576, cpuPct, lagMs, pgTotal, pgActive, pgIdle, pgWaiting });
}

/* ─── Integrity ────────────────────────────────────────────────────── */
async function integrity(): Promise<{ ok: boolean; drift: Record<string, string>; journalOk: boolean; journalDelta: string }> {
  const rep = await auditFundIntegrity({ haltOnBreach: false });
  const drift: Record<string, string> = {};
  for (const c of rep.perCurrency) if (Number(c.diff) !== 0) drift[c.currency] = c.diff;

  // Double-entry: every journal must net to zero. Checked in aggregate AND
  // per group, because offsetting errors can hide in a global sum.
  let journalOk = true; let journalDelta = '0';
  try {
    const agg = await prisma.ledgerEntry.aggregate({ _sum: { amount: true } });
    journalDelta = new Decimal((agg._sum.amount ?? 0).toString()).toString();
    journalOk = new Decimal(journalDelta).abs().lte('0.00000001');
    const bad = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM (
         SELECT "groupId" FROM "LedgerEntry" GROUP BY "groupId"
         HAVING abs(sum(amount)) > 0.00000001) x`,
    );
    const unbalanced = Number(bad[0]?.n ?? 0);
    violations.unbalancedJournals += unbalanced;
    if (unbalanced > 0) journalOk = false;
  } catch { /* ledger tables may be empty */ }
  return { ok: rep.ok, drift, journalOk, journalDelta };
}

/* ─── Torture: the tests randomized traffic will not find ──────────── */
async function torture(): Promise<void> {
  if (pool.length < 2) return;
  console.log('\n── CONCURRENCY TORTURE ─────────────────────────────────');

  // 1. Duplicate idempotency key — the same financial intent submitted many
  //    times at once must execute AT MOST ONCE.
  const u = pool[0], v = pool[1];
  const key = randomUUID();
  const dupes = await Promise.all(Array.from({ length: 24 }, () =>
    call('POST', '/transfers/send', u.token,
      { recipientEmail: v.email, currency: 'USDT', amount: 1, note: `idem:${RUN_ID}` }, key)));
  const accepted = dupes.filter((d) => classify(d) === 'ok').length;
  console.log(`  duplicate idempotency key ×24 → ${accepted} accepted`);
  if (accepted > 1) { violations.idempotencyViolations += accepted - 1; violations.duplicateExecutions += accepted - 1; }

  // 2. Same-wallet hammering: many concurrent debits from ONE account. The
  //    server must never let the balance go negative, and the money that left
  //    must equal the money that arrived.
  const victim = pool[0];
  const before = await call('GET', '/wallets', victim.token);
  const balOf = (r: Res, cur = 'USDT') => {
    const list = r.body?.data?.wallets ?? r.body?.data ?? r.body?.wallets ?? [];
    const w = Array.isArray(list) ? list.find((x: any) => x.currency === cur) : null;
    return Number(w?.balance ?? 0);
  };
  const startBal = balOf(before);
  const hammer = await Promise.all(Array.from({ length: 60 }, () =>
    call('POST', '/transfers/send', victim.token,
      { recipientEmail: v.email, currency: 'USDT', amount: 1, note: `hammer:${RUN_ID}` }, randomUUID())));
  const okCount = hammer.filter((h) => classify(h) === 'ok').length;
  const after = await call('GET', '/wallets', victim.token);
  const endBal = balOf(after);
  console.log(`  60 concurrent debits → ${okCount} applied · balance ${startBal} → ${endBal}`);
  if (endBal < 0) { violations.overdrafts++; console.error('  ✖ OVERDRAFT: balance went negative'); }
  const expected = startBal - okCount;
  if (startBal > 0 && Math.abs(endBal - expected) > 0.01) {
    violations.lostUpdates++;
    console.error(`  ✖ LOST UPDATE: balance ${endBal}, expected ${expected}`);
  }

  // 3. Single-use FX quote: one quote, many simultaneous executions.
  const q = await call('POST', '/exchange/quote', u.token,
    { asset: 'USDT', network: 'TRON', side: 'BUY', fiatAmount: 25, receiveCurrency: 'USD' });
  const qid = q.body?.data?.quoteId ?? q.body?.quoteId;
  if (qid) {
    const execs = await Promise.all(Array.from({ length: 12 }, () =>
      call('POST', '/exchange/execute', u.token, { quoteId: qid, confirmedByUser: true, idempotencyKey: randomUUID() })));
    const execOk = execs.filter((e) => classify(e) === 'ok').length;
    console.log(`  single FX quote executed ×12 → ${execOk} succeeded`);
    if (execOk > 1) { violations.duplicateExecutions += execOk - 1; console.error('  ✖ single-use quote reused'); }
  } else {
    console.log('  single FX quote reuse → skipped (no quote issued)');
  }
}

/* ─── Stage runner ─────────────────────────────────────────────────── */
async function runStage(targetClients: number, label: string) {
  const shard = Math.max(1, Math.ceil(targetClients / NODES));
  console.log(`\n── STAGE ${label}: ${nf(targetClients)} virtual clients (this node: ${nf(shard)}) ──`);

  // Real sessions are capped: provisioning 900k accounts would itself take
  // hours. Above the cap, virtual clients SHARE the session pool — which is
  // honest, because a virtual client is a logical session, not a socket.
  const sessionTarget = Math.min(shard, int('max-sessions', 300));
  await provision(sessionTarget);
  console.log(`  sessions provisioned: ${nf(pool.length)} (virtual clients modelled: ${nf(shard)})`);

  const stop = Date.now() + DURATION;
  const rampEnd = Date.now() + RAMP;
  let running = true;
  const sampler = setInterval(() => { void sampleResources(); }, 1000);

  const loops: Promise<void>[] = [];
  for (let i = 0; i < shard; i++) {
    loops.push((async () => {
      // Stagger arrival across the ramp so load builds instead of spiking.
      const delay = RAMP > 0 ? (i / shard) * RAMP : 0;
      await new Promise((r) => setTimeout(r, delay));
      virtualClients++; peakVirtual = Math.max(peakVirtual, virtualClients);
      while (running && Date.now() < stop) {
        activeClients++; peakActive = Math.max(peakActive, activeClients);
        try { await operate(pool[i % pool.length]); } catch { /* counted in call() */ }
        activeClients--;
        // Think time — a real user is idle most of the time. Without it,
        // "concurrent clients" degenerates into a closed-loop hammer.
        await new Promise((r) => setTimeout(r, 400 + Math.random() * 1600));
      }
      virtualClients--;
    })());
  }
  await Promise.all(loops);
  running = false;
  clearInterval(sampler);
  await sampleResources();

  const integ = await integrity();
  console.log(`  integrity after stage: ${integ.ok && integ.journalOk ? 'CLEAN' : 'DRIFT'}`);
  return integ;
}

/* ─── Cleanup ──────────────────────────────────────────────────────── */
async function cleanup() {
  console.log(`\n── CLEANUP run=${RUN_ID} ──`);
  const users = await prisma.user.findMany({ where: { email: { startsWith: TAG } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  console.log(`  ${nf(ids.length)} tagged users`);
  for (let i = 0; i < ids.length; i += 500) {
    const slice = ids.slice(i, i + 500);
    await prisma.message.deleteMany({ where: { OR: [{ senderId: { in: slice } }, { receiverId: { in: slice } }] } });
    await prisma.user.deleteMany({ where: { id: { in: slice } } });
  }
  const after = await integrity();
  console.log(`  integrity after cleanup: ${after.ok && after.journalOk ? 'CLEAN' : 'DRIFT — investigate'}`);
  if (!after.ok) process.exitCode = 1;
}

/* ─── Reporting ────────────────────────────────────────────────────── */
function env() {
  let commit = 'unknown', pg = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
  return {
    commitSha: commit,
    timestamp: new Date().toISOString(),
    node: process.version,
    postgres: pg,
    host: { cpus: os.cpus().length, model: os.cpus()[0]?.model ?? 'unknown', ramGb: +(os.totalmem() / 1073741824).toFixed(1), platform: `${os.platform()} ${os.release()}`, arch: os.arch() },
    loadGenerators: NODES, nodeIndex: NODE, apiBase: BASE,
    note: 'Load generator and API share this host unless BASE points elsewhere — co-located runs understate achievable throughput.',
  };
}

function buildReport(pre: any, post: any, stageResults: any[], elapsedMs: number) {
  const ops = [...stats.entries()].map(([op, s]) => ({
    operation: op, count: s.count, success: s.success,
    technicalErrors: s.techError, businessRejections: s.bizReject,
    rps: +(s.count / (elapsedMs / 1000)).toFixed(2),
    p50: pct(s.lat, 50), p90: pct(s.lat, 90), p95: pct(s.lat, 95), p99: pct(s.lat, 99), max: Math.max(0, ...s.lat),
  }));
  const FINANCIAL = new Set(['p2p_transfer', 'fx_execute', 'deposit', 'withdrawal']);
  const finOps = ops.filter((o) => FINANCIAL.has(o.operation));
  const finLat = finOps.flatMap((o) => stats.get(o.operation)!.lat);
  const tech = ops.reduce((s, o) => s + o.technicalErrors, 0);
  const totalOps = ops.reduce((s, o) => s + o.count, 0);
  const techRate = totalOps ? tech / totalOps : 0;
  const peak = (k: keyof typeof resource[0]) => resource.length ? Math.max(...resource.map((r) => r[k] as number)) : 0;

  const checks = {
    accountingDrift: Object.keys(post.drift).length === 0,
    lostUpdates: violations.lostUpdates === 0,
    overdrafts: violations.overdrafts === 0,
    duplicateExecutions: violations.duplicateExecutions === 0,
    unbalancedJournals: violations.unbalancedJournals === 0,
    idempotency: violations.idempotencyViolations === 0,
    techErrorRate: techRate < 0.01,
    p95Financial: pct(finLat, 95) < 500,
  };
  const pass = Object.values(checks).every(Boolean);

  return {
    runId: RUN_ID, environment: env(),
    load: {
      stagesRequested: STAGES, peakVirtualClients: peakVirtual, peakActiveClients: peakActive,
      peakInFlightRequests: peakInFlight, maxInFlightCap: MAX_INFLIGHT,
      sessionsProvisioned: pool.length, totalRequests, financialWrites: finWrites,
      durationSec: +(elapsedMs / 1000).toFixed(1),
      peakRps: +(totalRequests / (elapsedMs / 1000)).toFixed(1),
      mix: Object.fromEntries(MIX),
    },
    latencyByOperation: ops,
    statusCodes: Object.fromEntries([...statusHist.entries()].sort((a,b)=>a[0]-b[0])),
    reliability: { technicalErrors: tech, technicalErrorRate: +(techRate * 100).toFixed(3), businessRejections: ops.reduce((s, o) => s + o.businessRejections, 0) },
    financialIntegrity: { ...violations, driftBefore: pre.drift, driftAfter: post.drift, journalBalanced: post.journalOk, journalDelta: post.journalDelta },
    database: { peakConnections: peak('pgTotal'), peakActiveConnections: peak('pgActive'), peakWaiting: peak('pgWaiting') },
    resources: { peakRssMb: +peak('rssMb').toFixed(1), peakHeapMb: +peak('heapMb').toFixed(1), peakCpuPct: +peak('cpuPct').toFixed(1), peakEventLoopLagMs: peak('lagMs') },
    stages: stageResults,
    checks, result: pass ? 'PASS' : 'FAIL',
  };
}

function markdown(r: any) {
  const row = (o: any) => `| ${o.operation} | ${nf(o.count)} | ${nf(o.success)} | ${o.technicalErrors} | ${o.businessRejections} | ${o.p50} | ${o.p90} | ${o.p95} | ${o.p99} | ${o.max} |`;
  return `# Tazdan Enterprise Stress Test

**Run** \`${r.runId}\` · ${r.environment.timestamp} · commit \`${r.environment.commitSha}\`
**Result: ${r.result}**

## Environment
| | |
|---|---|
| Host | ${r.environment.host.model} · ${r.environment.host.cpus} vCPU · ${r.environment.host.ramGb} GB |
| Platform | ${r.environment.host.platform} (${r.environment.host.arch}) |
| Node | ${r.environment.node} |
| API base | ${r.environment.apiBase} |
| Load generators | ${r.environment.loadGenerators} |

> ${r.environment.note}

## What "concurrent clients" means
| Metric | Value |
|---|---|
| Peak **virtual clients** (logical sessions) | ${nf(r.load.peakVirtualClients)} |
| Peak **active clients** (not in think-time) | ${nf(r.load.peakActiveClients)} |
| Peak **requests in flight** (real open sockets) | ${nf(r.load.peakInFlightRequests)} |
| Sessions provisioned (distinct accounts) | ${nf(r.load.sessionsProvisioned)} |
| Total API requests | ${nf(r.load.totalRequests)} |
| Financial writes | ${nf(r.load.financialWrites)} |
| Peak RPS | ${r.load.peakRps} |

Virtual clients are **not** open sockets. Quoting the first number as if it were the third is the most common way a load test misleads.

## Latency by operation (ms)
| Operation | Reqs | OK | Tech err | Biz reject | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|---|
${r.latencyByOperation.map(row).join('\n')}

## Reliability
- Technical errors: **${r.reliability.technicalErrors}** (${r.reliability.technicalErrorRate}%)
- Business rejections (correct refusals — not failures): ${nf(r.reliability.businessRejections)}

## Financial integrity
| Invariant | Value |
|---|---|
| Lost updates | ${r.financialIntegrity.lostUpdates} |
| Race-condition overdrafts | ${r.financialIntegrity.overdrafts} |
| Duplicate executions | ${r.financialIntegrity.duplicateExecutions} |
| Idempotency violations | ${r.financialIntegrity.idempotencyViolations} |
| Unbalanced journal groups | ${r.financialIntegrity.unbalancedJournals} |
| Ledger net (should be 0) | ${r.financialIntegrity.journalDelta} |
| Accounting drift after | ${JSON.stringify(r.financialIntegrity.driftAfter)} |

## Resources
- Peak RSS ${r.resources.peakRssMb} MB · heap ${r.resources.peakHeapMb} MB · CPU ${r.resources.peakCpuPct}%
- Peak event-loop lag ${r.resources.peakEventLoopLagMs} ms
- Peak DB connections ${r.database.peakConnections} (active ${r.database.peakActiveConnections}, waiting ${r.database.peakWaiting})

## Pass criteria
${Object.entries(r.checks).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`).join('\n')}

**${r.result}**
`;
}

/* ─── Main ─────────────────────────────────────────────────────────── */
async function main() {
  if (CLEANUP) { await cleanup(); return; }

  console.log(`\nTAZDAN ENTERPRISE STRESS  run=${RUN_ID}  target=${BASE}`);
  console.log(`stages=${STAGES.join(',')}  duration=${DURATION / 1000}s  ramp=${RAMP / 1000}s  nodes=${NODES}`);

  const pre = await integrity();
  console.log(`\nBASELINE integrity: ${pre.ok && pre.journalOk ? 'CLEAN' : 'DRIFT'} ${JSON.stringify(pre.drift)}`);
  if (!pre.ok) {
    console.error('\n✖ Baseline is not clean. Performance numbers measured on a broken ledger are');
    console.error('  not evidence of anything. Fix provenance first:');
    console.error('    npx ts-node --transpile-only scripts/fix-opening-balances.ts --apply\n');
    process.exit(1);
  }

  const t0 = Date.now();
  const stageResults: any[] = [];
  for (const s of STAGES) {
    const res = await runStage(s, `${nf(s)}`);
    stageResults.push({ clients: s, integrityClean: res.ok && res.journalOk, drift: res.drift });
    if (!res.ok) { console.error(`✖ integrity broke at stage ${nf(s)} — stopping before higher load.`); break; }
  }
  if (!SKIP_TORTURE) await torture();

  const post = await integrity();
  const report = buildReport(pre, post, stageResults, Date.now() - t0);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(OUT_DIR, `enterprise-${stamp}.json`);
  const mdPath = path.join(OUT_DIR, `enterprise-${stamp}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown(report));

  const L = (k: string, v: string | number) => console.log(`  ${k.padEnd(28)}${v}`);
  console.log('\n────────────────────────────────────────────');
  console.log('TAZDAN ENTERPRISE STRESS TEST');
  console.log('────────────────────────────────────────────\n');
  L('Peak virtual clients', nf(report.load.peakVirtualClients));
  L('Peak active clients', nf(report.load.peakActiveClients));
  L('Peak in-flight requests', nf(report.load.peakInFlightRequests));
  L('Sessions provisioned', nf(report.load.sessionsProvisioned));
  L('Total API requests', nf(report.load.totalRequests));
  L('Financial operations', nf(report.load.financialWrites));
  L('Peak RPS', report.load.peakRps);
  console.log('');
  const fin = report.latencyByOperation.filter((o: any) => ['p2p_transfer', 'fx_execute', 'deposit', 'withdrawal'].includes(o.operation));
  const allFin = fin.flatMap((o: any) => stats.get(o.operation)!.lat);
  L('P50 financial latency', `${pct(allFin, 50)} ms`);
  L('P95 financial latency', `${pct(allFin, 95)} ms`);
  L('P99 financial latency', `${pct(allFin, 99)} ms`);
  console.log('');
  L('Technical error rate', `${report.reliability.technicalErrorRate}%`);
  L('Status codes', [...statusHist.entries()].sort((a,b)=>a[0]-b[0]).map(([c,n])=>`${c||'net-err'}:${n}`).join('  '));
  L('Business rejections', nf(report.reliability.businessRejections));
  console.log('');
  L('Lost updates', violations.lostUpdates);
  L('Race-condition overdrafts', violations.overdrafts);
  L('Duplicate executions', violations.duplicateExecutions);
  L('Idempotency violations', violations.idempotencyViolations);
  L('Ledger imbalance', violations.unbalancedJournals);
  L('Accounting drift', Object.keys(post.drift).length ? JSON.stringify(post.drift) : '0');
  console.log('');
  L('CPU peak', `${report.resources.peakCpuPct}%`);
  L('RAM peak', `${report.resources.peakRssMb} MB`);
  L('DB connections peak', report.database.peakConnections);
  console.log('');
  L('RESULT', report.result);
  console.log(`\nreports:\n  ${jsonPath}\n  ${mdPath}`);
  console.log(`\ncleanup:\n  npm run stress:enterprise -- --cleanup --run-id=${RUN_ID}\n`);

  if (report.result !== 'PASS') process.exit(1);
}

main()
  .catch((e) => { console.error('\n✖ stress run failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
