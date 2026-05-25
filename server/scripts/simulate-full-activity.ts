#!/usr/bin/env ts-node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           FORTUNI — FULL PLATFORM ACTIVITY SIMULATOR                ║
 * ║                                                                      ║
 * ║  Simulates realistic end-to-end user activity across every           ║
 * ║  surface of the platform:                                            ║
 * ║                                                                      ║
 * ║  • Auth         — register, login, token refresh                     ║
 * ║  • Wallets      — deposits, withdrawals, swaps                       ║
 * ║  • Orders       — buy and sell crypto                                ║
 * ║  • Transfers    — send between users                                 ║
 * ║  • Cards        — issue, topup, purchases, refunds                   ║
 * ║  • Messages     — DMs between users                                  ║
 * ║  • P2P          — create listings, initiate trades, lifecycle        ║
 * ║  • Groups       — plain chat, goal-based pool, shared wallet pool    ║
 * ║  • Business     — API keys, team invites, bulk pay, payouts          ║
 * ║  • API Keys     — create, list, revoke                               ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   npx ts-node scripts/simulate-full-activity.ts [options]
 *
 * Options:
 *   --users=N        Simulated user pairs (default: 5)
 *   --rounds=N       Activity rounds per user pair (default: 3)
 *   --base=URL       API base URL (default: http://localhost:5001/api)
 *   --verbose        Show full request/response details
 *   --no-cleanup     Skip deleting sim users at the end
 *
 * The script sends `X-Simulator: true` on every request so the server
 * can bypass rate limits for simulation traffic.
 */

/// <reference types="node" />

import axios, { AxiosInstance, AxiosError } from 'axios';
import { randomBytes, randomInt } from 'crypto';

/* ─── CLI args ─────────────────────────────────────────────────────── */

declare const process: NodeJS.Process;

const arg  = (flag: string) => process.argv.find((a) => a.startsWith(`--${flag}=`))?.split('=')[1];
const flag = (name: string) => process.argv.includes(`--${name}`);

const BASE_URL    = arg('base')    ?? process.env.API_URL   ?? 'http://localhost:5000/api';
const N_USERS     = parseInt(arg('users')   ?? '5',  10);
const N_ROUNDS    = parseInt(arg('rounds')  ?? '3',  10);
const VERBOSE     = flag('verbose');
const CLEANUP     = !flag('no-cleanup');
const ADMIN_EMAIL = arg('admin-email') ?? process.env.ADMIN_EMAIL    ?? 'admin@exchange.ly';
const ADMIN_PASS  = arg('admin-pass')  ?? process.env.ADMIN_PASSWORD ?? 'Admin123!@#';

/* ─── Colours ──────────────────────────────────────────────────────── */

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
};

const c = (color: keyof typeof C, s: string) => `${C[color]}${s}${C.reset}`;
const log  = (msg: string) => console.log(msg);
const ok   = (tag: string, msg: string) => log(`  ${c('green','✓')} ${c('cyan', tag.padEnd(16))} ${msg}`);
const fail = (tag: string, msg: string) => log(`  ${c('red',  '✗')} ${c('yellow', tag.padEnd(16))} ${msg}`);
const info = (msg: string)              => log(`  ${c('gray', '·')} ${msg}`);
const head = (msg: string)              => log(`\n${c('bold', c('blue', `── ${msg} ${'─'.repeat(Math.max(0, 52 - msg.length))}`))}`)

/* ─── Stats ────────────────────────────────────────────────────────── */

const stats: Record<string, number> = {};
const track = (k: string) => { stats[k] = (stats[k] ?? 0) + 1; };

/* ─── Helpers ──────────────────────────────────────────────────────── */

const sleep  = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (lo: number, hi: number) => sleep(randomInt(lo, hi));
const pick   = <T>(arr: T[]): T => arr[randomInt(0, arr.length)];
const rndFloat = (lo: number, hi: number, dp = 2) =>
  parseFloat((lo + Math.random() * (hi - lo)).toFixed(dp));
const uid    = () => randomBytes(6).toString('hex');

/* ─── HTTP client factory ──────────────────────────────────────────── */

function makeClient(token?: string): AxiosInstance {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Simulator':  'true',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return axios.create({ baseURL: BASE_URL, headers, timeout: 20_000 });
}

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const r = await fn();
    track(`ok.${label}`);
    return r;
  } catch (e) {
    const err = e as AxiosError<any>;
    const msg = err.response?.data?.error ?? err.response?.data?.message ?? err.message;
    if (VERBOSE) fail(label, msg);
    track(`err.${label}`);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SIMULATED USER
   ═══════════════════════════════════════════════════════════════════ */

interface UserRecord {
  id:       string;
  email:    string;
  username: string;
  token:    string;
  http:     AxiosInstance;
  wallets:  any[];
  cards:    any[];
}

const SIM_PASSWORD = 'SimPass123!@';

const FIRST_NAMES = ['Rayan','Sami','Lina','Omar','Maya','Hassan','Fatima','Khalid','Sara','Ahmed','Nour','Yasmine'];
const LAST_NAMES  = ['AlZabi','Patel','Hassan','AlSaud','Mahmoud','AlMarri','Ibrahim','Qureshi','Ali','Khan'];
const COUNTRIES   = ['AE','SA','EG','GB','US','LY','TN','MA','TR','DE'];
const PHONE_CODES: Record<string, string> = {
  AE: '971', SA: '966', EG: '20', GB: '44', US: '1',
  LY: '218', TN: '216', MA: '212', TR: '90', DE: '49',
};

function randomDOB(): string {
  const start = new Date(1985, 0, 1).getTime();
  const end   = new Date(2000, 11, 31).getTime();
  return new Date(start + Math.random() * (end - start)).toISOString().slice(0, 10);
}

async function registerUser(index: number): Promise<UserRecord | null> {
  const suffix    = `${uid()}`;
  const email     = `sim_${suffix}@fortuni.sim`;
  const username  = `sim_${suffix}`;
  const firstName = pick(FIRST_NAMES);
  const lastName  = pick(LAST_NAMES);
  const country   = pick(COUNTRIES);
  const phoneCode = PHONE_CODES[country] ?? '1';
  const phone     = `${randomInt(600_000_000, 999_999_999)}`;

  const http = makeClient();

  // Register
  const regRes = await safe(`register[${index}]`, () =>
    http.post('/auth/register', {
      email,
      password:         SIM_PASSWORD,
      firstName,
      lastName,
      country,
      username,
      phoneCountryCode: phoneCode,
      phone,
      dateOfBirth:      randomDOB(),
    })
  );
  if (!regRes) return null;

  // Login
  const loginRes = await safe(`login[${index}]`, () =>
    http.post('/auth/login', { email, password: SIM_PASSWORD })
  );
  if (!loginRes) return null;

  const token = (loginRes as any).data?.accessToken;
  if (!token) { fail(`login[${index}]`, 'No token in response'); return null; }

  const authed = makeClient(token);
  const id     = (loginRes as any).data?.user?.id;

  return { id, email, username, token, http: authed, wallets: [], cards: [] };
}

/* Admin client — lazy singleton, logged in on first call */
let _adminHttp: AxiosInstance | null = null;
async function getAdminClient(): Promise<AxiosInstance | null> {
  if (_adminHttp) return _adminHttp;
  const http = makeClient();
  try {
    const res = await http.post('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    const token = res.data?.accessToken;
    if (!token) return null;
    _adminHttp = makeClient(token);
    if (VERBOSE) ok('admin.login', `Logged in as ${ADMIN_EMAIL}`);
    return _adminHttp;
  } catch {
    fail('admin.login', `Could not login as admin (${ADMIN_EMAIL}). Deposits will stay PENDING.`);
    return null;
  }
}

async function adminActivateUser(userId: string): Promise<void> {
  const admin = await getAdminClient();
  if (!admin) return;
  await safe('admin.activate', () =>
    admin.put(`/admin/users/${userId}/status`, { status: 'ACTIVE' })
  );
}

async function adminApproveKYC(userId: string): Promise<void> {
  const admin = await getAdminClient();
  if (!admin) return;
  await safe('admin.kyc', () =>
    admin.put(`/admin/kyc/${userId}/approve`)
  );
}

async function fundUser(user: UserRecord): Promise<void> {
  const admin = await getAdminClient();
  if (!admin) {
    fail('deposit', `No admin client — cannot seed balance for ${user.username}`);
    return;
  }

  // Directly credit wallets via the seed-balance endpoint (dev/staging only)
  const credits: Array<{ currency: string; amount: number }> = [
    { currency: 'USDT', amount: 5000 },
    { currency: 'USD',  amount: 3000 },
  ];

  for (const { currency, amount } of credits) {
    const res = await safe(`deposit.${currency}`, () =>
      admin.post('/admin/seed-balance', { userId: user.id, currency, amount })
    );
    if (res) {
      track('deposit');
      ok('deposit', `${user.username} · ${currency} ${amount}`);
    }
  }

  // Fetch wallets
  const wRes = await safe('wallets.list', () => user.http.get('/wallets'));
  if (wRes) user.wallets = (wRes as any).data?.wallets ?? [];
}

/* ─── Activity suites ──────────────────────────────────────────────── */

/* ① Sending DMs */
async function simulateMessages(sender: UserRecord, receiver: UserRecord) {
  head('Messages');
  const lines = [
    'Hey, how are you?',
    'Did you see the USDT rate today?',
    'I have some USDT to sell if you need',
    'Transfer confirmed 👍',
    'Let me know when you\'re ready',
    'Sending now…',
    'Done! Check your wallet',
    'Thanks man 🙏',
  ];

  for (let i = 0; i < randomInt(3, 6); i++) {
    await jitter(200, 600);
    const content = pick(lines);
    const res = await safe('message.send', () =>
      sender.http.post('/messages', { receiverId: receiver.id, content })
    );
    if (res) { ok('message.send', `"${content.slice(0, 40)}…"`); track('message'); }
  }

  // Mark as read
  await safe('message.read', () => receiver.http.post(`/messages/read/${sender.id}`));
}

/* ② Buy / Sell orders */
async function simulateOrders(user: UserRecord) {
  head('Orders (Buy / Sell)');
  const BUYS  = [50, 100, 200, 500, 1000];
  const SELLS = [20,  50, 100, 250];

  for (const amount of pick([BUYS])) {
    await jitter(300, 800);
    const res = await safe('order.buy', () =>
      user.http.post('/orders', { side: 'BUY', quoteCurrency: 'USD', amount })
    );
    if (res) { ok('order.buy',  `BUY ${amount} USD → USDT`); track('order.buy'); }
  }

  for (const amount of [pick(SELLS)]) {
    await jitter(300, 800);
    const res = await safe('order.sell', () =>
      user.http.post('/orders', { side: 'SELL', quoteCurrency: 'USD', amount })
    );
    if (res) { ok('order.sell', `SELL ${amount} USD ← USDT`); track('order.sell'); }
  }
}

/* ③ Withdrawal */
async function simulateWithdrawal(user: UserRecord) {
  head('Withdrawal');
  // Crypto withdrawal (TRC20)
  const cryptoRes = await safe('withdrawal.crypto', () =>
    user.http.post('/withdrawals', {
      currency:      'USDT',
      amount:        rndFloat(10, 80),
      walletAddress: 'TSimulator' + randomBytes(22).toString('hex').slice(0, 22),
      network:       'TRC20',
    })
  );
  if (cryptoRes) { ok('withdrawal', `USDT ${rndFloat(10, 80)} → TRC20`); track('withdrawal.crypto'); }
}

/* ④ Wallet swap */
async function simulateSwap(user: UserRecord) {
  head('Wallet Swap');
  const pairs = [
    { from: 'USDT', to: 'BTC',  amount: rndFloat(50,  200) },
    { from: 'USDT', to: 'ETH',  amount: rndFloat(100, 500) },
    { from: 'USDT', to: 'SOL',  amount: rndFloat(20,  150) },
    { from: 'BTC',  to: 'USDT', amount: rndFloat(0.001, 0.01, 6) },
  ];
  const pair = pick(pairs);
  const res = await safe('wallet.swap', () =>
    user.http.post('/wallets/swap', pair)
  );
  if (res) { ok('wallet.swap', `${pair.from} → ${pair.to} (${pair.amount})`); track('wallet.swap'); }
}

/* ⑤ Transfer between users */
async function simulateTransfer(sender: UserRecord, receiver: UserRecord) {
  head('Transfer');
  const currencies = ['USDT', 'USDT', 'USDT']; // weight toward USDT
  const currency   = pick(currencies);
  const amount     = rndFloat(5, 50);

  const res = await safe('transfer.send', () =>
    sender.http.post('/transfers/send', {
      recipientUsername: receiver.username,
      currency,
      amount,
      note: pick(['Lunch split', 'Your share', 'Paying back', 'Thanks!', 'Invoice #' + randomInt(100, 999)]),
    })
  );
  if (res) { ok('transfer', `${sender.username} → ${receiver.username} · ${amount} ${currency}`); track('transfer'); }
}

/* ⑥ Cards — issue, topup, purchases, refund */
async function simulateCards(user: UserRecord) {
  head('Cards');

  // Issue a card
  const tiers: Array<'STARTER' | 'MASTER' | 'PRO'> = ['STARTER', 'MASTER', 'PRO'];
  const tier  = pick(tiers);
  const createRes = await safe('card.create', () =>
    user.http.post('/cards', {
      tier,
      nickname: `${user.username}'s ${tier} Card`,
      currency: 'USDT',
    })
  );
  if (!createRes) return;
  const card = (createRes as any).data?.card;
  if (!card) return;
  user.cards.push(card);
  ok('card.create', `${tier} card issued · last4=${card.last4}`);
  track('card.issued');

  // Top up the card
  const topupRes = await safe('card.topup', () =>
    user.http.post(`/cards/${card.id}/topup`, { amount: rndFloat(50, 300), currency: 'USDT' })
  );
  if (topupRes) { ok('card.topup', `$${rndFloat(50, 300)} USDT loaded`); track('card.topup'); }

  // Simulate purchases
  const merchants = [
    { merchant: 'Amazon', category: 'SHOPPING', country: 'US' },
    { merchant: 'Noon.com', category: 'SHOPPING', country: 'AE' },
    { merchant: 'Carrefour UAE', category: 'GROCERY', country: 'AE' },
    { merchant: 'Uber', category: 'TRANSPORT', country: 'AE' },
    { merchant: 'Netflix', category: 'ENTERTAINMENT', country: 'US' },
    { merchant: 'Spotify', category: 'ENTERTAINMENT', country: 'SE' },
    { merchant: 'Deliveroo', category: 'FOOD', country: 'GB' },
    { merchant: 'IKEA', category: 'HOME', country: 'AE' },
    { merchant: 'Apple Store', category: 'ELECTRONICS', country: 'US' },
    { merchant: 'Shell', category: 'FUEL', country: 'AE' },
  ];

  for (let i = 0; i < randomInt(2, 5); i++) {
    await jitter(100, 300);
    const m   = pick(merchants);
    const amt = rndFloat(5, 150);
    const res = await safe('card.purchase', () =>
      user.http.post(`/cards/${card.id}/transactions`, {
        merchant: m.merchant,
        category: m.category,
        country:  m.country,
        amount:   amt,
        type:     'PURCHASE',
        metadata: { orderId: `ORD-${randomInt(10000, 99999)}` },
      })
    );
    if (res) { ok('card.purchase', `${m.merchant} · $${amt}`); track('card.purchase'); }
  }

  // One refund
  await jitter(200, 500);
  const refundRes = await safe('card.refund', () =>
    user.http.post(`/cards/${card.id}/transactions`, {
      merchant: 'Amazon',
      category: 'REFUND',
      country:  'US',
      amount:   rndFloat(5, 30),
      type:     'REFUND',
    })
  );
  if (refundRes) { ok('card.refund', 'Amazon refund processed'); track('card.refund'); }
}

/* ⑦ P2P — listing + trade lifecycle */
async function simulateP2P(seller: UserRecord, buyer: UserRecord) {
  head('P2P Marketplace');

  const fiats  = ['LYD', 'SAR', 'AED', 'EGP', 'USD'];
  const cryptos = ['USDT'];
  const methods = ['Bank Transfer', 'Cash', 'PayPal', 'Wise', 'Western Union'];
  const fiat    = pick(fiats);
  const crypto  = pick(cryptos);
  const price   = rndFloat(4.5, 5.5);
  const amount  = rndFloat(100, 500);

  // Seller creates a SELL listing
  const listRes = await safe('p2p.listing', () =>
    seller.http.post('/p2p/listings', {
      currency:        crypto,
      fiatCurrency:    fiat,
      side:            'SELL',
      price,
      amount,
      minLimit:        amount * price * 0.1,
      maxLimit:        amount * price * 0.9,
      paymentMethods:  [pick(methods), pick(methods)].filter((v, i, a) => a.indexOf(v) === i),
      terms:           'Respond within 10 minutes. Bank transfer preferred.',
      timeframeMins:   30,
    })
  );
  if (!listRes) return;
  const listing = (listRes as any).data?.listing;
  if (!listing) return;
  ok('p2p.listing', `SELL ${amount} ${crypto} @ ${price} ${fiat}`);
  track('p2p.listing');

  await jitter(500, 1000);

  // Buyer initiates a trade
  const tradeAmount = rndFloat(listing.minLimit / price, listing.maxLimit / price);
  const tradeRes = await safe('p2p.trade', () =>
    buyer.http.post('/p2p/trades', {
      listingId:     listing.id,
      amount:        tradeAmount,
      paymentMethod: listing.paymentMethods?.[0] ?? 'Bank Transfer',
      note:          'Ready to pay immediately',
    })
  );
  if (!tradeRes) return;
  const trade = (tradeRes as any).data?.trade;
  if (!trade) return;
  ok('p2p.trade', `Trade initiated · ${tradeAmount.toFixed(4)} ${crypto}`);
  track('p2p.trade');

  await jitter(500, 1000);

  // Buyer marks payment sent
  const paidRes = await safe('p2p.paid', () =>
    buyer.http.put(`/p2p/trades/${trade.id}/payment-sent`)
  );
  if (paidRes) { ok('p2p.paid', 'Buyer marked payment as sent'); track('p2p.paid'); }

  await jitter(500, 1500);

  // Seller confirms receipt
  const confirmRes = await safe('p2p.confirm', () =>
    seller.http.put(`/p2p/trades/${trade.id}/confirm`)
  );
  if (confirmRes) { ok('p2p.confirm', 'Seller confirmed receipt → COMPLETED ✅'); track('p2p.completed'); }
}

/* ⑧ Group chat — plain (no pool) */
async function simulatePlainGroup(members: UserRecord[]) {
  head('Group Chat (plain)');
  const creator = members[0];
  const others  = members.slice(1).map((m) => m.id);

  const grpRes = await safe('group.create', () =>
    creator.http.post('/groups', {
      name:      pick(['Dubai Crypto Gang', 'MENA Traders', 'Sim Users', 'Weekend Crew', 'Test Squad']),
      description: 'Simulator-created group for casual chat',
      memberIds: others,
    })
  );
  if (!grpRes) return;
  const group = (grpRes as any).data?.group;
  if (!group) return;
  ok('group.create', `"${group.name}" (plain, ${members.length} members)`);
  track('group.created');

  // Send a burst of messages
  const chatLines = [
    'gm everyone 🌅',
    'Anyone buying dips today?',
    'USDT rate looks good',
    'Who wants to split a trade?',
    'Just sent 200 USDT — did it arrive?',
    'Yes received, thanks!',
    'Market is wild rn 🚀',
    'Hold strong 💎',
  ];
  for (let i = 0; i < randomInt(4, 8); i++) {
    await jitter(150, 400);
    const sender = pick(members);
    const res = await safe('group.msg', () =>
      sender.http.post(`/groups/${group.id}/messages`, { content: pick(chatLines) })
    );
    if (res) { track('group.message'); }
  }
  ok('group.msg', `${randomInt(4, 8)} messages exchanged`);
}

/* ⑨ Group chat — shared wallet pool */
async function simulateSharedPool(members: UserRecord[]) {
  head('Group Chat (shared wallet pool)');
  const creator = members[0];
  const others  = members.slice(1).map((m) => m.id);

  const grpRes = await safe('group.create.pool', () =>
    creator.http.post('/groups', {
      name:      pick(['Dubai Shared Pool', 'MENA Wallet Pool', 'Team Funds']),
      memberIds: others,
      pool: {
        name: 'Shared Ops Wallet',
        kind: 'SHARED_WALLET',
      },
    })
  );
  if (!grpRes) return;
  const group = (grpRes as any).data?.group;
  if (!group) return;
  ok('group.create', `"${group.name}" (shared wallet pool)`);
  track('group.pooled');

  // Each member deposits
  for (const member of members) {
    await jitter(200, 500);
    const amount = rndFloat(20, 200);
    const depRes = await safe('pool.deposit', () =>
      member.http.post(`/groups/${group.id}/pool/deposit`, {
        currency: 'USDT',
        amount,
        note: `${member.username}'s contribution`,
      })
    );
    if (depRes) { ok('pool.deposit', `${member.username} deposited ${amount} USDT`); track('pool.deposit'); }
  }

  // Group chat activity
  for (let i = 0; i < randomInt(3, 6); i++) {
    await jitter(100, 300);
    const sender = pick(members);
    await safe('group.msg', () =>
      sender.http.post(`/groups/${group.id}/messages`, {
        content: pick([
          'Pool is growing 🏦',
          'Added my share just now',
          'Anyone withdrawing yet?',
          'Let\'s aim for 1K total',
          'Balance looking healthy!',
          '💰',
        ]),
      })
    );
    track('group.message');
  }
  ok('group.msg', 'Pool group chat active');

  // One member withdraws
  await jitter(300, 600);
  const withdrawer = pick(members);
  const wdRes = await safe('pool.withdraw', () =>
    withdrawer.http.post(`/groups/${group.id}/pool/withdraw`, {
      amountUsd: rndFloat(5, 30),
    })
  );
  if (wdRes) { ok('pool.withdraw', `${withdrawer.username} withdrew from pool`); track('pool.withdraw'); }
}

/* ⑩ Group chat — goal-based pool */
async function simulateGoalPool(members: UserRecord[]) {
  head('Group Chat (goal-based pool)');
  const creator = members[0];
  const others  = members.slice(1).map((m) => m.id);
  const target  = rndFloat(500, 2000, 0);
  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const grpRes = await safe('group.create.goal', () =>
    creator.http.post('/groups', {
      name:      pick(['Holiday Fund 🏖️', 'Car Down Payment', 'Equipment Budget', 'Team Trip 2025']),
      memberIds: others,
      pool: {
        name:            pick(['Holiday savings', 'Target fund', 'Save 2025']),
        kind:            'GOAL_BASED',
        targetAmountUsd: target,
        deadline,
      },
    })
  );
  if (!grpRes) return;
  const group = (grpRes as any).data?.group;
  if (!group) return;
  ok('group.create', `"${group.name}" (goal: $${target})`);
  track('group.goal');

  // Members deposit toward the goal
  for (const member of members.slice(0, randomInt(2, members.length + 1))) {
    await jitter(200, 500);
    const amount = rndFloat(20, Math.min(100, target / members.length));
    const depRes = await safe('pool.deposit.goal', () =>
      member.http.post(`/groups/${group.id}/pool/deposit`, {
        currency: 'USDT',
        amount,
      })
    );
    if (depRes) { ok('pool.deposit', `${member.username} → $${amount} toward goal`); track('pool.deposit'); }
  }

  // Chat messages celebrating progress
  const encouragements = [
    `We're ${Math.round(rndFloat(20, 80))}% there! 🎯`,
    'Keep adding!',
    'Almost halfway 💪',
    'Goal incoming 🏁',
    'Added my bit, who\'s next?',
    `Target: $${target} — let's go!`,
  ];
  for (let i = 0; i < randomInt(3, 5); i++) {
    await jitter(150, 350);
    await safe('group.msg', () =>
      pick(members).http.post(`/groups/${group.id}/messages`, { content: pick(encouragements) })
    );
    track('group.message');
  }
  ok('group.msg', 'Goal group chat active');
}

/* ⑪ Business simulation */
async function simulateBusiness(user: UserRecord, teammates: UserRecord[]) {
  head('Business (B2B)');

  // ── API Keys ──────────────────────────────────────────────────────
  const key1 = await safe('biz.apikey.create', () =>
    user.http.post('/api-keys', {
      name:         'Simulator Live Key',
      permissions:  ['read', 'payouts', 'balances'],
      expiresInDays: 90,
    })
  );
  if (key1) { ok('biz.apikey', 'Live key created'); track('biz.apikey'); }

  const key2 = await safe('biz.apikey.create2', () =>
    user.http.post('/api-keys', {
      name:        'Simulator Test Key',
      permissions: ['read'],
    })
  );
  if (key2) {
    ok('biz.apikey', 'Test (read-only) key created');
    // Revoke the test key
    const testKeyId = (key2 as any).data?.key?.id;
    if (testKeyId) {
      await jitter(200, 500);
      await safe('biz.apikey.revoke', () => user.http.delete(`/api-keys/${testKeyId}`));
      ok('biz.apikey.revoke', 'Test key revoked');
      track('biz.apikey.revoke');
    }
  }

  // ── Business group chat (simulating a "business workspace" chat) ──
  head('Business Group Chat');
  if (teammates.length >= 1) {
    const bizGrpRes = await safe('biz.group', () =>
      user.http.post('/groups', {
        name:        'Payments Team — Ops',
        description: 'Internal business operations channel',
        memberIds:   teammates.slice(0, 2).map((t) => t.id),
        // No pool — pure internal comms
      })
    );
    if (bizGrpRes) {
      const bizGroup = (bizGrpRes as any).data?.group;
      if (bizGroup) {
        ok('biz.group', `"${bizGroup.name}" created`);
        track('biz.group');

        const bizLines = [
          'Batch payout sent — please verify on dashboard',
          'API key rotated, updated in Vault ✅',
          'KYB approved 🎉 full limits now active',
          'Q4 volume report ready for review',
          'Webhook endpoint updated to v2',
          'Support escalated — trade ID #SIM-' + randomInt(1000, 9999),
          'New team member invite sent to finance@company.com',
          'Rate alert: USDT/LYD crossed 4.9',
        ];
        for (let i = 0; i < randomInt(4, 8); i++) {
          await jitter(100, 300);
          const sender = pick([user, ...teammates.slice(0, 2)]);
          await safe('biz.group.msg', () =>
            sender.http.post(`/groups/${bizGroup.id}/messages`, { content: pick(bizLines) })
          );
          track('group.message');
        }
        ok('biz.group.msg', 'Business chat messages sent');
      }
    }
  }

  // ── Business group with shared wallet (treasury) ──────────────────
  head('Business Treasury Pool');
  if (teammates.length >= 1) {
    const treasuryRes = await safe('biz.treasury', () =>
      user.http.post('/groups', {
        name:      'Company Treasury',
        memberIds: teammates.slice(0, Math.min(2, teammates.length)).map((t) => t.id),
        pool: {
          name: 'Operations Wallet',
          kind: 'SHARED_WALLET',
        },
      })
    );
    if (treasuryRes) {
      const treasury = (treasuryRes as any).data?.group;
      if (treasury) {
        ok('biz.treasury', '"Company Treasury" pool created');
        track('biz.treasury');

        // Deposit operations funds
        const bizDeposit = await safe('biz.treasury.deposit', () =>
          user.http.post(`/groups/${treasury.id}/pool/deposit`, {
            currency: 'USDT',
            amount:   rndFloat(200, 1000),
            note:     'Q4 ops budget',
          })
        );
        if (bizDeposit) { ok('biz.treasury.deposit', 'Ops budget funded'); track('pool.deposit'); }
      }
    }
  }

  // ── Simulated bulk pay (via standard transfers to teammates) ──────
  head('Business Bulk Pay (simulated)');
  const payees = teammates.slice(0, Math.min(3, teammates.length));
  for (const payee of payees) {
    await jitter(200, 400);
    const amount = rndFloat(10, 100);
    const txRes = await safe('biz.bulkpay', () =>
      user.http.post('/transfers/send', {
        recipientUsername: payee.username,
        currency:          'USDT',
        amount,
        note:              `Salary batch - ${new Date().toISOString().slice(0, 7)}`,
      })
    );
    if (txRes) { ok('biz.bulkpay', `→ ${payee.username} · USDT ${amount}`); track('biz.bulkpay'); }
  }
}

/* ─── User scenario loop ───────────────────────────────────────────── */

async function runUserPair(index: number, allUsers: UserRecord[]) {
  log(`\n${c('bold', c('magenta', `━━━ User Pair ${index + 1} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`))}`)

  const a = allUsers[index * 2 % allUsers.length];
  const b = allUsers[(index * 2 + 1) % allUsers.length];
  const bystanders = allUsers.filter((u) => u.id !== a.id && u.id !== b.id).slice(0, 2);

  log(`  ${c('cyan', a.username)} ↔ ${c('cyan', b.username)}`);

  for (let round = 0; round < N_ROUNDS; round++) {
    log(`\n  ${c('gray', `Round ${round + 1}/${N_ROUNDS}`)}`);

    // Pick random activities to simulate this round
    const round_tasks: Array<() => Promise<void>> = [
      () => simulateMessages(a, b),
      () => simulateMessages(b, a),
      () => simulateOrders(a),
      () => simulateOrders(b),
      () => simulateWithdrawal(a),
      () => simulateSwap(a),
      () => simulateSwap(b),
      () => simulateTransfer(a, b),
      () => simulateTransfer(b, a),
      () => simulateCards(a),
      () => simulateCards(b),
      () => simulateP2P(a, b),
      () => simulatePlainGroup([a, b, ...bystanders]),
      () => simulateSharedPool([a, b, ...bystanders]),
      () => simulateGoalPool([a, b, ...bystanders]),
      () => simulateBusiness(a, [b, ...bystanders]),
    ];

    // Shuffle and run a random subset
    const selected = round_tasks
      .sort(() => Math.random() - 0.5)
      .slice(0, randomInt(4, Math.min(8, round_tasks.length)));

    for (const task of selected) {
      await task().catch(() => {});
      await jitter(200, 800);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════════════ */

async function main() {
  const startTime = Date.now();

  log(`\n${c('bold', '═'.repeat(62))}`);
  log(`${c('bold', c('cyan', '  FORTUNI — FULL PLATFORM ACTIVITY SIMULATOR'))}`);
  log(`${c('bold', '═'.repeat(62))}`);
  log(`  ${c('gray', 'API:')}     ${BASE_URL}`);
  log(`  ${c('gray', 'Users:')}   ${N_USERS * 2} (${N_USERS} pairs)`);
  log(`  ${c('gray', 'Rounds:')}  ${N_ROUNDS} per pair`);
  log(`  ${c('gray', 'Verbose:')} ${VERBOSE}`);
  log(`${c('bold', '═'.repeat(62))}\n`);

  /* ── Create users ──────────────────────────────────────────────── */
  head('Creating simulated users');
  const allUsers: UserRecord[] = [];

  for (let i = 0; i < N_USERS * 2; i++) {
    const user = await registerUser(i);
    if (user) {
      allUsers.push(user);
      ok('register', `${user.username} (${user.email})`);
    }
    await jitter(100, 300);
  }

  if (allUsers.length < 2) {
    log(c('red', '\n  ✗ Not enough users registered. Check server logs.\n'));
    process.exit(1);
  }
  log(`\n  ${c('green', `✓ ${allUsers.length} users ready`)}\n`);

  /* ── Activate users + approve KYC (required for transfers/cards/P2P) */
  head('Activating users & approving KYC');
  for (const user of allUsers) {
    if (user.id) {
      await adminActivateUser(user.id);
      await adminApproveKYC(user.id);
    }
    await jitter(50, 150);
  }

  /* ── Fund users ────────────────────────────────────────────────── */
  head('Seeding wallets');
  for (const user of allUsers) {
    await fundUser(user);
    await jitter(100, 250);
  }

  /* ── Run activity rounds ───────────────────────────────────────── */
  head('Running activity simulation');
  for (let i = 0; i < N_USERS; i++) {
    await runUserPair(i, allUsers);
  }

  /* ── Print summary ─────────────────────────────────────────────── */
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  log(`\n${c('bold', '═'.repeat(62))}`);
  log(`${c('bold', c('green', '  SIMULATION COMPLETE'))}`);
  log(`${c('bold', '═'.repeat(62))}`);
  log(`  ${c('gray', 'Elapsed:')} ${elapsed}s`);
  log(`  ${c('gray', 'Users created:')} ${allUsers.length}`);
  log('');

  const groups: Record<string, Record<string, number>> = {};
  for (const [k, v] of Object.entries(stats)) {
    const [ns, ...rest] = k.split('.');
    if (!groups[ns]) groups[ns] = {};
    groups[ns][rest.join('.')] = v;
  }

  const icons: Record<string, string> = {
    ok: '✓', err: '✗', deposit: '💰', withdrawal: '📤', transfer: '📨',
    order: '📊', card: '💳', message: '💬', group: '👥', pool: '🏦',
    p2p: '🔄', wallet: '💱', biz: '🏢',
  };

  for (const [ns, counts] of Object.entries(groups).sort()) {
    const icon = icons[ns] ?? '•';
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    log(`  ${icon} ${c('cyan', ns.padEnd(14))} ${c('bold', String(total).padStart(4))}  ${
      c('gray', Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' · '))
    }`);
  }

  log(`${c('bold', '═'.repeat(62))}\n`);
}

main().catch((e) => {
  console.error(c('red', `\n✗ Fatal: ${e.message}\n`));
  if (VERBOSE) console.error(e);
  process.exit(1);
});
