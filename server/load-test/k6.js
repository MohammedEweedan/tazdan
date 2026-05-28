/**
 * k6 Load Test — Fortuni Platform
 *
 * Architecture: pre-seed users in setup(), then VUs only login + trade.
 * This avoids hammering bcrypt/wallet-derivation on every VU iteration
 * (which crashed the server when 500 VUs all registered simultaneously).
 *
 * Flow:
 *   setup()  — admin login → register POOL_SIZE users → activate + fund all
 *   VUs      — pick a user from the pool → login → orders/reads/P2P → logout
 *   teardown — call /admin/backfill-fees so all orders appear on the dashboard
 *
 * Stages (single Node.js process — tuned to not OOM):
 *   Ramp    0 → 50 VUs  (1 min)   warm-up
 *   Hold    50 VUs      (3 min)   steady state
 *   Spike   50 → 150    (1 min)   peak burst
 *   Hold    150 VUs     (3 min)   sustained peak
 *   Cool    150 → 0     (1 min)   ramp-down
 *
 * 150 VUs × ~67 implied users/VU ≈ 10 k simultaneous sessions.
 * Scale up POOL_SIZE and VU targets when running against a clustered backend.
 *
 * Usage:
 *   k6 run server/load-test/k6.js
 *   k6 run --env BASE_URL=http://10.0.0.5:5000/api server/load-test/k6.js
 *   k6 run --env POOL_SIZE=200 server/load-test/k6.js
 *
 * Install: brew install k6
 */

import http from 'k6/http';
import { check, group, sleep, fail } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

/* ── Config ──────────────────────────────────────────────────────── */
const BASE           = __ENV.BASE_URL        || 'http://localhost:5000/api';
const ADMIN_EMAIL    = __ENV.ADMIN_EMAIL     || 'admin@exchange.ly';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD  || 'Admin123!@#';
const POOL_SIZE      = parseInt(__ENV.POOL_SIZE || '30', 10);   // users pre-seeded in setup()
const USER_PASSWORD  = 'LoadTest1!@';

/* ── Custom metrics ─────────────────────────────────────────────── */
const authFailures      = new Counter('auth_failures');
const orderErrors       = new Counter('order_errors');
const p2pErrors         = new Counter('p2p_errors');
const orderLatency      = new Trend('order_latency_ms',       true);
const walletReadLatency = new Trend('wallet_read_latency_ms', true);
const loginLatency      = new Trend('login_latency_ms',       true);
const errorRate         = new Rate('error_rate');

/* ── Scenario stages ────────────────────────────────────────────── */
export const options = {
  setupTimeout: '180s',  // seeding users is slow (bcrypt); default 60s is too tight
  stages: [
    { duration: '1m',  target: 10  },   // warm-up
    { duration: '3m',  target: 10  },   // steady state
    { duration: '1m',  target: 25  },   // spike
    { duration: '3m',  target: 25  },   // peak
    { duration: '1m',  target: 0   },   // ramp-down
  ],

  thresholds: {
    http_req_duration:        ['p(95)<800',  'p(99)<2000'],
    order_latency_ms:         ['p(95)<1200', 'p(99)<4000'],
    wallet_read_latency_ms:   ['p(95)<400',  'p(99)<1200'],
    login_latency_ms:         ['p(95)<600',  'p(99)<1500'],
    error_rate:               ['rate<0.05'],  // 5% tolerance — login may fail for pool users that weren't seeded
    http_req_failed:          ['rate<0.05'],
  },
};

/* ── Helpers ─────────────────────────────────────────────────────── */
const JSON_HEADERS = { 'Content-Type': 'application/json' };
// Signals the server's rate-limiter skip() to bypass limits during setup.
// Honoured only in non-production (NODE_ENV !== 'production').
const SIM_HEADERS  = { 'Content-Type': 'application/json', 'x-simulator': 'true' };

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-simulator': 'true' };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ok(res, name) {
  const passed = check(res, {
    [`${name} 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!passed);
  return passed;
}

/* ── setup(): register + activate + fund all pool users ─────────── */
export function setup() {
  // 1. Admin login
  const adminLoginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: SIM_HEADERS, timeout: '30s' },
  );
  if (adminLoginRes.status !== 200) {
    fail(`Admin login failed (${adminLoginRes.status}): ${adminLoginRes.body}`);
  }
  const adminToken = adminLoginRes.json('accessToken');
  const ah = authHeaders(adminToken);
  console.log(`✓ Admin logged in`);

  // 2. Register POOL_SIZE users, activate + fund each
  const users = [];
  const ts = Date.now();

  for (let i = 0; i < POOL_SIZE; i++) {
    const email    = `lt_${ts}_${i}@Fortuni.test`;
    const username = `lt${ts}${i}`.slice(0, 30);

    const regRes = http.post(`${BASE}/auth/register`, JSON.stringify({
      email,
      password:         USER_PASSWORD,
      firstName:        'Load',
      lastName:         `User${i}`,
      username,
      country:          randomChoice(['US', 'AE', 'SA', 'GB', 'DE']),
      phoneCountryCode: randomChoice(['1', '971', '966', '44', '49']),
      phone:            String(Math.floor(Math.random() * 8_000_000_000) + i + 1),
      dateOfBirth:      '1990-06-15',
    }), { headers: SIM_HEADERS, timeout: '30s' });

    if (regRes.status !== 201) {
      console.warn(`  [setup] register failed for user ${i}: ${regRes.status} ${regRes.body}`);
      continue;
    }

    const userId = regRes.json('user.id');
    if (!userId) continue;

    // Activate + approve KYC + seed balances (parallel batch)
    const simAh = Object.assign({}, ah, { 'x-simulator': 'true' });
    const batch = [
      ['PUT',  `${BASE}/admin/users/${userId}/status`,   JSON.stringify({ status: 'ACTIVE' }),                          simAh],
      ['PUT',  `${BASE}/admin/kyc/${userId}/approve`,    null,                                                           simAh],
      ['POST', `${BASE}/admin/seed-balance`,             JSON.stringify({ userId, currency: 'USDT', amount: 50000 }),   simAh],
      ['POST', `${BASE}/admin/seed-balance`,             JSON.stringify({ userId, currency: 'USD',  amount: 25000 }),   simAh],
    ];
    http.batch(batch.map(([method, url, body, headers]) => ({
      method, url, body, params: { headers, timeout: '15s' },
    })));

    users.push({ email, password: USER_PASSWORD, userId });

    if ((i + 1) % 10 === 0) {
      console.log(`  [setup] seeded ${i + 1}/${POOL_SIZE} users`);
      sleep(0.3); // brief pause every 10 to avoid overwhelming bcrypt queue
    }
  }

  console.log(`✓ Pool ready: ${users.length} users seeded`);
  return { users, adminToken };
}

/* ── Persona definitions ─────────────────────────────────────────
 *
 *  ghost       — signed up once, never came back. Just reads the dashboard
 *                and maybe checks balances. No orders. 15% of traffic.
 *
 *  student     — gets 1–2k USD from parents roughly once a month, converts
 *                some to crypto for savings, reads a lot more than trades.
 *                Small buy every few sessions. 25% of traffic.
 *
 *  casual      — buys/sells occasionally ($25–$500), checks prices often,
 *                uses P2P once in a while. Mid think-time. 25% of traffic.
 *
 *  trader      — active. Multiple orders per session ($100–$5k), watches
 *                market tickers, uses both BUY/SELL frequently, checks
 *                trade history every session. 20% of traffic.
 *
 *  power       — power trader. Many orders per session ($1k–$20k), uses
 *                swaps heavily, reads orderbook + activities constantly,
 *                short think-time. 10% of traffic.
 *
 *  whale       — $100k–$1m+ single transfers/orders, low frequency,
 *                checks wallet first, long deliberate pauses between
 *                actions, only top-of-book. 5% of traffic.
 * ──────────────────────────────────────────────────────────────── */

const PERSONAS = ['ghost', 'student', 'casual', 'trader', 'power', 'whale'];
// Cumulative weights matching the % above
const PERSONA_WEIGHTS = [0.15, 0.40, 0.65, 0.85, 0.95, 1.00];

function pickPersona() {
  const r = Math.random();
  for (let i = 0; i < PERSONA_WEIGHTS.length; i++) {
    if (r < PERSONA_WEIGHTS[i]) return PERSONAS[i];
  }
  return 'casual';
}

/* ── Shared session helpers ──────────────────────────────────────── */
function doLogin(user) {
  const t0 = Date.now();
  const res = http.post(`${BASE}/auth/login`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: SIM_HEADERS, timeout: '15s' },
  );
  loginLatency.add(Date.now() - t0);
  if (!ok(res, 'login')) { authFailures.add(1); return null; }
  return res.json('accessToken');
}

function doWalletRead(h) {
  const t0 = Date.now();
  const r = http.get(`${BASE}/wallets`, { headers: h, timeout: '10s' });
  walletReadLatency.add(Date.now() - t0);
  ok(r, 'wallets');
}

function doTicker(h) {
  ok(http.get(`${BASE}/markets/ticker`, { headers: h, timeout: '10s' }), 'ticker');
}

function doOrder(h, side, amount) {
  const t0 = Date.now();
  const r = http.post(`${BASE}/orders`, JSON.stringify({
    side, quoteCurrency: 'USD', amount,
  }), { headers: h, timeout: '20s' });
  orderLatency.add(Date.now() - t0);
  if (!ok(r, `order_${side.toLowerCase()}`)) orderErrors.add(1);
}

function doSwap(h, amount) {
  const r = http.post(`${BASE}/wallets/swap`, JSON.stringify({
    from: 'USDT', to: randomChoice(['BTC', 'ETH', 'SOL']),
    amount,
  }), { headers: h, timeout: '20s' });
  ok(r, 'swap');
}

function doP2PListing(h, amount) {
  const r = http.post(`${BASE}/p2p/listings`, JSON.stringify({
    side: randomChoice(['BUY', 'SELL']),
    currency: 'USDT',
    fiatCurrency: randomChoice(['USD', 'AED', 'SAR', 'GBP', 'EUR']),
    price:   parseFloat((1 + (Math.random() * 0.06 - 0.03)).toFixed(4)),
    amount,
    minLimit: Math.floor(amount * 0.1),
    maxLimit: amount,
    paymentMethods: randomChoice([['BANK_TRANSFER'], ['CASH'], ['BANK_TRANSFER', 'CASH']]),
  }), { headers: h, timeout: '15s' });
  if (!ok(r, 'p2p_listing')) p2pErrors.add(1);
}

function doReads(h) {
  http.batch([
    { method: 'GET', url: `${BASE}/activities?page=1&limit=20`, params: { headers: h, timeout: '10s' } },
    { method: 'GET', url: `${BASE}/notifications`,              params: { headers: h, timeout: '10s' } },
  ]).forEach((r, i) => ok(r, i === 0 ? 'activities' : 'notifications'));
}

function doHistory(h) {
  ok(http.get(`${BASE}/orders?page=1&limit=20`, { headers: h, timeout: '15s' }), 'orders_hist');
}

/* ── VU loop ─────────────────────────────────────────────────────── */
export default function main(data) {
  const { users } = data;
  if (!users || users.length === 0) { sleep(1); return; }

  const user    = users[(__VU - 1 + __ITER) % users.length];
  const persona = pickPersona();

  /* ────────────────────────────────────────────────────────────────
   * GHOST — opened the app once, poked around, never came back.
   * Just reads, no trades. Long think-time, single session.
   * ──────────────────────────────────────────────────────────────── */
  if (persona === 'ghost') {
    group('ghost', () => {
      const token = doLogin(user);
      if (!token) return;
      const h = authHeaders(token);
      sleep(randomInt(1, 3));          // deliberate pause — they're confused
      doWalletRead(h);
      sleep(randomInt(2, 5));           // long read time
      ok(http.get(`${BASE}/auth/me`, { headers: h, timeout: '10s' }), 'profile');
      sleep(randomInt(1, 3));
      doTicker(h);
      // 70% of ghosts just leave after looking — no order ever
      if (Math.random() < 0.30) {
        // rare: ghost places a tiny curious buy then immediately checks history
        doOrder(h, 'BUY', randomChoice([5, 10, 15]));
        sleep(randomInt(2, 5));
        doHistory(h);
      }
    });
    sleep(randomInt(3, 8));             // ghost: infrequent but not blocking
    return;
  }

  /* ────────────────────────────────────────────────────────────────
   * STUDENT — gets $1k–$2k from parents monthly. Converts a slice
   * to crypto for long-term savings. Mostly reads, checks prices,
   * places one small BUY per session, rarely sells.
   * ──────────────────────────────────────────────────────────────── */
  if (persona === 'student') {
    group('student', () => {
      const token = doLogin(user);
      if (!token) return;
      const h = authHeaders(token);

      doWalletRead(h);
      sleep(randomInt(3, 8));
      doTicker(h);
      sleep(randomInt(4, 12));         // reading, deciding

      const roll = Math.random();
      if (roll < 0.55) {
        // 55% — small savings buy ($20–$200)
        doOrder(h, 'BUY', randomChoice([20, 30, 50, 75, 100, 150, 200]));
      } else if (roll < 0.70) {
        // 15% — emergency: sell a little to cover expenses
        doOrder(h, 'SELL', randomChoice([20, 40, 60, 100]));
      } else if (roll < 0.80) {
        // 10% — swap to diversify (ETH → BTC)
        doSwap(h, randomChoice([25, 50, 75]));
      } else {
        // 20% — just reads, no trade this session
        doReads(h);
      }

      sleep(randomInt(2, 5));
      doHistory(h);                    // students always check their balance
    });
    sleep(randomInt(2, 5));
    return;
  }

  /* ────────────────────────────────────────────────────────────────
   * CASUAL — buys/sells occasionally, $25–$500 range.
   * Uses the app a few times a week. Moderate think-time.
   * ──────────────────────────────────────────────────────────────── */
  if (persona === 'casual') {
    group('casual', () => {
      const token = doLogin(user);
      if (!token) return;
      const h = authHeaders(token);

      doWalletRead(h);
      sleep(randomInt(1, 4));
      doTicker(h);
      sleep(randomInt(2, 6));

      const roll = Math.random();
      if (roll < 0.35) {
        doOrder(h, 'BUY', randomChoice([25, 50, 75, 100, 200, 300, 500]));
      } else if (roll < 0.55) {
        doOrder(h, 'SELL', randomChoice([25, 50, 100, 200]));
      } else if (roll < 0.65) {
        doSwap(h, randomChoice([25, 50, 100, 150]));
      } else if (roll < 0.75) {
        doP2PListing(h, randomChoice([50, 100, 200, 300]));
      } else if (roll < 0.85) {
        doReads(h);
      } else {
        doHistory(h);
      }

      sleep(randomInt(1, 2));
    });
    sleep(randomInt(1, 3));
    return;
  }

  /* ────────────────────────────────────────────────────────────────
   * TRADER — active daily user. Multiple orders per session,
   * $100–$5k range. Watches tickers constantly. Checks history.
   * Profit/loss driven — buys dips, sells pumps.
   * ──────────────────────────────────────────────────────────────── */
  if (persona === 'trader') {
    group('trader', () => {
      const token = doLogin(user);
      if (!token) return;
      const h = authHeaders(token);

      doWalletRead(h);
      sleep(randomInt(1, 2));
      doTicker(h);
      sleep(0.5);

      // Traders place 2–4 orders per session
      const numOrders = randomInt(2, 4);
      for (let i = 0; i < numOrders; i++) {
        const side   = Math.random() < 0.55 ? 'BUY' : 'SELL'; // slight buy bias
        const amount = randomChoice([100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000]);
        doOrder(h, side, amount);
        sleep(randomInt(1, 3));        // quick between orders
        doTicker(h);                   // re-check price after each trade
        sleep(0.5);
      }

      // 40% chance: also post a P2P listing for arbitrage
      if (Math.random() < 0.40) {
        doP2PListing(h, randomChoice([200, 500, 1000, 2000]));
        sleep(1);
      }

      // 60% chance: swap between chains to rebalance
      if (Math.random() < 0.60) {
        doSwap(h, randomChoice([100, 250, 500, 1000]));
        sleep(1);
      }

      doHistory(h);
      sleep(1);
      doReads(h);
    });
    sleep(randomInt(1, 2));
    return;
  }

  /* ────────────────────────────────────────────────────────────────
   * POWER TRADER — professional. Many orders per session, $1k–$20k.
   * Heavy on swaps and P2P. Short think-time. Very active.
   * ──────────────────────────────────────────────────────────────── */
  if (persona === 'power') {
    group('power_trader', () => {
      const token = doLogin(user);
      if (!token) return;
      const h = authHeaders(token);

      doWalletRead(h);
      sleep(0.3);
      doTicker(h);

      // 4–7 orders per session
      const numOrders = randomInt(4, 7);
      for (let i = 0; i < numOrders; i++) {
        const side   = Math.random() < 0.50 ? 'BUY' : 'SELL';
        const amount = randomChoice([1000, 2000, 3000, 5000, 7500, 10000, 15000, 20000]);
        doOrder(h, side, amount);
        sleep(randomInt(1, 2));
        if (i % 2 === 0) doTicker(h); // check price every other trade
      }

      // Power traders almost always swap
      const numSwaps = randomInt(1, 3);
      for (let i = 0; i < numSwaps; i++) {
        doSwap(h, randomChoice([500, 1000, 2000, 5000]));
        sleep(0.5);
      }

      // Frequent P2P for arbitrage
      if (Math.random() < 0.65) {
        doP2PListing(h, randomChoice([1000, 2000, 5000, 10000]));
      }

      doHistory(h);
      sleep(0.5);
      doReads(h);
    });
    sleep(1);
    return;
  }

  /* ────────────────────────────────────────────────────────────────
   * WHALE — $100k–$1m+ single moves. Low frequency, deliberate.
   * Checks wallet carefully first. Long pauses. Maximum amounts.
   * Generates the biggest individual fee events on the platform.
   * ──────────────────────────────────────────────────────────────── */
  group('whale', () => {
    const token = doLogin(user);
    if (!token) return;
    const h = authHeaders(token);

    // Whales study everything before moving
    doWalletRead(h);
    sleep(randomInt(2, 4));            // careful review
    doTicker(h);
    sleep(randomInt(1, 3));

    ok(http.get(`${BASE}/auth/me`, { headers: h, timeout: '10s' }), 'profile');
    sleep(randomInt(1, 3));

    const roll = Math.random();
    if (roll < 0.50) {
      // 50% — single massive BUY
      const amount = randomChoice([100000, 150000, 250000, 500000, 750000, 1000000]);
      doOrder(h, 'BUY', amount);
      sleep(randomInt(2, 5));          // post-trade reflection
    } else if (roll < 0.75) {
      // 25% — massive SELL (taking profit)
      const amount = randomChoice([100000, 200000, 500000, 750000]);
      doOrder(h, 'SELL', amount);
      sleep(randomInt(2, 4));
    } else if (roll < 0.88) {
      // 13% — large swap to rebalance portfolio
      doSwap(h, randomChoice([50000, 100000, 200000, 500000]));
      sleep(randomInt(1, 3));
    } else {
      // 12% — large P2P OTC listing
      doP2PListing(h, randomChoice([100000, 250000, 500000]));
      sleep(randomInt(2, 4));
    }

    doHistory(h);
    sleep(randomInt(2, 5));
    doReads(h);
  });
  sleep(randomInt(3, 8));              // whales are infrequent
}

/* ── teardown: backfill fees → all orders visible on admin portal ── */
export function teardown(data) {
  if (!data.adminToken) return;
  console.log('Backfilling platform fees from orders…');
  const ah = Object.assign({}, authHeaders(data.adminToken), { 'x-simulator': 'true' });
  const r = http.post(
    `${BASE}/admin/backfill-fees`,
    null,
    { headers: ah, timeout: '60s' },
  );
  if (r.status === 200) {
    const body = r.json();
    console.log(`✓ Backfill complete: ${JSON.stringify(body)}`);
  } else {
    console.warn(`Backfill responded ${r.status}: ${r.body}`);
  }
  console.log('Load test complete. Open the admin portal to see fees, volume, and user counts.');
}
