#!/usr/bin/env ts-node
/**
 * Live demo simulator.
 *
 * Keeps a local/staging app visibly busy while you watch the mobile app and
 * admin panel: simulated users register, get funded, trade, P2P, message, and
 * send money. Pass --target-email to make the activity hit your open account.
 *
 * Usage:
 *   npm run simulate:live -- --target-email=you@example.com --minutes=20 --users=6
 */

/// <reference types="node" />

import axios, { AxiosInstance, AxiosError } from 'axios';
import { randomBytes, randomInt } from 'crypto';
import { prisma } from '../src/utils/prisma';

declare const process: NodeJS.Process;

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const has = (name: string) => process.argv.includes(`--${name}`);

const BASE_URL = (arg('base') ?? process.env.API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
const ADMIN_EMAIL = arg('admin-email') ?? process.env.ADMIN_EMAIL ?? 'admin@exchange.ly';
const ADMIN_PASS = arg('admin-pass') ?? process.env.ADMIN_PASSWORD ?? 'Admin123!@#';
const TARGET_EMAIL = arg('target-email') ?? process.env.SIM_TARGET_EMAIL;
const TARGET_ID = arg('target-id') ?? process.env.SIM_TARGET_ID;
const MINUTES = Math.max(1, Number(arg('minutes') ?? '15'));
const USERS = Math.max(2, Number(arg('users') ?? '6'));
const PACE_MS = Math.max(600, Number(arg('pace-ms') ?? '2500'));
const VERBOSE = has('verbose');

type User = {
  id: string;
  email: string;
  username: string;
  http: AxiosInstance;
};

type Target = {
  id: string;
  email: string;
};

const stats: Record<string, number> = {};
const bump = (k: string) => { stats[k] = (stats[k] ?? 0) + 1; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = <T>(xs: T[]) => xs[randomInt(0, xs.length)];
const uid = () => randomBytes(5).toString('hex');
const money = (min: number, max: number, dp = 2) => Number((min + Math.random() * (max - min)).toFixed(dp));
const log = (s: string) => console.log(s);

function describeError(e: unknown): string {
  const err = e as AxiosError<any> & { message?: string };
  const status = err.response?.status ? `HTTP ${err.response.status}` : '';
  const body = err.response?.data
    ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data))
    : '';
  return [status, body, err.message].filter(Boolean).join(' · ') || String(e);
}

function http(token?: string): AxiosInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Simulator': 'true',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return axios.create({ baseURL: BASE_URL, headers, timeout: 20_000 });
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const res = await fn();
    bump(label);
    return res;
  } catch (e) {
    const err = e as AxiosError<any>;
    bump(`err.${label}`);
    if (VERBOSE) {
      log(`[skip] ${label}: ${err.response?.data?.error ?? err.response?.data?.message ?? err.message}`);
    }
    return null;
  }
}

let adminHttp: AxiosInstance | null = null;
async function admin(): Promise<AxiosInstance> {
  if (adminHttp) return adminHttp;
  const res = await http().post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  adminHttp = http(res.data.accessToken);
  return adminHttp;
}

async function findTarget(): Promise<Target | null> {
  if (TARGET_ID) return { id: TARGET_ID, email: TARGET_EMAIL ?? TARGET_ID };
  if (!TARGET_EMAIL) return null;
  if (TARGET_EMAIL === 'you@example.com') {
    log('No real --target-email provided; running sim-user activity only.');
    return null;
  }
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
  const user = isLocal
    ? await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: TARGET_EMAIL, mode: 'insensitive' } },
            { username: { equals: TARGET_EMAIL.replace(/^@/, ''), mode: 'insensitive' } },
          ],
        },
        select: { id: true, email: true, username: true },
      })
    : (await admin().then((a) => a.get('/admin/users', { params: { search: TARGET_EMAIL, limit: 10 } })))
        .data.users?.find((u: any) => String(u.email).toLowerCase() === TARGET_EMAIL.toLowerCase());
  if (!user) {
    log(`Target user not found for --target-email=${TARGET_EMAIL}; running sim-user activity only.`);
    return null;
  }
  return { id: user.id, email: user.email ?? user.username ?? TARGET_EMAIL };
}

async function registerUser(i: number): Promise<User> {
  const suffix = uid();
  const username = `live_${suffix}`;
  const email = `live_${suffix}@sim.local`;
  const password = 'LiveSim123!@#';
  const firstName = pick(['Maya', 'Omar', 'Lina', 'Rayan', 'Sara', 'Hassan', 'Nour', 'Adam']);
  const lastName = pick(['Khan', 'Ali', 'Hassan', 'Patel', 'Mansour', 'Ibrahim']);
  const anon = http();

  await anon.post('/auth/register', {
    email,
    password,
    username,
    firstName,
    lastName,
    country: pick(['US', 'GB', 'AE', 'LY', 'SA', 'EG']),
    phoneCountryCode: pick(['1', '44', '971', '218', '966', '20']),
    phone: String(randomInt(600_000_000, 999_999_999)),
    dateOfBirth: `${randomInt(1986, 2002)}-${String(randomInt(1, 13)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`,
  });
  const login = await anon.post('/auth/login', { email, password });
  const user: User = { id: login.data.user.id, email, username, http: http(login.data.accessToken) };

  const a = await admin();
  await safe('admin.activate', () => a.put(`/admin/users/${user.id}/status`, { status: 'ACTIVE' }));
  await safe('admin.kyc', () => a.put(`/admin/kyc/${user.id}/approve`));
  for (const credit of [
    { currency: 'USDT', amount: money(1800, 6000, 0) },
    { currency: 'USD', amount: money(800, 4000, 0) },
  ]) {
    await safe('admin.seed', () => a.post('/admin/seed-balance', { userId: user.id, ...credit }));
  }
  log(`[user] ${i + 1}/${USERS} ${username} funded`);
  return user;
}

async function sendMessage(sender: User, receiver: User | Target) {
  const content = pick([
    'hey, just sent that over',
    'rate looks decent right now',
    'can you check if it landed?',
    'buying a little more here',
    'payment marked sent',
    'thanks, got it',
    'admin dashboard should show this',
    'small test transfer incoming',
  ]);
  await safe('message', () => sender.http.post('/messages', { receiverId: receiver.id, content }));
  log(`[msg] ${sender.username} -> ${'username' in receiver ? receiver.username : receiver.email}: ${content}`);
}

async function sendMoney(sender: User, receiver: User | Target) {
  const amount = money(3, 35);
  const note = pick(['coffee', 'demo payment', 'invoice test', 'thanks', 'settlement']);
  const res = await safe('payment.message', () =>
    sender.http.post('/messages', {
      receiverId: receiver.id,
      content: note,
      type: 'PAYMENT',
      metadata: { currency: 'USDT', amount, note },
    })
  );
  if (res) {
    log(`[pay] ${sender.username} -> ${'username' in receiver ? receiver.username : receiver.email}: ${amount} USDT`);
  }
}

async function order(user: User) {
  const side = pick(['BUY', 'SELL'] as const);
  const amount = side === 'BUY' ? money(25, 250, 0) : money(10, 120, 0);
  await safe(`order.${side.toLowerCase()}`, () =>
    user.http.post('/orders', { side, quoteCurrency: 'USD', amount })
  );
  log(`[order] ${user.username} ${side} ${amount} USD`);
}

async function p2p(seller: User, buyer: User) {
  const fiatCurrency = pick(['USD', 'LYD', 'AED', 'SAR']);
  const price = money(1, fiatCurrency === 'USD' ? 1.08 : 5.4, 2);
  const amount = money(80, 260, 2);
  const listingRes = await safe<any>('p2p.listing', () =>
    seller.http.post('/p2p/listings', {
      currency: 'USDT',
      fiatCurrency,
      side: 'SELL',
      price,
      amount,
      minLimit: Math.max(10, amount * price * 0.2),
      maxLimit: amount * price * 0.9,
      paymentMethods: [pick(['Bank Transfer', 'Cash', 'Wise'])],
      terms: 'Live simulator listing. Fast release.',
      timeframeMins: 30,
    })
  );
  const listing = listingRes && (listingRes as any).data?.listing;
  if (!listing) return;

  const tradeAmount = money(Math.max(5, amount * 0.1), amount * 0.35, 4);
  const tradeRes = await safe<any>('p2p.trade', () =>
    buyer.http.post('/p2p/trades', {
      listingId: listing.id,
      amount: tradeAmount,
      paymentMethod: listing.paymentMethods?.[0] ?? 'Bank Transfer',
      note: 'live demo trade',
    })
  );
  const trade = tradeRes && (tradeRes as any).data?.trade;
  if (!trade) return;
  await safe('p2p.paid', () => buyer.http.put(`/p2p/trades/${trade.id}/payment-sent`));
  await sleep(randomInt(600, 1800));
  await safe('p2p.confirm', () => seller.http.put(`/p2p/trades/${trade.id}/confirm`));
  log(`[p2p] ${buyer.username} bought ${tradeAmount} USDT from ${seller.username}`);
}

async function adminPeek() {
  const a = await admin();
  await safe('admin.dashboard', () => a.get('/admin/dashboard'));
  await safe('admin.metrics', () => a.get('/admin/metrics'));
  await safe('admin.p2p', () => a.get('/admin/p2p/trades', { params: { limit: 5 } }));
  log('[admin] dashboard/metrics refreshed');
}

async function main() {
  log(`Live simulator: ${BASE_URL}`);
  log(`Duration: ${MINUTES}m | users: ${USERS} | pace: ${PACE_MS}ms`);

  const target = await findTarget();
  if (target) log(`Targeting your account: ${target.email}`);

  const users: User[] = [];
  for (let i = 0; i < USERS; i++) users.push(await registerUser(i));

  const stopAt = Date.now() + MINUTES * 60_000;
  process.on('SIGINT', () => {
    log('\nStopped. Summary:');
    for (const [k, v] of Object.entries(stats).sort()) log(`  ${k}: ${v}`);
    process.exit(0);
  });

  while (Date.now() < stopAt) {
    const a = pick(users);
    const b = pick(users.filter((u) => u.id !== a.id));
    const receiver = target && Math.random() < 0.45 ? target : b;
    const action = pick([
      () => sendMessage(a, receiver),
      () => sendMoney(a, receiver),
      () => order(a),
      () => order(b),
      () => p2p(a, b),
      () => adminPeek(),
    ]);
    await action().catch(() => {});
    await sleep(randomInt(Math.round(PACE_MS * 0.6), Math.round(PACE_MS * 1.5)));
  }

  log('\nSimulation complete. Summary:');
  for (const [k, v] of Object.entries(stats).sort()) log(`  ${k}: ${v}`);
}

main().catch((e) => {
  console.error(`Fatal: ${describeError(e)}`);
  process.exit(1);
}).finally(() => {
  prisma.$disconnect().catch(() => {});
});
