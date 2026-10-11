// Fictional, illustrative persona for tazdan marketing captures.
// Everything here is invented: names, handles, amounts, references, addresses.
// No real people, bank accounts, IBANs or card numbers.
import fs from 'fs';
const BASE = new URL('./base/', import.meta.url).pathname;
const readBase = (f) => { try { return JSON.parse(fs.readFileSync(BASE + f, 'utf8')); } catch { return null; } };
const BASE_TICKERS = readBase('markets_ticker.json')?.tickers ?? [];
const BASE_ICONS = readBase('markets_icons.json') ?? { icons: {} };
const BASE_COUNTRIES = readBase('countries.json') ?? { countries: [] };
const BASE_RATES = readBase('rates.json')?.rates ?? { USD: 1 };

// ── deterministic helpers ───────────────────────────────────────────────
function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
/** Smooth, natural-looking series of n points from ~end/(1+chg) to end.
 *  Sum of a few seeded sines (tapered at both ends) + fine texture. */
function walk(key, n, end, chgPct = 0, vol = 0.006) {
  const r = prng(hash(key));
  const comps = [0, 1, 2, 3, 4].map((i) => ({ f: (0.6 + r() * 1.4) * (i + 1), ph: r() * Math.PI * 2, a: 1 / (i + 1) ** 1.1 }));
  const start = end / (1 + chgPct / 100);
  const amp = Math.abs(end) * vol * 2.2;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const x = n > 1 ? i / (n - 1) : 1;
    let w = 0; for (const c of comps) w += c.a * Math.sin(c.f * x * Math.PI * 2 + c.ph);
    const taper = Math.min(1, Math.sin(Math.PI * x) * 1.6);
    const texture = (r() - 0.5) * amp * 0.12;
    pts.push(start + (end - start) * (x * x * (3 - 2 * x)) + amp * 0.5 * w * taper + texture * taper);
  }
  pts[n - 1] = end;
  return pts;
}
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const NOW = Date.now();
const ago = (ms) => new Date(NOW - ms).toISOString();
// A wall-clock time in Tripoli (UTC+2) `d` days ago.
function dayAt(d, hh, mm = 0) {
  const tripoliNow = new Date(NOW + 2 * HOUR);
  const y = tripoliNow.getUTCFullYear(), m = tripoliNow.getUTCMonth(), day = tripoliNow.getUTCDate();
  return new Date(Date.UTC(y, m, day - d, hh - 2, mm)).toISOString();
}
const inFuture = (ms) => new Date(NOW + ms).toISOString();
const r2 = (n) => Math.round(n * 100) / 100;

// ── market data ─────────────────────────────────────────────────────────
export const PRICES = {
  BTC: { price: 98420.15, chg: 2.14, name: 'Bitcoin', cg: 'bitcoin' },
  ETH: { price: 3612.4, chg: 1.38, name: 'Ethereum', cg: 'ethereum' },
  SOL: { price: 186.72, chg: 3.05, name: 'Solana', cg: 'solana' },
  BNB: { price: 712.3, chg: -0.42, name: 'BNB', cg: 'binancecoin' },
  XRP: { price: 2.41, chg: 0.86, name: 'XRP', cg: 'ripple' },
  ADA: { price: 0.92, chg: -1.12, name: 'Cardano', cg: 'cardano' },
  DOGE: { price: 0.318, chg: 4.21, name: 'Dogecoin', cg: 'dogecoin' },
  MATIC: { price: 0.58, chg: -0.65, name: 'Polygon', cg: 'matic-network' },
  DOT: { price: 7.84, chg: 0.31, name: 'Polkadot', cg: 'polkadot' },
  AVAX: { price: 38.9, chg: 1.94, name: 'Avalanche', cg: 'avalanche-2' },
  USDT: { price: 1, chg: 0.01, name: 'Tether', cg: 'tether' },
};
const SUPPLY = { BTC: 19.86e6, ETH: 120.7e6, SOL: 512e6, BNB: 141e6, XRP: 59e9, ADA: 35.9e9, DOGE: 149e9, MATIC: 9.3e9, DOT: 1.5e9, AVAX: 409e6, USDT: 168e9 };
const CG_TO_SYM = Object.fromEntries(Object.entries(PRICES).map(([s, v]) => [v.cg, s]));
// Units per USD (LYD = parallel-market rate).
export const FX = { USD: 1, LYD: 7.12, EUR: 0.862, GBP: 0.746, TRY: 41.6, EGP: 48.4, AED: 3.6725, SAR: 3.75, TND: 2.93, CAD: 1.38, CHF: 0.8, JPY: 149.2, CNY: 7.12 };
const FX_CHG = { LYD: 0.42, EUR: 0.18, GBP: -0.11, TRY: -0.09, EGP: 0.05, TND: 0.12, AED: 0, SAR: 0 };

function tickers() {
  return Object.entries(PRICES).map(([base, v]) => {
    const b = BASE_TICKERS.find((t) => t.base === base) ?? {};
    return {
      symbol: `${base}USDT`, base, quote: 'USDT', displayName: b.displayName ?? v.name,
      price: v.price, changePct24h: v.chg, volume24h: Math.round(v.price * 1e6 * (base === 'BTC' ? 300 : 40)),
      sparkline: walk('spark' + base, 24, v.price, v.chg, base === 'USDT' ? 0.0002 : 0.006).map((x) => +x.toFixed(6)),
      iconUrl: b.iconUrl || BASE_ICONS.icons?.[base] || undefined,
    };
  });
}

export function handleExternal(url) {
  const u = new URL(url);
  if (u.hostname === 'api.binance.com') {
    if (u.pathname.includes('/ticker/24hr')) {
      let syms = [];
      try { syms = JSON.parse(u.searchParams.get('symbols') || '[]'); } catch { syms = (u.searchParams.get('symbols') || '').split(','); }
      if (!syms.length && u.searchParams.get('symbol')) syms = [u.searchParams.get('symbol')];
      const rows = syms.map((s) => {
        const base = String(s).toUpperCase().replace('USDT', '');
        const v = PRICES[base]; if (!v) return null;
        return { symbol: `${base}USDT`, lastPrice: String(v.price), priceChangePercent: String(v.chg), highPrice: String(v.price * 1.021), lowPrice: String(v.price * 0.978), openPrice: String(v.price / (1 + v.chg / 100)), quoteVolume: String(v.price * 4e6), volume: '1000' };
      }).filter(Boolean);
      return u.searchParams.get('symbol') && rows.length === 1 ? rows[0] : rows;
    }
    if (u.pathname.includes('/klines')) {
      const base = (u.searchParams.get('symbol') || 'BTCUSDT').replace('USDT', '');
      const v = PRICES[base] ?? PRICES.BTC; const n = 120;
      return walk('kl' + base, n, v.price, v.chg).map((c, i) => [NOW - (n - i) * HOUR, String(c * 0.998), String(c * 1.004), String(c * 0.995), String(c), '100', NOW - (n - i - 1) * HOUR, '0', 0, '0', '0', '0']);
    }
    if (u.pathname.includes('/ticker/price')) return Object.entries(PRICES).map(([b, v]) => ({ symbol: `${b}USDT`, price: String(v.price) }));
    return [];
  }
  // CoinGecko
  if (u.pathname.endsWith('/coins/markets')) {
    const ids = (u.searchParams.get('ids') || '').split(',').filter(Boolean);
    return ids.map((id) => {
      const sym = CG_TO_SYM[id]; if (!sym) return null; const v = PRICES[sym];
      return {
        id, symbol: sym.toLowerCase(), name: v.name, image: BASE_ICONS.icons?.[sym], current_price: v.price,
        price_change_percentage_24h: v.chg, price_change_percentage_1h_in_currency: v.chg / 12,
        price_change_percentage_7d_in_currency: v.chg * 2.4, price_change_percentage_30d_in_currency: v.chg * 4.1,
        total_volume: ({ BTC: 41.2e9, ETH: 21.7e9, USDT: 88.4e9, SOL: 5.1e9 })[sym] ?? v.price * 9e7, market_cap: v.price * (SUPPLY[sym] ?? 1e9), circulating_supply: SUPPLY[sym] ?? 1e9, ath: v.price * 1.18,
        sparkline_in_7d: { price: walk('cg7' + sym, 168, v.price, v.chg * 2.4, sym === 'USDT' ? 0.0002 : 0.008) },
      };
    }).filter(Boolean);
  }
  let m = u.pathname.match(/\/coins\/([^/]+)\/ohlc/);
  if (m) {
    const sym = CG_TO_SYM[m[1]] ?? 'BTC'; const v = PRICES[sym]; const days = u.searchParams.get('days');
    const n = days === '1' ? 48 : 90; const step = days === '1' ? 30 * MIN : (Number(days) || 365) * DAY / n;
    const pts = walk('ohlc' + sym + days, n, v.price, v.chg * (days === '1' ? 1 : 3));
    return pts.map((c, i) => { const o = i ? pts[i - 1] : c * 0.997; return [NOW - (n - i) * step, o, Math.max(o, c) * 1.004, Math.min(o, c) * 0.996, c]; });
  }
  m = u.pathname.match(/\/coins\/([^/]+)\/market_chart/);
  if (m) {
    const sym = CG_TO_SYM[m[1]] ?? 'BTC'; const v = PRICES[sym]; const days = u.searchParams.get('days');
    const n = 160; const span = (days === 'max' ? 3650 : Number(days) || 1) * DAY;
    const pts = walk('mc' + sym + days, n, v.price, v.chg * (days === '1' ? 1 : days === '7' ? 2.4 : days === '30' ? 4.1 : 12), sym === 'USDT' ? 0.0003 : 0.01);
    return { prices: pts.map((p, i) => [NOW - span + (span * i) / (n - 1), p]), total_volumes: [], market_caps: [] };
  }
  if (u.pathname.endsWith('/search')) return { coins: [] };
  if (u.pathname.endsWith('/ping')) return { gecko_says: 'ok' };
  return {};
}

// ── persona + world (locale-aware) ──────────────────────────────────────
export function createWorld(locale = 'en') {
  const ar = locale === 'ar';
  const L = (en, a) => (ar ? a : en);
  const ME = 'usr_amira_demo';

  const user = {
    id: ME, email: 'amira@example.com', phone: '+218 9X XXX XX17',
    firstName: L('Amira', 'أميرة'), lastName: L('Ben Ali', 'بن علي'), username: 'amira',
    avatarUrl: null, avatarEmoji: null, role: 'USER', accountType: 'PERSONAL', status: 'ACTIVE',
    country: 'LY', kycStatus: 'APPROVED', kycTier: 'TIER_3', twoFactorEnabled: true,
    emailVerified: true, phoneVerified: true, referralCode: 'AMIRA7', profilePublic: true,
    bio: L('Designer in Tripoli. Coffee, type and good maps.', 'مصممة من طرابلس. قهوة وخطوط وخرائط جميلة.'),
    baseCurrency: 'USD', passkeyEnabled: false, lastLoginAt: ago(2 * MIN), createdAt: '2025-03-14T09:20:00.000Z',
    businessAccountId: 'biz_benali_studio',
    businessProfile: { id: 'biz_benali_studio', companyName: 'Ben Ali Studio', legalName: 'Ben Ali Studio', country: 'LY', industry: 'Design', employeeCount: '2-10', website: 'benali.studio.example', billingEmail: 'billing@example.com', supportEmail: 'hello@example.com', kybStatus: 'APPROVED' },
  };

  // People (fictional)
  const P = {
    omar: { id: 'usr_omar', username: 'omar.benali', firstName: L('Omar', 'عمر'), lastName: L('Ben Ali', 'بن علي'), city: L('Manchester', 'مانشستر'), country: 'GB' },
    leila: { id: 'usr_leila', username: 'leila.h', firstName: L('Leila', 'ليلى'), lastName: L('Haddad', 'حداد'), city: L('Istanbul', 'إسطنبول'), country: 'TR' },
    nour: { id: 'usr_nour', username: 'nour.s', firstName: L('Nour', 'نور'), lastName: L('El-Sayed', 'السيد'), city: L('Cairo', 'القاهرة'), country: 'EG' },
    yusuf: { id: 'usr_yusuf', username: 'yusuf.m', firstName: L('Yusuf', 'يوسف'), lastName: L('Mansour', 'منصور'), city: L('Tripoli', 'طرابلس'), country: 'LY' },
    salma: { id: 'usr_salma', username: 'salma.t', firstName: L('Salma', 'سلمى'), lastName: L('Trabelsi', 'الطرابلسي'), city: L('Benghazi', 'بنغازي'), country: 'LY' },
    karim: { id: 'usr_karim', username: 'karim.z', firstName: L('Karim', 'كريم'), lastName: L('Zawi', 'الزاوي'), city: L('Misrata', 'مصراتة'), country: 'LY' },
    hana: { id: 'usr_hana', username: 'hana.k', firstName: L('Hana', 'هناء'), lastName: L('Kabir', 'الكبير'), city: L('Tripoli', 'طرابلس'), country: 'LY' },
  };
  const full = (p) => `${p.firstName} ${p.lastName}`;

  const wallets = [
    { id: 'w_lyd', currency: 'LYD', balance: '18450.500', frozen: '0' },
    { id: 'w_usd', currency: 'USD', balance: '2340.00', frozen: '0' },
    { id: 'w_eur', currency: 'EUR', balance: '860.00', frozen: '0' },
    { id: 'w_gbp', currency: 'GBP', balance: '415.20', frozen: '0' },
    { id: 'w_usdt', currency: 'USDT', balance: '3250.00', frozen: '0' },
    { id: 'w_btc', currency: 'BTC', balance: '0.04250000', frozen: '0' },
    { id: 'w_eth', currency: 'ETH', balance: '0.82000000', frozen: '0' },
    { id: 'w_sol', currency: 'SOL', balance: '6.40000000', frozen: '0' },
  ];
  const usdOf = (cur, amt) => (PRICES[cur] ? amt * PRICES[cur].price : FX[cur] ? amt / FX[cur] : amt);
  const walletRows = () => wallets.map((w) => ({ ...w, fiatValueUsd: usdOf(w.currency, Number(w.balance)).toFixed(2) }));
  const adjust = (cur, delta) => { const w = wallets.find((x) => x.currency === cur); if (w) w.balance = (Number(w.balance) + delta).toFixed(cur === 'LYD' ? 3 : PRICES[cur] && cur !== 'USDT' ? 8 : 2); };

  // ── activity feed ──
  const activities = [
    { id: 'act_1', kind: 'transaction', type: 'TRANSFER_IN', currency: 'GBP', amount: '250.00', status: 'COMPLETED', reference: 'TZ-8F2K-41QD', counterparty: { id: P.omar.id, username: P.omar.username, name: full(P.omar) }, description: null, metadata: { counterpartyName: full(P.omar), note: L("For mum's birthday 🎂", 'لعيد ميلاد ماما 🎂') }, createdAt: ago(38 * MIN) },
    { id: 'act_2', kind: 'p2p_trade', type: 'P2P_BUY', currency: 'USDT', amount: '500', status: 'COMPLETED', reference: 'P2P-7731', counterparty: { id: 'usr_khaled', username: 'khaled.m', name: L('Khaled M.', 'خالد م.') }, description: `Bought 500 USDT · 3,585 LYD`, metadata: null, createdAt: ago(2 * HOUR + 14 * MIN) },
    { id: 'act_3', kind: 'transaction', type: 'BUDGET_CONTRIBUTION', currency: 'LYD', amount: '-2200.000', status: 'COMPLETED', reference: 'SV-2207', description: L('Saved to “Hajj 2027”', 'ادخار في «حج 2027»'), metadata: { budgetId: 'bud_hajj' }, createdAt: ago(4 * HOUR + 2 * MIN) },
    { id: 'act_4', kind: 'transaction', type: 'TRANSFER_OUT', currency: 'USD', amount: '-36.00', status: 'COMPLETED', reference: 'TZ-3J9A-77PL', counterparty: { id: P.nour.id, username: P.nour.username, name: full(P.nour) }, metadata: { counterpartyName: full(P.nour), note: L('Dinner split 🍽️', 'تقسيم العشاء 🍽️') }, createdAt: dayAt(1, 21, 42) },
    { id: 'act_5', kind: 'deposit', type: 'DEPOSIT', currency: 'LYD', amount: '2000.000', status: 'COMPLETED', reference: 'DP-55120', description: L('Bank transfer top-up', 'إيداع بتحويل بنكي'), createdAt: dayAt(1, 11, 5) },
    { id: 'act_6', kind: 'transaction', type: 'BUY', currency: 'USDT', amount: '-500.000', status: 'COMPLETED', reference: 'RB-0418', description: L('Weekly USDT buy', 'شراء USDT الأسبوعي'), metadata: { asset: 'USDT', cryptoAmount: '69.86', settlementCurrency: 'LYD', settlementAmount: '-500.000' }, createdAt: dayAt(1, 9, 0) },
    { id: 'act_7', kind: 'transaction', type: 'TRANSFER_OUT', currency: 'LYD', amount: '-2400.000', status: 'COMPLETED', reference: 'RM-LYGB-2291', counterparty: { id: P.omar.id, username: P.omar.username, name: full(P.omar) }, description: L('Sent abroad · United Kingdom', 'تحويل للخارج · المملكة المتحدة'), metadata: { counterpartyName: full(P.omar), note: L('Sent abroad · GBP', 'تحويل للخارج · GBP') }, createdAt: dayAt(2, 17, 26) },
    { id: 'act_8', kind: 'transaction', type: 'TRANSFER_IN', currency: 'LYD', amount: '120.000', status: 'COMPLETED', reference: 'TZ-1Q8C-02ZK', counterparty: { id: P.yusuf.id, username: P.yusuf.username, name: full(P.yusuf) }, metadata: { counterpartyName: full(P.yusuf), note: L('Taxi share 🚕', 'مشاركة التاكسي 🚕') }, createdAt: dayAt(2, 13, 10) },
    { id: 'act_9', kind: 'card', type: 'CARD_SPEND', currency: 'USD', amount: '-14.99', status: 'APPROVED', reference: 'CD-99812', description: L('Card · Design tools subscription', 'البطاقة · اشتراك أدوات التصميم'), createdAt: dayAt(3, 10, 30) },
    { id: 'act_10', kind: 'transaction', type: 'TRANSFER_IN', currency: 'TRY', amount: '0', status: 'COMPLETED', reference: 'skip', createdAt: dayAt(9, 1, 0) },
  ].filter((a) => a.reference !== 'skip');

  const transactions = activities.map((a) => ({
    id: a.id, type: a.type, status: a.status === 'APPROVED' ? 'COMPLETED' : a.status, currency: a.currency, amount: a.amount, fee: '0',
    counterpartyHandle: a.counterparty?.username ? `@${a.counterparty.username}` : undefined,
    counterpartyName: a.counterparty?.name, note: a.metadata?.note, reference: a.reference, description: a.description, metadata: a.metadata, createdAt: a.createdAt,
  }));

  // ── contacts ──
  const contactList = [P.omar, P.leila, P.nour, P.yusuf, P.salma, P.karim, P.hana].map((p, i) => ({
    id: p.id, name: full(p), username: p.username, avatarUrl: null, verified: true, memberSince: dayAt(200 + i * 40, 12),
    lastAt: activities.find((a) => a.counterparty?.id === p.id)?.createdAt ?? dayAt(5 + i, 12), count: [14, 6, 9, 11, 3, 4, 2][i],
  }));
  const contactDetail = (id) => {
    const c = contactList.find((x) => x.id === id) ?? contactList[0];
    const items = id === P.omar.id ? [
      { id: 'cp1', direction: 'RECEIVED', amount: '250.00', currency: 'GBP', note: L("For mum's birthday 🎂", 'لعيد ميلاد ماما 🎂'), reference: 'TZ-8F2K-41QD', via: 'transfer', createdAt: ago(38 * MIN) },
      { id: 'cp2', direction: 'SENT', amount: '2400.000', currency: 'LYD', note: L('Rent help', 'مساعدة في الإيجار'), reference: 'RM-LYGB-2291', via: 'transfer', createdAt: dayAt(2, 17, 26) },
      { id: 'cp3', direction: 'SENT', amount: '40.00', currency: 'GBP', note: L('Football tickets ⚽', 'تذاكر الكرة ⚽'), reference: 'TZ-77AA-1Q', via: 'chat', createdAt: dayAt(6, 19, 2) },
      { id: 'cp4', direction: 'RECEIVED', amount: '100.00', currency: 'USD', note: L('Eid gift 🌙', 'عيدية 🌙'), reference: 'TZ-5KQ2-0P', via: 'chat', createdAt: dayAt(21, 10, 0) },
      { id: 'cp5', direction: 'SENT', amount: '75.00', currency: 'GBP', note: null, reference: 'TZ-2LM8-9C', via: 'link', createdAt: dayAt(34, 15, 40) },
    ] : [
      { id: 'cpx1', direction: 'SENT', amount: '36.00', currency: 'USD', note: L('Dinner split 🍽️', 'تقسيم العشاء 🍽️'), reference: 'TZ-3J9A-77PL', via: 'chat', createdAt: dayAt(1, 21, 42) },
      { id: 'cpx2', direction: 'RECEIVED', amount: '50.00', currency: 'USD', note: L('Concert tickets', 'تذاكر الحفل'), reference: 'TZ-0QK1-3D', via: 'transfer', createdAt: dayAt(12, 18, 0) },
    ];
    return {
      contact: c,
      summary: { count: c.count ?? items.length, firstAt: dayAt(180, 12), lastAt: c.lastAt, byCurrency: id === P.omar.id ? [{ currency: 'GBP', sent: '115.00', received: '250.00' }, { currency: 'LYD', sent: '2400.000', received: '0' }, { currency: 'USD', sent: '0', received: '100.00' }] : [{ currency: 'USD', sent: '36.00', received: '50.00' }] },
      items,
    };
  };

  // ── savings goals ──
  const budgets = [
    { id: 'bud_hajj', name: L('Hajj 2027', 'حج 2027'), emoji: '🕋', currency: 'LYD', balance: '31800.000', targetAmount: '45000.000', targetDate: '2027-04-20T00:00:00.000Z', lockType: 'DATE', unlockDate: '2027-04-01T00:00:00.000Z', autoEnabled: true, autoAmount: '2200.000', autoFrequency: 'MONTHLY', status: 'ACTIVE', progressPct: 70.7, locked: true, dateLocked: true, needsStepUp: false },
    { id: 'bud_laptop', name: L('New laptop', 'حاسوب جديد'), emoji: '💻', currency: 'USD', balance: '1240.00', targetAmount: '1800.00', targetDate: '2026-12-15T00:00:00.000Z', lockType: 'NONE', unlockDate: null, autoEnabled: true, autoAmount: '50.00', autoFrequency: 'WEEKLY', status: 'ACTIVE', progressPct: 68.9, locked: false, dateLocked: false, needsStepUp: false },
    { id: 'bud_emergency', name: L('Emergency fund', 'صندوق الطوارئ'), emoji: '🛟', currency: 'USD', balance: '3400.00', targetAmount: '5000.00', targetDate: null, lockType: 'STEP_UP', unlockDate: null, autoEnabled: false, autoAmount: null, autoFrequency: null, status: 'ACTIVE', progressPct: 68, locked: true, dateLocked: false, needsStepUp: true },
  ];
  const budgetContribs = {
    bud_hajj: [['AUTO', 2200, 4 * HOUR], ['MANUAL', 1500, 9 * DAY], ['AUTO', 2200, 31 * DAY], ['MANUAL', 3000, 45 * DAY], ['AUTO', 2200, 61 * DAY]],
    bud_laptop: [['AUTO', 50, 1 * DAY], ['AUTO', 50, 8 * DAY], ['MANUAL', 200, 11 * DAY], ['AUTO', 50, 15 * DAY]],
    bud_emergency: [['MANUAL', 400, 6 * DAY], ['MANUAL', 1000, 40 * DAY]],
  };
  const budgetFull = (b) => ({ ...b, contributions: (budgetContribs[b.id] ?? []).map(([kind, amt, t], i) => ({ id: `${b.id}_c${i}`, amount: String(amt), kind, createdAt: ago(t) })) });

  // ── limits (top tier) ──
  const resetsOn = (d) => { const x = new Date(NOW + d * DAY); return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}/${x.getUTCFullYear()}`; };
  const lim = (action, perTx, daily, monthly, used) => ({
    action, tier: 'TIER_3', blocked: false, perTxUsd: perTx,
    daily: { limitUsd: daily, usedUsd: used, remainingUsd: daily - used, resetsAt: inFuture(11 * HOUR), resetsOn: resetsOn(1) },
    monthly: { limitUsd: monthly, usedUsd: used * 6, remainingUsd: monthly - used * 6, resetsAt: inFuture(21 * DAY), resetsOn: resetsOn(21) },
    maxNowUsd: perTx, availableAgainAt: null, availableAgainOn: null, nextTier: null,
  });
  const limits = { kycStatus: 'APPROVED', tier: 'TIER_3', timezone: 'Africa/Tripoli', actions: {
    SEND: lim('SEND', 250000, 1000000, 10000000, 371), WITHDRAW: lim('WITHDRAW', 250000, 1000000, 10000000, 0),
    ONRAMP_BUY: lim('ONRAMP_BUY', 500000, 2000000, 20000000, 70), OFFRAMP_SELL: lim('OFFRAMP_SELL', 250000, 1000000, 10000000, 0) } };

  // ── notifications ──
  const notifications = [
    { id: 'n1', type: 'transfer', title: L('£250.00 received', 'وصلتك 250.00 £'), message: L(`${full(P.omar)} sent you £250.00 — “For mum's birthday 🎂”`, `أرسل لك ${full(P.omar)} مبلغ 250.00 £ — «لعيد ميلاد ماما 🎂»`), isRead: false, createdAt: ago(38 * MIN), metadata: { currency: 'GBP' } },
    { id: 'n2', type: 'p2p', title: L('P2P trade completed', 'اكتملت صفقة P2P'), message: L('500 USDT released from escrow to your wallet.', 'تم تحرير 500 USDT من الضمان إلى محفظتك.'), isRead: false, createdAt: ago(2 * HOUR + 10 * MIN), metadata: { tradeId: 'trd_done' } },
    { id: 'n3', type: 'payment', title: L('Savings: Hajj 2027', 'الادخار: حج 2027'), message: L('Your monthly 2,200 LYD went in. You’re 71% of the way there.', 'تمت إضافة 2,200 د.ل الشهرية. وصلتِ إلى 71٪ من هدفك.'), isRead: false, createdAt: ago(4 * HOUR), metadata: {} },
    { id: 'n4', type: 'trade', title: L('Weekly USDT buy done', 'تم شراء USDT الأسبوعي'), message: L('Bought 69.86 USDT for 500 LYD at your locked quote.', 'تم شراء 69.86 USDT مقابل 500 د.ل بالسعر المثبت.'), isRead: true, createdAt: dayAt(1, 9, 1), metadata: {} },
    { id: 'n5', type: 'transfer', title: L('Delivered to Omar', 'تم التسليم إلى عمر'), message: L('£257.83 arrived in Manchester. Ref RM-LYGB-2291.', 'وصل 257.83 £ إلى مانشستر. المرجع RM-LYGB-2291.'), isRead: true, createdAt: dayAt(2, 17, 58), metadata: {} },
    { id: 'n6', type: 'deposit', title: L('Top-up confirmed', 'تم تأكيد الإيداع'), message: L('2,000.000 LYD added to your wallet.', 'تمت إضافة 2,000.000 د.ل إلى محفظتك.'), isRead: true, createdAt: dayAt(1, 11, 20), metadata: { currency: 'LYD' } },
    { id: 'n7', type: 'kyc', title: L('Full verification complete', 'اكتمل التحقق الكامل'), message: L('Level 3 unlocked — your highest limits are now active.', 'تم فتح المستوى 3 — أعلى حدودك مفعّلة الآن.'), isRead: true, createdAt: dayAt(18, 14, 0), metadata: {} },
    { id: 'n8', type: 'referral', title: L('Hana joined with your code', 'انضمت هناء برمزك'), message: L('Thanks for spreading the word.', 'شكراً لنشر الكلمة.'), isRead: true, createdAt: dayAt(22, 16, 30), metadata: {} },
  ];

  // ── messaging ──
  const priv = { readReceiptsOn: true, lastSeenOn: true, canSeeReadReceipts: true, canSeePresence: true };
  const partner = (p, online = false, last = 25 * MIN) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, username: p.username, avatarUrl: null, role: 'USER', kycStatus: 'APPROVED', bio: null, profilePublic: true, createdAt: '2025-01-01T00:00:00.000Z', messagePrivacy: { ...priv, onlineNow: online, lastSeenAt: online ? null : ago(last) } });
  const msg = (id, from, to, content, t, extra = {}) => ({ id, senderId: from, receiverId: to, content, type: 'TEXT', metadata: null, isRead: true, readAt: t, editedAt: null, deletedAt: null, tradeId: null, createdAt: t, clientId: null, ...extra });
  const threads = {
    [P.omar.id]: [
      msg('m1', P.omar.id, ME, L('Salam! Did the transfer reach you?', 'السلام عليكم! وصلك التحويل؟'), ago(55 * MIN)),
      msg('m2', ME, P.omar.id, L('Not yet — checking now', 'ليس بعد — أتحقق الآن'), ago(52 * MIN)),
      msg('m3', P.omar.id, ME, L("For mum's birthday 🎂", 'لعيد ميلاد ماما 🎂'), ago(38 * MIN), { type: 'PAYMENT', metadata: { amount: 250, currency: 'GBP', status: 'COMPLETED', note: L("For mum's birthday 🎂", 'لعيد ميلاد ماما 🎂'), txRef: 'TZ-8F2K-41QD' } }),
      msg('m4', ME, P.omar.id, L('Got it, thank you! I’ll get the cake from Al-Saraya 🙏', 'وصل، شكراً! سأحضر الكعكة من السرايا 🙏'), ago(36 * MIN)),
      msg('m5', P.omar.id, ME, L('Can you cover the flowers too? I’ll settle up Friday', 'تقدري تتكفلي بالورد كمان؟ أرجعها لك الجمعة'), ago(20 * MIN)),
    ],
    [P.nour.id]: [
      msg('n_1', P.nour.id, ME, L('That was such a good dinner 😋', 'كان عشاء رائعاً 😋'), dayAt(1, 21, 30)),
      msg('n_2', ME, P.nour.id, L('Dinner split 🍽️', 'تقسيم العشاء 🍽️'), dayAt(1, 21, 42), { type: 'PAYMENT', metadata: { amount: 36, currency: 'USD', status: 'COMPLETED', note: L('Dinner split 🍽️', 'تقسيم العشاء 🍽️'), txRef: 'TZ-3J9A-77PL' } }),
      msg('n_3', P.nour.id, ME, L('Received, shukran! Next one is on me', 'وصل، شكراً! العشاء القادم عليّ'), dayAt(1, 21, 45)),
    ],
    [P.leila.id]: [
      msg('l_1', P.leila.id, ME, L('Are you still coming to Istanbul in November?', 'هل ما زلتِ قادمة إلى إسطنبول في نوفمبر؟'), dayAt(1, 18, 5)),
      msg('l_2', ME, P.leila.id, L('Yes! Booking flights this week ✈️', 'نعم! سأحجز الطيران هذا الأسبوع ✈️'), dayAt(1, 18, 20)),
    ],
    [P.yusuf.id]: [msg('y_1', P.yusuf.id, ME, L('Taxi share 🚕', 'مشاركة التاكسي 🚕'), dayAt(2, 13, 10), { type: 'PAYMENT', metadata: { amount: 120, currency: 'LYD', status: 'COMPLETED', note: L('Taxi share 🚕', 'مشاركة التاكسي 🚕'), txRef: 'TZ-1Q8C-02ZK' } })],
    [P.salma.id]: [msg('s_1', P.salma.id, ME, L('Sending you the photos from the weekend', 'سأرسل لك صور عطلة نهاية الأسبوع'), dayAt(3, 20, 15))],
    [P.karim.id]: [msg('k_1', ME, P.karim.id, L('Logo files are in the shared folder', 'ملفات الشعار في المجلد المشترك'), dayAt(4, 11, 0))],
  };
  const partners = { [P.omar.id]: partner(P.omar, true), [P.nour.id]: partner(P.nour, false, 3 * HOUR), [P.leila.id]: partner(P.leila, false, 40 * MIN), [P.yusuf.id]: partner(P.yusuf), [P.salma.id]: partner(P.salma, false, DAY), [P.karim.id]: partner(P.karim, false, 2 * DAY), [P.hana.id]: partner(P.hana) };
  const conversations = () => Object.entries(threads).map(([pid, list]) => ({ partner: partners[pid], lastMessage: list[list.length - 1], unread: pid === P.omar.id ? 1 : pid === P.leila.id ? 0 : 0 }))
    .sort((a, b) => (a.lastMessage.createdAt < b.lastMessage.createdAt ? 1 : -1));

  // ── P2P ──
  const trader = (name, handle, done, rate) => ({ handle: `@${handle}`, name, rating: Math.round(rate / 2) / 10, orders: done, completedTrades: done, completionRate: rate, verified: true, avatarUrl: undefined, anonymous: false });
  const offersAll = [
    { id: 'lst_1', side: 'SELL', trader: trader(L('Khaled M.', 'خالد م.'), 'khaled.m', 412, 99), base: 'USDT', quote: 'LYD', price: '7.150', available: '4800', minLimit: '500', maxLimit: '25000', paymentMethods: ['BANK_TRANSFER', 'CASH'], country: 'LY', city: L('Tripoli', 'طرابلس'), timeframeMins: 30, hasLocation: true, _km: 3 },
    { id: 'lst_2', side: 'SELL', trader: trader(L('Rania A.', 'رانيا ع.'), 'rania.a', 238, 98), base: 'USDT', quote: 'LYD', price: '7.160', available: '2150', minLimit: '300', maxLimit: '12000', paymentMethods: ['CASH', 'MOBILE_MONEY'], country: 'LY', city: L('Tripoli', 'طرابلس'), timeframeMins: 20, hasLocation: true, _km: 5 },
    { id: 'lst_3', side: 'SELL', trader: trader(L('Faraj B.', 'فرج ب.'), 'faraj.b', 156, 97), base: 'USDT', quote: 'LYD', price: '7.170', available: '9600', minLimit: '1000', maxLimit: '50000', paymentMethods: ['BANK_TRANSFER'], country: 'LY', city: L('Tajoura', 'تاجوراء'), timeframeMins: 45, hasLocation: true, _km: 15 },
    { id: 'lst_4', side: 'SELL', trader: trader(L('Mona S.', 'منى س.'), 'mona.s', 91, 100), base: 'USD', quote: 'LYD', price: '7.140', available: '1500', minLimit: '200', maxLimit: '8000', paymentMethods: ['CASH'], country: 'LY', city: L('Tripoli', 'طرابلس'), timeframeMins: 30, hasLocation: true, _km: 1 },
    { id: 'lst_5', side: 'SELL', trader: trader(L('Tarek H.', 'طارق ح.'), 'tarek.h', 64, 96), base: 'BTC', quote: 'LYD', price: '705800', available: '0.12', minLimit: '2000', maxLimit: '60000', paymentMethods: ['BANK_TRANSFER'], country: 'LY', city: L('Benghazi', 'بنغازي'), timeframeMins: 60, hasLocation: false },
    { id: 'lst_6', side: 'SELL', trader: trader(L('Aisha F.', 'عائشة ف.'), 'aisha.f', 120, 98), base: 'USDT', quote: 'USD', price: '1.002', available: '3000', minLimit: '100', maxLimit: '3000', paymentMethods: ['BANK_TRANSFER'], country: 'LY', city: L('Misrata', 'مصراتة'), timeframeMins: 30, hasLocation: false },
    { id: 'lst_7', side: 'BUY', trader: trader(L('Sami K.', 'سامي ك.'), 'sami.k', 301, 99), base: 'USDT', quote: 'LYD', price: '7.090', available: '6000', minLimit: '500', maxLimit: '30000', paymentMethods: ['BANK_TRANSFER', 'CASH'], country: 'LY', city: L('Tripoli', 'طرابلس'), timeframeMins: 30, hasLocation: true, _km: 2 },
    { id: 'lst_8', side: 'BUY', trader: trader(L('Noura E.', 'نورة إ.'), 'noura.e', 77, 97), base: 'USDT', quote: 'LYD', price: '7.080', available: '2500', minLimit: '300', maxLimit: '10000', paymentMethods: ['MOBILE_MONEY'], country: 'LY', city: L('Zawiya', 'الزاوية'), timeframeMins: 20, hasLocation: true, _km: 40 },
    { id: 'lst_9', side: 'BUY', trader: trader(L('Adel R.', 'عادل ر.'), 'adel.r', 45, 95), base: 'USD', quote: 'LYD', price: '7.060', available: '2000', minLimit: '200', maxLimit: '5000', paymentMethods: ['CASH'], country: 'LY', city: L('Benghazi', 'بنغازي'), timeframeMins: 30, hasLocation: false },
  ];
  const offers = (side, near) => offersAll.filter((o) => side === 'ALL' || o.side === side).map(({ _km, ...o }) => ({ ...o, ...(near && o.hasLocation ? { distanceKm: _km } : {}) }))
    .sort((a, b) => (near ? (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) : 0));
  const trades = [
    { id: 'trd_escrow', listingId: 'lst_6', buyerId: ME, sellerId: 'usr_rania', amount: '700', price: '1.002', totalFiat: '701.40', status: 'ESCROW_FUNDED', paymentMethod: 'BANK_TRANSFER', reference: 'P2P-8124', createdAt: ago(9 * MIN), expiresAt: inFuture(21 * MIN), listing: { currency: 'USDT', fiatCurrency: 'USD', side: 'SELL' }, counterparty: { username: 'rania.a', name: L('Rania A.', 'رانيا ع.'), firstName: L('Rania', 'رانيا'), lastName: L('A.', 'ع.') }, buyer: { id: ME, firstName: user.firstName, lastName: user.lastName, username: 'amira' }, seller: { id: 'usr_rania', firstName: L('Rania', 'رانيا'), lastName: L('A.', 'ع.'), username: 'rania.a' } },
    { id: 'trd_done', listingId: 'lst_1', buyerId: ME, sellerId: 'usr_khaled', amount: '500', price: '7.170', totalFiat: '3585.00', status: 'COMPLETED', paymentMethod: 'BANK_TRANSFER', reference: 'P2P-7731', createdAt: ago(2 * HOUR + 40 * MIN), listing: { currency: 'USDT', fiatCurrency: 'LYD', side: 'SELL' }, counterparty: { username: 'khaled.m', name: L('Khaled M.', 'خالد م.') }, buyer: { id: ME, firstName: user.firstName, lastName: user.lastName, username: 'amira' }, seller: { id: 'usr_khaled', firstName: L('Khaled', 'خالد'), lastName: L('M.', 'م.'), username: 'khaled.m' } },
    { id: 'trd_old', listingId: 'lst_7', buyerId: 'usr_sami', sellerId: ME, amount: '300', price: '7.050', totalFiat: '2115.00', status: 'COMPLETED', paymentMethod: 'CASH', reference: 'P2P-6610', createdAt: dayAt(6, 15, 20), listing: { currency: 'USDT', fiatCurrency: 'LYD', side: 'BUY' }, counterparty: { username: 'sami.k', name: L('Sami K.', 'سامي ك.') }, buyer: { id: 'usr_sami', firstName: L('Sami', 'سامي'), lastName: L('K.', 'ك.'), username: 'sami.k' }, seller: { id: ME, firstName: user.firstName, lastName: user.lastName, username: 'amira' } },
  ];
  const p2pThread = [
    msg('pt1', 'system', ME, L('Trade opened. 700 USDT is locked in escrow.', 'تم فتح الصفقة. 700 USDT محجوزة في الضمان.'), ago(9 * MIN), { type: 'SYSTEM', tradeId: 'trd_escrow', senderId: 'usr_rania' }),
    msg('pt2', 'usr_rania', ME, L('Hi Amira, I can meet near Martyrs’ Square around 4pm.', 'مرحباً أميرة، أقدر ألتقي قرب ميدان الشهداء حوالي الرابعة.'), ago(8 * MIN), { tradeId: 'trd_escrow', type: 'P2P_NOTE' }),
    msg('pt3', ME, 'usr_rania', L('Perfect, see you there. I’ll bring the cash.', 'ممتاز، أراك هناك. سأحضر النقد.'), ago(6 * MIN), { tradeId: 'trd_escrow', type: 'P2P_NOTE' }),
  ];

  // ── remittance ──
  const corridors = [
    { code: 'LY-GB', name: 'Libya → United Kingdom', sourceCurrency: 'LYD', destCurrency: 'GBP', destCountry: 'GB', direction: 'OUTBOUND', status: 'LIVE', available: true, sandbox: false, minAmount: '10', maxAmount: '10000', payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'], purposes: ['FAMILY_SUPPORT', 'EDUCATION', 'MEDICAL', 'SAVINGS', 'GIFT', 'OTHER'], quoteTtlSeconds: 90 },
    { code: 'LY-TR', name: 'Libya → Turkey', sourceCurrency: 'LYD', destCurrency: 'TRY', destCountry: 'TR', direction: 'OUTBOUND', status: 'LIVE', available: true, sandbox: false, minAmount: '300', maxAmount: '400000', payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'], purposes: ['FAMILY_SUPPORT', 'EDUCATION', 'GOODS_AND_SERVICES', 'GIFT', 'OTHER'], quoteTtlSeconds: 90 },
    { code: 'LY-EG', name: 'Libya → Egypt', sourceCurrency: 'LYD', destCurrency: 'EGP', destCountry: 'EG', direction: 'OUTBOUND', status: 'LIVE', available: true, sandbox: false, minAmount: '500', maxAmount: '500000', payoutMethods: ['BANK_ACCOUNT', 'MOBILE_WALLET', 'TAZDAN_WALLET'], purposes: ['FAMILY_SUPPORT', 'EDUCATION', 'MEDICAL', 'GIFT', 'OTHER'], quoteTtlSeconds: 90 },
    { code: 'LY-TN', name: 'Libya → Tunisia', sourceCurrency: 'LYD', destCurrency: 'TND', destCountry: 'TN', direction: 'OUTBOUND', status: 'LIVE', available: true, sandbox: false, minAmount: '30', maxAmount: '30000', payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'], purposes: ['FAMILY_SUPPORT', 'EDUCATION', 'MEDICAL', 'GIFT', 'OTHER'], quoteTtlSeconds: 90 },
    { code: 'LY-AE', name: 'Libya → UAE', sourceCurrency: 'LYD', destCurrency: 'AED', destCountry: 'AE', direction: 'OUTBOUND', status: 'LIVE', available: true, sandbox: false, minAmount: '50', maxAmount: '50000', payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'], purposes: ['FAMILY_SUPPORT', 'GOODS_AND_SERVICES', 'GIFT', 'OTHER'], quoteTtlSeconds: 90 },
    { code: 'LY-EU', name: 'Libya → Euro area', sourceCurrency: 'LYD', destCurrency: 'EUR', destCountry: 'EU', direction: 'OUTBOUND', status: 'LIVE', available: true, sandbox: false, minAmount: '10', maxAmount: '12000', payoutMethods: ['BANK_ACCOUNT', 'TAZDAN_WALLET'], purposes: ['FAMILY_SUPPORT', 'EDUCATION', 'MEDICAL', 'GIFT', 'OTHER'], quoteTtlSeconds: 90 },
  ];
  const beneficiaries = [
    { id: 'ben_omar', fullName: full(P.omar), relationship: L('Brother', 'أخ'), country: 'GB', currency: 'GBP', payoutMethod: 'BANK_ACCOUNT', bankName: L('Example Bank UK', 'بنك تجريبي – المملكة المتحدة'), accountNumber: '••••2290', iban: null, sortCode: '••-••-14', mobileWallet: null, createdAt: dayAt(90, 12) },
    { id: 'ben_leila', fullName: full(P.leila), relationship: L('Cousin', 'ابنة العم'), country: 'TR', currency: 'TRY', payoutMethod: 'BANK_ACCOUNT', bankName: L('Example Bank TR', 'بنك تجريبي – تركيا'), accountNumber: null, iban: 'TR•• •••• •••• 0413', sortCode: null, mobileWallet: null, createdAt: dayAt(60, 12) },
    { id: 'ben_nour', fullName: full(P.nour), relationship: L('Friend', 'صديقة'), country: 'EG', currency: 'EGP', payoutMethod: 'MOBILE_WALLET', bankName: null, accountNumber: null, iban: null, sortCode: null, mobileWallet: '+20 1•• ••• 4471', createdAt: dayAt(40, 12) },
  ];
  const corridorRate = { GBP: FX.GBP / FX.LYD * 0.985, TRY: FX.TRY / FX.LYD * 0.987, EGP: FX.EGP / FX.LYD * 0.988, TND: FX.TND / FX.LYD * 0.988, AED: FX.AED / FX.LYD * 0.988, EUR: FX.EUR / FX.LYD * 0.985 };
  const feeFor = { GBP: [10, 0.005], TRY: [8, 0.004], EGP: [5, 0.004], TND: [5, 0.004], AED: [8, 0.004], EUR: [10, 0.005] };
  let quoteSeq = 0;
  const makeQuote = (code, send) => {
    const c = corridors.find((x) => x.code === code) ?? corridors[0];
    const [ff, fp] = feeFor[c.destCurrency] ?? [10, 0.005];
    const fee = +(ff + send * fp).toFixed(3); const rate = corridorRate[c.destCurrency];
    return { id: `q_${++quoteSeq}`, corridor: { code: c.code, name: c.name }, sendAmount: send.toFixed(3), feeAmount: fee.toFixed(3), totalDebit: (send + fee).toFixed(3), customerRate: rate.toFixed(6), receiveAmount: (send * rate).toFixed(2), expiresAt: Date.now() + 90_000, estimatedDeliveryMinutes: c.destCurrency === 'GBP' ? 30 : 60, payoutAvailable: true, sandbox: false };
  };
  const remitTransfers = [
    { id: 'rmt_omar', reference: 'RM-LYGB-2291', state: 'PAYOUT_PENDING', sourceCurrency: 'LYD', destCurrency: 'GBP', sendAmount: '2400.000', feeAmount: '22.000', totalDebit: '2422.000', customerRate: '0.103208', receiveAmount: '247.70', purpose: 'FAMILY_SUPPORT', createdAt: ago(26 * MIN), paidAt: null, completedAt: null, refundedAt: null, failureReason: null, corridor: { code: 'LY-GB', name: 'Libya → United Kingdom', status: 'LIVE' }, beneficiary: { id: 'ben_omar', fullName: full(P.omar), country: 'GB', payoutMethod: 'BANK_ACCOUNT' }, sandbox: false },
    { id: 'rmt_leila', reference: 'RM-LYTR-1840', state: 'COMPLETED', sourceCurrency: 'LYD', destCurrency: 'TRY', sendAmount: '1500.000', feeAmount: '14.000', totalDebit: '1514.000', customerRate: '5.766000', receiveAmount: '8649.00', purpose: 'GIFT', createdAt: dayAt(12, 10, 15), paidAt: dayAt(12, 10, 52), completedAt: dayAt(12, 10, 52), refundedAt: null, failureReason: null, corridor: { code: 'LY-TR', name: 'Libya → Turkey', status: 'LIVE' }, beneficiary: { id: 'ben_leila', fullName: full(P.leila), country: 'TR', payoutMethod: 'BANK_ACCOUNT' }, sandbox: false },
    { id: 'rmt_nour', reference: 'RM-LYEG-0977', state: 'COMPLETED', sourceCurrency: 'LYD', destCurrency: 'EGP', sendAmount: '800.000', feeAmount: '8.200', totalDebit: '808.200', customerRate: '6.716000', receiveAmount: '5372.80', purpose: 'FAMILY_SUPPORT', createdAt: dayAt(29, 16, 0), paidAt: dayAt(29, 16, 40), completedAt: dayAt(29, 16, 40), refundedAt: null, failureReason: null, corridor: { code: 'LY-EG', name: 'Libya → Egypt', status: 'LIVE' }, beneficiary: { id: 'ben_nour', fullName: full(P.nour), country: 'EG', payoutMethod: 'MOBILE_WALLET' }, sandbox: false },
  ];
  const remitTimeline = (tr) => {
    const t0 = new Date(tr.createdAt).getTime();
    const steps = tr.state === 'COMPLETED'
      ? [['CREATED', 0], ['QUOTED', 0], ['COMPLIANCE_PENDING', 1], ['FUNDED', 2], ['SETTLED', 4], ['PAYOUT_PENDING', 5], ['PAID', 37], ['COMPLETED', 37]]
      : [['CREATED', 0], ['QUOTED', 0], ['COMPLIANCE_PENDING', 1], ['FUNDED', 2], ['SETTLED', 6], ['PAYOUT_PENDING', 8]];
    return steps.map(([state, m]) => ({ state, at: new Date(t0 + m * MIN).toISOString() }));
  };

  // ── cards ──
  const cards = [
    { id: 'card_v1', tier: 'PRO', status: 'ACTIVE', last4: '4417', expiryMonth: 8, expiryYear: 2029, cardHolder: 'AMIRA BEN ALI', currency: 'USD', spentMonth: '214.37', dailyLimit: '5000', monthlyLimit: '25000', spentTotal: '2140.90', cashbackRate: '0.01', cashbackBalance: '21.40', nickname: L('Everyday', 'اليومية'), colorway: 'sapphire', frozen: false, contactlessOn: true, onlineOn: true, atmOn: false, issuedAt: dayAt(120, 12), activatedAt: dayAt(120, 12), physicalStatus: 'NONE', physicalOrderedAt: null, physicalFee: null, balance: '486.20', available: '486.20' },
  ];
  const cardTxs = [
    { id: 'ct1', cardId: 'card_v1', amount: '14.99', currency: 'USD', merchant: L('Design tools', 'أدوات التصميم'), category: L('Software', 'برمجيات'), status: 'COMPLETED', createdAt: dayAt(3, 10, 30) },
    { id: 'ct2', cardId: 'card_v1', amount: '42.10', currency: 'USD', merchant: L('Online bookshop', 'مكتبة إلكترونية'), category: L('Shopping', 'تسوق'), status: 'COMPLETED', createdAt: dayAt(5, 19, 12) },
    { id: 'ct3', cardId: 'card_v1', amount: '9.99', currency: 'USD', merchant: L('Music streaming', 'بث الموسيقى'), category: L('Entertainment', 'ترفيه'), status: 'COMPLETED', createdAt: dayAt(8, 8, 0) },
    { id: 'ct5', cardId: 'card_v1', amount: '126.40', currency: 'USD', merchant: L('Airline booking', 'حجز طيران'), category: L('Travel', 'سفر'), status: 'COMPLETED', createdAt: dayAt(11, 21, 40) },
    { id: 'ct6', cardId: 'card_v1', amount: '20.89', currency: 'USD', merchant: L('Cloud storage', 'تخزين سحابي'), category: L('Software', 'برمجيات'), status: 'COMPLETED', createdAt: dayAt(14, 7, 5) },
  ];
  const bankAccounts = [
    { id: 'bank_1', bankName: L('Example Bank Libya', 'بنك تجريبي – ليبيا'), accountNumber: '•••• •••• 0471', accountName: 'AMIRA BEN ALI', branch: L('Tripoli Centre', 'وسط طرابلس'), country: 'LY', currency: 'LYD', iban: null, swift: null, isDefault: true, createdAt: dayAt(200, 12) },
    { id: 'bank_2', bankName: L('Example Bank UK', 'بنك تجريبي – المملكة المتحدة'), accountNumber: '•••• 8830', accountName: 'AMIRA BEN ALI', country: 'GB', currency: 'GBP', sortCode: '••-••-27', iban: null, swift: null, isDefault: false, createdAt: dayAt(150, 12) },
  ];

  // ── security ──
  const devices = [
    { id: 'dev_1', label: 'iPhone 16 Pro', deviceType: 'mobile', os: 'iOS 18.6', ipAddress: '41.208.x.x', location: L('Tripoli, Libya', 'طرابلس، ليبيا'), lastSeenAt: ago(MIN), createdAt: dayAt(120, 12), current: true },
    { id: 'dev_2', label: 'iPad Air', deviceType: 'tablet', os: 'iPadOS 18.5', ipAddress: '41.208.x.x', location: L('Tripoli, Libya', 'طرابلس، ليبيا'), lastSeenAt: dayAt(2, 22, 0), createdAt: dayAt(300, 12), current: false },
    { id: 'dev_3', label: 'MacBook Pro', deviceType: 'desktop', os: 'macOS 15', ipAddress: '41.208.x.x', location: L('Tripoli, Libya', 'طرابلس، ليبيا'), lastSeenAt: dayAt(9, 10, 0), createdAt: dayAt(240, 12), current: false },
  ];
  const sessions = [
    { id: 'ses_1', ipAddress: '41.208.x.x', userAgent: 'tazdan iOS', createdAt: ago(3 * HOUR), expiresAt: inFuture(27 * DAY), lastActiveAt: ago(MIN), deviceName: 'iPhone 16 Pro', deviceType: 'mobile', os: 'iOS 18.6', browser: null, location: L('Tripoli, Libya', 'طرابلس، ليبيا'), current: true },
    { id: 'ses_2', ipAddress: '41.208.x.x', userAgent: 'Safari', createdAt: dayAt(2, 21, 0), expiresAt: inFuture(25 * DAY), lastActiveAt: dayAt(2, 22, 0), deviceName: 'iPad Air', deviceType: 'tablet', os: 'iPadOS 18.5', browser: 'Safari', location: L('Tripoli, Libya', 'طرابلس، ليبيا'), current: false },
  ];

  // ── recurring buy ──
  const recurring = [
    { id: 'rb_usdt', asset: 'USDT', network: 'TRC20', fiatCurrency: 'LYD', fiatAmount: '500', frequency: 'WEEKLY', sourceType: 'WALLET', sourceId: 'w_lyd', status: 'ACTIVE', nextRunAt: dayAt(-6, 9, 0), lastRunAt: dayAt(1, 9, 0), lastError: null, runCount: 18, createdAt: dayAt(127, 9) },
    { id: 'rb_btc', asset: 'BTC', network: 'BTC', fiatCurrency: 'USD', fiatAmount: '25', frequency: 'MONTHLY', sourceType: 'WALLET', sourceId: 'w_usd', status: 'ACTIVE', nextRunAt: dayAt(-21, 9, 0), lastRunAt: dayAt(9, 9, 0), lastError: null, runCount: 7, createdAt: dayAt(220, 9) },
  ];

  // ── business ──
  const biz = {
    profile: { id: 'biz_benali_studio', legalName: 'Ben Ali Studio', tradingName: 'Ben Ali Studio', country: 'LY', kybStatus: 'APPROVED', website: 'benali.studio.example', logoUrl: null, createdAt: dayAt(160, 12), role: 'OWNER', kybNotes: null },
    stats: { payoutsToday: 6, payoutsThisMonth: 48, volumeUsdToday: '3420.00', volumeUsdMonth: '28640.00', apiCallsToday: 1284, teamSize: 4, activeKeys: 2, successRate: 0.996 },
    team: [
      { id: 'tm_1', userId: ME, email: 'amira@example.com', role: 'OWNER', status: 'ACTIVE', joinedAt: dayAt(160, 12), invitedAt: dayAt(160, 12), user: { firstName: user.firstName, lastName: user.lastName, avatarUrl: null, username: 'amira' } },
      { id: 'tm_2', userId: P.karim.id, email: 'karim@example.com', role: 'ADMIN', status: 'ACTIVE', joinedAt: dayAt(150, 12), invitedAt: dayAt(151, 12), user: { firstName: P.karim.firstName, lastName: P.karim.lastName, avatarUrl: null, username: P.karim.username } },
      { id: 'tm_3', userId: P.salma.id, email: 'salma@example.com', role: 'ANALYST', status: 'ACTIVE', joinedAt: dayAt(90, 12), invitedAt: dayAt(91, 12), user: { firstName: P.salma.firstName, lastName: P.salma.lastName, avatarUrl: null, username: P.salma.username } },
      { id: 'tm_4', userId: P.hana.id, email: 'hana@example.com', role: 'DEVELOPER', status: 'ACTIVE', joinedAt: dayAt(30, 12), invitedAt: dayAt(31, 12), user: { firstName: P.hana.firstName, lastName: P.hana.lastName, avatarUrl: null, username: P.hana.username } },
      { id: 'tm_5', userId: null, email: 'finance@example.com', role: 'ANALYST', status: 'PENDING', joinedAt: null, invitedAt: dayAt(1, 15, 0), user: null },
    ],
    keys: [
      { id: 'key_1', name: L('Invoicing integration', 'تكامل الفواتير'), prefix: 'tzk_test_', last4: '9f3a', permissions: ['PAYOUTS', 'BALANCES'], status: 'ACTIVE', expiresAt: inFuture(170 * DAY), lastUsedAt: ago(12 * MIN), createdAt: dayAt(60, 12) },
      { id: 'key_2', name: L('Reporting (read-only)', 'التقارير (قراءة فقط)'), prefix: 'tzk_test_', last4: '41c7', permissions: ['READ_ONLY', 'RATES'], status: 'ACTIVE', expiresAt: null, lastUsedAt: dayAt(1, 8, 0), createdAt: dayAt(110, 12) },
      { id: 'key_3', name: L('Old prototype', 'نموذج قديم'), prefix: 'tzk_test_', last4: '0b12', permissions: ['PAYOUTS'], status: 'REVOKED', expiresAt: null, lastUsedAt: dayAt(70, 12), createdAt: dayAt(150, 12) },
    ],
    payouts: [
      ['py1', 'leila.h', null, '420.00', 'USD', 'COMPLETED', L('Illustration — October', 'رسوم — أكتوبر'), ago(50 * MIN)],
      ['py2', 'yusuf.m', null, '1800.000', 'LYD', 'COMPLETED', L('Photo shoot', 'جلسة تصوير'), ago(3 * HOUR)],
      ['py3', null, 'studio-assist@example.com', '150.00', 'USD', 'PROCESSING', L('Assistant day rate', 'أجر مساعد يومي'), ago(4 * HOUR)],
      ['py4', 'nour.s', null, '260.00', 'USD', 'COMPLETED', L('Copywriting', 'كتابة محتوى'), dayAt(1, 14, 0)],
      ['py5', 'salma.t', null, '950.000', 'LYD', 'COMPLETED', L('Print run', 'طباعة'), dayAt(2, 12, 0)],
      ['py6', 'karim.z', null, '75.00', 'USD', 'FAILED', L('Fonts licence', 'ترخيص خطوط'), dayAt(3, 9, 0)],
    ].map(([id, h, e, amt, cur, st, note, at], i) => ({ id, reference: `PO-${4410 + i}`, recipientHandle: h, recipientEmail: e, amount: amt, currency: cur, feeAmount: (Number(amt) * 0.005).toFixed(2), netAmount: (Number(amt) * 0.995).toFixed(2), status: st, note, batchId: i < 2 ? 'bat_0921' : null, createdAt: at, completedAt: st === 'COMPLETED' ? at : null })),
    batches: [
      { id: 'bat_1007', reference: 'BATCH-1007', currency: 'LYD', totalAmount: '14250.000', totalFee: '71.250', count: 8, status: 'PENDING_APPROVAL', note: L('October freelancer payouts', 'مستحقات المستقلين — أكتوبر'), source: 'APP', approvalReason: L('Over the 10,000 LYD dual-approval threshold', 'تتجاوز حد الموافقة المزدوجة 10,000 د.ل'), createdById: P.karim.id, approvedById: null, approvedAt: null, createdAt: ago(35 * MIN) },
    ],
  };

  // ── claim link ──
  const claimPreview = { asset: 'USD', amount: '50.00', note: L('Welcome to tazdan! Coffee is on me ☕', 'أهلاً بك في تزدان! القهوة عليّ ☕'), status: 'PENDING', expiresAt: inFuture(6 * DAY), hasPin: false, sender: { firstName: P.omar.firstName, handle: P.omar.username, avatarUrl: null } };
  const claimMine = [
    { id: 'cl_1', shortId: 'K7Q2', asset: 'USD', amount: '50.00', status: 'PENDING', expiresAt: inFuture(6 * DAY), recipientEmail: null, recipientPhone: '+44 7••• ••• 210', recipientHandle: null, note: L('Coffee is on me ☕', 'القهوة عليّ ☕'), hasPin: false, createdAt: ago(5 * HOUR) },
  ];

  const publicProfile = (handle) => {
    const h = String(handle).replace(/^@/, '');
    const p = h === 'amira' ? { id: ME, firstName: user.firstName, lastName: user.lastName, bio: user.bio } : (() => { const x = Object.values(P).find((q) => q.username === h) ?? P.omar; return { id: x.id, firstName: x.firstName, lastName: x.lastName, bio: null }; })();
    return { id: p.id, username: h, firstName: p.firstName, lastName: p.lastName, bio: p.bio ?? undefined, avatarUrl: undefined, acceptedCurrencies: ['LYD', 'USD', 'EUR', 'GBP', 'USDT'], kycVerified: true, kycStatus: 'APPROVED', totalTrades: 64, completedTrades: 63, completionRate: 98, createdAt: '2025-03-14T09:20:00.000Z' };
  };

  // ── live fiat ──
  const liveFiat = () => {
    const out = {};
    for (const [cur, per] of Object.entries(FX)) {
      if (cur === 'USD') continue;
      const chg = FX_CHG[cur] ?? 0;
      const usd = 1 / per;
      out[cur] = { usd, perUsd: per, change24hPct: chg, points: walk('lf' + cur, 24, usd, chg, cur === 'LYD' ? 0.0015 : 0.0006), source: cur === 'LYD' ? 'parallel_market' : 'international', asOf: ago(40_000) };
    }
    return out;
  };
  const rates = { ...BASE_RATES, ...FX };

  return {
    ME, user, P, full, wallets, walletRows, adjust, usdOf, activities, transactions, contactList, contactDetail, budgets, budgetFull, limits, notifications,
    threads, partners, conversations, offers, offersAll, trades, p2pThread, corridors, beneficiaries, makeQuote, remitTransfers, remitTimeline,
    cards, cardTxs, bankAccounts, devices, sessions, recurring, biz, claimPreview, claimMine, publicProfile, liveFiat, rates,
    // switches the capture scripts flip to stage specific states
    flags: { stepUpTransfer: false, stepUpPending: false },
  };
}

// ── HTTP router ─────────────────────────────────────────────────────────
let WORLD = createWorld('en');
export function setWorld(w) { WORLD = w; }
export function getWorld() { return WORLD; }

export function handleApi(method, path, q, body, ctx) {
  const W = WORLD; const ok = (json, extra = {}) => ({ json, ...extra });
  const seg = path.split('/').filter(Boolean);
  const M = method.toUpperCase();
  const is = (m, re) => M === m && re.test(path);

  // auth
  if (is('POST', /^\/auth\/login$/)) return ok({ user: { id: W.ME, email: W.user.email, firstName: W.user.firstName, lastName: W.user.lastName, username: W.user.username, avatarUrl: null, profilePublic: true, role: 'USER', kycStatus: 'APPROVED', twoFactorEnabled: true, referralCode: W.user.referralCode }, accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' });
  if (is('GET', /^\/auth\/me$/)) return ok({ user: W.user });
  if (is('POST', /^\/auth\/refresh$/)) return ok({ accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' });
  if (is('POST', /^\/auth\/2fa\/enable$/)) return ok({ secret: 'ILLUSTRATIVEONLY', otpauthUrl: 'otpauth://totp/tazdan:demo?secret=ILLUSTRATIVEONLY', qrCodeDataUrl: '' });
  if (M === 'POST' && seg[0] === 'auth') return ok({ message: 'ok' });

  // public/system
  if (is('GET', /^\/health$/)) return ok({ status: 'ok' });
  if (is('GET', /^\/features$/)) return ok({ features: { p2p: true, cards: true, altTrading: true } });
  if (is('GET', /^\/rates$/)) return ok({ rates: W.rates, base: 'USD' });
  if (is('GET', /^\/rates\/live$/)) return ok({ base: 'USD', asOf: new Date().toISOString(), currencies: W.liveFiat() });
  if (is('GET', /^\/rates\/history$/)) {
    const cur = (q.get('currency') || q.get('quote') || 'LYD').toUpperCase(); const per = FX[cur] ?? 1; const days = Number(q.get('days') || 30);
    const n = days * 3; const pts = walk('rh' + cur + days, n, per, -(FX_CHG[cur] ?? 0) * 6, cur === 'LYD' ? 0.003 : 0.001);
    return ok({ pair: `USD/${cur}`, base: 'USD', quote: cur, source: cur === 'LYD' ? 'parallel_market' : 'international', days, points: pts.map((c, i) => { const o = i ? pts[i - 1] : c; return { t: NOW - (n - i) * 8 * HOUR, o, h: Math.max(o, c) * 1.001, l: Math.min(o, c) * 0.999, c }; }) });
  }
  if (is('GET', /^\/exchange\/fx\/[A-Z]+\/[A-Z]+$/)) { const [, , b, qq] = seg; const mid = (FX[qq] ?? 1) / (FX[b] ?? 1); return ok({ base: b, quote: qq, buyPrice: (mid * 1.005).toFixed(6), sellPrice: (mid * 0.995).toFixed(6), source: 'fulus', fetchedAt: new Date(NOW - 40_000).toISOString() }); }
  if (is('GET', /^\/markets\/ticker$/)) return ok({ tickers: tickers() });
  if (is('GET', /^\/markets\/icons$/)) return ok(BASE_ICONS);
  if (is('GET', /^\/countries$/)) return ok(BASE_COUNTRIES);
  if (is('GET', /^\/countries\/[A-Z]+\/banks$/)) return ok({ banks: [] });
  if (is('GET', /^\/countries\/[A-Z]+\/payment-methods$/)) return ok({ methods: [] });
  if (is('GET', /^\/platform-banks$/)) return ok({ items: [] });
  if (is('GET', /^\/bank-accounts\/banks\//)) return ok({ banks: [] });
  if (is('GET', /^\/news/)) return ok({ articles: [], news: [], items: [] });
  if (is('GET', /^\/exchange\/spread$/)) return ok({ spreadPct: '0.025' });
  if (is('GET', /^\/exchange\/orders/)) return ok({ orders: [], total: 0 });
  if (is('GET', /^\/exchange\/search/)) return ok({ results: [] });
  if (is('GET', /^\/asset-discussions\//)) return ok({ posts: [] });

  // wallets
  if (is('GET', /^\/wallets$/)) return ok({ wallets: W.walletRows() });
  if (is('GET', /^\/wallet\/balances$/)) return ok({});
  if (is('GET', /^\/wallet\/addresses$/)) return ok({ eth: '0x7a3D9c4E1b52F0a6C8e1D3b4A5f6E7d8C9b0A1e2', btc: 'bc1qdemo7k2q9x4m8v3n5p6r0s1t2u3w4y5z6a7b8c', sol: 'DemoSo1AddressXq7k2q9x4m8v3n5p6r0s1t2u3w4', tron: 'TDemoTronAddrXq7k2q9x4m8v3n5p6r0s1' });
  if (is('GET', /^\/wallet\/deposit-address\//)) { const [, , , asset, network] = seg; return ok({ asset, network, address: network === 'BTC' ? 'bc1qdemo7k2q9x4m8v3n5p6r0s1t2u3w4y5z6a7b8c' : network === 'TRC20' ? 'TDemoTronAddrXq7k2q9x4m8v3n5p6r0s1' : '0x7a3D9c4E1b52F0a6C8e1D3b4A5f6E7d8C9b0A1e2', qr: '' }); }
  if (is('GET', /^\/wallets\/swap\/quote$/)) {
    const from = q.get('from'), to = q.get('to'), amount = Number(q.get('amount') || 0);
    const usd = W.usdOf(from, amount); const credited = PRICES[to] ? usd / PRICES[to].price : usd * (FX[to] ?? 1);
    return ok({ quote: { from, to, amount, credited: (credited * 0.995).toFixed(PRICES[to] && to !== 'USDT' ? 8 : 2), rate: (credited / (amount || 1)).toFixed(6), sources: ['fulus', 'live'], at: new Date().toISOString() } });
  }
  if (is('POST', /^\/wallets\/swap$/)) { const { from, to, amount } = body ?? {}; const usd = W.usdOf(from, amount); const credited = PRICES[to] ? usd / PRICES[to].price : usd * (FX[to] ?? 1); W.adjust(from, -amount); W.adjust(to, credited * 0.995); return ok({ swap: { from, to, amount, credited: credited * 0.995, rate: credited / amount } }); }

  if (is('GET', /^\/transactions$/)) return ok({ items: W.transactions, total: W.transactions.length, page: 1, totalPages: 1 });
  if (is('POST', /^\/transactions\/transfer$/)) {
    if (W.flags.stepUpTransfer && !body?.stepUpCode) return { status: 401, json: { error: 'Enter the 6-digit security code we sent to confirm this payment.', requiresStepUp: true, method: 'email' } };
    W.adjust(body.currency, -Number(body.amount));
    return ok({ message: 'Transfer completed', reference: 'TZ-DEMO-' + Math.random().toString(36).slice(2, 6).toUpperCase(), fee: '0' }, { delay: 700 });
  }
  if (is('GET', /^\/activities$/)) return ok({ items: W.activities, total: W.activities.length, page: 1, limit: 25, hasMore: false });

  // markets/exchange
  if (is('POST', /^\/exchange\/quote$/)) {
    const b = body ?? {}; const asset = b.asset || 'USDT'; const price = PRICES[asset]?.price ?? 1;
    const settle = b.side === 'SELL' ? (b.receiveCurrency || 'USD') : (b.fundingCurrency || 'USD');
    const perUsd = FX[settle] ?? 1; const spread = 0.025;
    let fiatAmount, cryptoAmount;
    const quoted = price * (b.side === 'SELL' ? 1 - spread : 1 + spread);
    if (b.fiatAmount) { fiatAmount = Number(b.fiatAmount); cryptoAmount = (fiatAmount / perUsd) / quoted; }
    else { cryptoAmount = Number(b.cryptoAmount || 0); fiatAmount = cryptoAmount * quoted * perUsd; }
    const usd = fiatAmount / perUsd; const platformFee = usd * 0.005;
    return ok({ quote: { id: 'cq_' + Math.random().toString(36).slice(2, 8), side: b.side || 'BUY', asset, network: b.network || 'TRC20', marketPrice: String(price), quotedPrice: quoted.toFixed(6), spreadPct: String(spread), settlementCurrency: settle, fiatAmount: usd.toFixed(2), cryptoAmount: cryptoAmount.toFixed(asset === 'USDT' ? 2 : 8), platformFee: platformFee.toFixed(2), networkFee: asset === 'USDT' ? '1.00' : '0.00', spreadCapture: (usd * spread).toFixed(2), settlementAmount: fiatAmount.toFixed(settle === 'LYD' ? 3 : 2), platformFeeSettlement: (platformFee * perUsd).toFixed(settle === 'LYD' ? 3 : 2), networkFeeSettlement: (asset === 'USDT' ? perUsd : 0).toFixed(settle === 'LYD' ? 3 : 2), totalUserPays: ((usd + platformFee + (asset === 'USDT' ? 1 : 0)) * perUsd).toFixed(settle === 'LYD' ? 3 : 2), expiresAt: Date.now() + 90_000 } });
  }
  if (is('POST', /^\/exchange\/execute$/)) return ok({ order: { id: 'ord_demo', status: 'FILLED' } }, { delay: 600 });
  if (is('GET', /^\/recurring-buys$/)) return ok({ recurringBuys: W.recurring });
  if (M !== 'GET' && seg[0] === 'recurring-buys') return ok({ recurringBuy: W.recurring[0], success: true });

  // budgets
  if (is('GET', /^\/budgets$/)) return ok({ budgets: W.budgets });
  if (is('POST', /^\/budgets$/)) { const b = body ?? {}; const nb = { id: 'bud_new', name: b.name, emoji: b.emoji ?? '🎯', currency: b.currency ?? 'LYD', balance: '0', targetAmount: b.targetAmount != null ? String(b.targetAmount) : null, targetDate: b.targetDate ?? null, lockType: b.lockType ?? 'NONE', unlockDate: b.unlockDate ?? null, autoEnabled: !!b.auto, autoAmount: b.auto ? String(b.auto.amount) : null, autoFrequency: b.auto?.frequency ?? null, status: 'ACTIVE', progressPct: 0, locked: false }; W.budgets.push(nb); return ok({ budget: W.budgetFull(nb) }, { delay: 500 }); }
  if (M === 'GET' && seg[0] === 'budgets' && seg[1]) { const b = W.budgets.find((x) => x.id === seg[1]) ?? W.budgets[0]; return ok({ budget: W.budgetFull(b) }); }
  if (M === 'POST' && seg[0] === 'budgets' && seg[2] === 'contribute') { const b = W.budgets.find((x) => x.id === seg[1]); if (b) { b.balance = (Number(b.balance) + Number(body?.amount || 0)).toFixed(b.currency === 'LYD' ? 3 : 2); if (b.targetAmount) b.progressPct = Math.round((Number(b.balance) / Number(b.targetAmount)) * 1000) / 10; } return ok({ budget: W.budgetFull(b ?? W.budgets[0]) }, { delay: 500 }); }
  if (seg[0] === 'budgets') return ok({ budget: W.budgetFull(W.budgets.find((x) => x.id === seg[1]) ?? W.budgets[0]) });

  // users
  if (is('GET', /^\/users\/me\/limits$/)) return ok(W.limits);
  if (is('GET', /^\/users\/kyc$/)) return ok({ kycStatus: 'APPROVED', kycTier: 'TIER_3', pendingUpgrade: null, rejectionReason: null, documents: [
    { id: 'doc1', documentType: 'PASSPORT', status: 'APPROVED', createdAt: dayAt(140, 12) }, { id: 'doc2', documentType: 'SELFIE', status: 'APPROVED', createdAt: dayAt(140, 12) },
    { id: 'doc3', documentType: 'PROOF_OF_ADDRESS', status: 'APPROVED', createdAt: dayAt(60, 12) }, { id: 'doc4', documentType: 'SOURCE_OF_FUNDS', status: 'APPROVED', createdAt: dayAt(19, 12) } ] });
  if (is('GET', /^\/users\/bank-accounts$/)) return ok({ bankAccounts: W.bankAccounts });
  if (is('GET', /^\/users\/me\/closure$/)) return ok({ canClose: true, blockers: [], retentionYears: 5 });

  // profile
  if (is('GET', /^\/profile\/me$/)) return ok({ profile: { id: W.ME, username: 'amira', profilePublic: true, bio: W.user.bio, acceptedCurrencies: ['LYD', 'USD', 'EUR', 'GBP', 'USDT'], baseCurrency: 'USD' } });
  if (is('GET', /^\/profile\/search$/)) {
    const qq = (q.get('q') || '').toLowerCase().replace(/^@/, '');
    const list = Object.values(W.P).filter((p) => p.username.startsWith(qq) || p.firstName.toLowerCase().startsWith(qq)).map((p) => ({ id: p.id, username: p.username, firstName: p.firstName, lastName: p.lastName, avatarUrl: undefined, kycTier: 'TIER_2' }));
    return ok({ profiles: list }, { delay: 120 });
  }
  if (M === 'GET' && seg[0] === 'profile' && seg[1] === 'by-id') { const pid = seg[2]; return ok({ user: W.partners[pid] ?? W.partners[W.P.omar.id] }); }
  if (M === 'GET' && seg[0] === 'profile' && (seg[1] === 'public' ? seg[2] : seg[1])) return ok({ profile: W.publicProfile(seg[1] === 'public' ? seg[2] : seg[1]) });
  if (seg[0] === 'profile') return ok({ profile: { id: W.ME, username: 'amira', profilePublic: true } });

  // contacts
  if (is('GET', /^\/contacts$/)) return ok({ contacts: W.contactList });
  if (M === 'GET' && seg[0] === 'contacts' && seg[1]) return ok(W.contactDetail(seg[1]));

  // notifications
  if (is('GET', /^\/notifications$/)) return ok({ notifications: W.notifications, total: W.notifications.length, unreadCount: W.notifications.filter((n) => !n.isRead).length, page: 1, pages: 1 });
  if (is('GET', /^\/notifications\/unread-count$/)) return ok({ count: W.notifications.filter((n) => !n.isRead).length });
  if (is('GET', /^\/notifications\/latest-announcement$/)) return ok({ notification: null });
  if (is('GET', /^\/notifications\/preferences$/)) return ok({ preferences: { transfers: true, deposits: true, p2p: true, security: true, marketing: false, priceAlerts: true } });
  if (seg[0] === 'notifications') return ok({ ok: true });

  // messages
  if (is('GET', /^\/messages\/conversations$/)) return ok({ conversations: W.conversations() });
  if (is('GET', /^\/messages\/privacy$/)) return ok({ privacy: { readReceiptsOn: true, lastSeenOn: true } });
  if (is('GET', /^\/messages\/blocks$/)) return ok({ blocks: [] });
  if (is('POST', /^\/messages$/)) {
    const b = body ?? {}; const m = { id: 'mx_' + Math.random().toString(36).slice(2, 8), senderId: W.ME, receiverId: b.receiverId, content: b.content, type: b.type || 'TEXT', metadata: b.metadata ? { ...b.metadata, status: b.type === 'PAYMENT' ? 'COMPLETED' : b.metadata.status, txRef: b.type === 'PAYMENT' ? 'TZ-DEMO-7Q' : undefined } : null, isRead: false, readAt: null, editedAt: null, deletedAt: null, tradeId: b.tradeId ?? null, createdAt: new Date().toISOString(), clientId: b.clientId ?? null };
    (W.threads[b.receiverId] ??= []).push(m); if (b.type === 'PAYMENT') W.adjust(b.metadata?.currency, -Number(b.metadata?.amount || 0));
    return ok({ message: m }, { delay: 450 });
  }
  if (M === 'POST' && seg[0] === 'messages') return ok({ ok: true });
  if (M === 'GET' && seg[0] === 'messages' && seg[1]) { const pid = seg[1]; if (pid === 'usr_rania') return ok({ messages: W.p2pThread }); return ok({ messages: W.threads[pid] ?? [] }); }

  // p2p
  if (is('GET', /^\/p2p\/offers$/)) { const near = q.get('near'); return ok({ offers: W.offers(q.get('side') || 'ALL', near) }); }
  if (is('GET', /^\/p2p\/listings\/mine$/)) return ok({ listings: [{ id: 'my_lst', side: 'SELL', currency: 'USDT', fiatCurrency: 'LYD', price: '7.150', amount: '1000', remainingAmount: '650', minLimit: '300', maxLimit: '5000', paymentMethods: ['CASH', 'BANK_TRANSFER'], anonymous: false, status: 'ACTIVE', createdAt: dayAt(3, 12) }] });
  if (is('GET', /^\/p2p\/trades$/)) return ok({ trades: W.trades });
  if (M === 'GET' && seg[0] === 'p2p' && seg[1] === 'trades' && seg[2]) return ok({ trade: W.trades.find((t) => t.id === seg[2]) ?? W.trades[0] });
  if (M === 'GET' && seg[0] === 'p2p' && seg[1] === 'offers' && seg[2]) return ok({ offer: W.offersAll.find((o) => o.id === seg[2]) ?? W.offersAll[0] });
  if (M !== 'GET' && seg[0] === 'p2p') return ok({ trade: W.trades[0], listing: {} });

  // cards
  if (is('GET', /^\/cards$/)) return ok({ cards: W.cards });
  if (is('GET', /^\/cards\/physical-fee$/)) return ok({ fee: 25, currency: 'USD', min: 20 });
  if (M === 'GET' && seg[0] === 'cards' && seg[2] === 'transactions') return ok({ transactions: W.cardTxs });
  if (seg[0] === 'cards') return ok({ card: W.cards[0], transaction: W.cardTxs[0] });

  // security
  if (is('GET', /^\/security\/devices$/)) return ok({ devices: W.devices });
  if (is('GET', /^\/security\/sessions$/)) return ok({ sessions: W.sessions });
  if (is('POST', /^\/security\/step-up\/start$/)) return ok({ method: 'email' });
  if (seg[0] === 'security') return ok({ ok: true });

  // remittance
  if (is('GET', /^\/remittance\/corridors$/)) return ok({ corridors: W.corridors });
  if (is('GET', /^\/remittance\/beneficiaries$/)) return ok({ beneficiaries: W.beneficiaries });
  if (is('POST', /^\/remittance\/quotes$/)) return ok({ quote: W.makeQuote(body?.corridorCode, Number(body?.sendAmount || 0)) }, { delay: 150 });
  if (is('POST', /^\/remittance\/transfers$/)) {
    const tr = { ...W.remitTransfers[0], id: 'rmt_new', reference: 'RM-LYGB-3017', state: 'COMPLIANCE_PENDING', createdAt: new Date().toISOString() };
    W.remitTransfers.unshift(tr); return ok({ transfer: tr, duplicate: false }, { delay: 700 });
  }
  if (is('GET', /^\/remittance\/transfers$/)) return ok({ transfers: W.remitTransfers });
  if (M === 'GET' && seg[0] === 'remittance' && seg[1] === 'transfers' && seg[2]) { const tr = W.remitTransfers.find((x) => x.id === seg[2]) ?? W.remitTransfers[0]; return ok({ transfer: tr, timeline: W.remitTimeline(tr) }); }

  // claim links
  if (M === 'GET' && seg[0] === 'claim-links' && seg[1] === 'by-token') return ok({ preview: W.claimPreview });
  if (is('GET', /^\/claim-links\/mine$/)) return ok({ items: W.claimMine, total: W.claimMine.length, page: 1, pages: 1 });
  if (M === 'POST' && seg[0] === 'claim-links') return ok({ link: { ...W.claimMine[0], claimUrl: 'https://tazdan.example/c/K7Q2', claimToken: 'demo' } });

  // business
  if (seg[0] === 'business') {
    const B = W.biz;
    if (is('GET', /^\/business\/profile$/)) return ok({ profile: B.profile });
    if (is('GET', /^\/business\/stats$/)) return ok({ stats: B.stats });
    if (is('GET', /^\/business\/invitations$/)) return ok({ invitations: [] });
    if (is('GET', /^\/business\/api-keys$/)) return ok({ keys: B.keys });
    if (is('GET', /^\/business\/team$/)) return ok({ members: B.team });
    if (is('GET', /^\/business\/webhooks$/)) return ok({ webhooks: [{ id: 'wh_1', url: 'https://hooks.example.com/tazdan', events: ['payout.completed', 'payout.failed'], status: 'ACTIVE', secret: 'whsec_••••', createdAt: dayAt(50, 12) }] });
    if (is('GET', /^\/business\/payouts$/)) { const lim = Number(q.get('limit') || 20); return ok({ payouts: B.payouts.slice(0, lim), total: B.payouts.length, page: 1, pages: 1 }); }
    if (is('GET', /^\/business\/batches$/)) return ok({ batches: B.batches.filter((b) => !q.get('status') || b.status === q.get('status')) });
    if (is('POST', /^\/business\/bulk-pay\/preview$/)) {
      const rec = body?.recipients ?? []; const total = rec.reduce((s, r) => s + Number(r.amount || 0), 0);
      return ok({ preview: { recipients: rec.length, totalAmount: total.toFixed(2), totalFee: (total * 0.005).toFixed(2), currency: body?.currency ?? 'LYD', valid: rec, invalid: [] } }, { delay: 400 });
    }
    if (is('POST', /^\/business\/bulk-pay$/)) return ok({ batchId: 'bat_1008', payouts: [], status: 'PENDING_APPROVAL', pendingApproval: true, complianceReview: false, approvalReason: 'Over the dual-approval threshold' }, { delay: 600 });
    if (M === 'POST' && seg[1] === 'batches') return ok({ batch: { ...B.batches[0], status: seg[3] === 'approve' ? 'EXECUTING' : 'REJECTED' } }, { delay: 500 });
    return ok({ ok: true });
  }

  // misc
  if (is('GET', /^\/deposits\/info\/payment-methods$/)) return ok({ paymentMethods: [] });
  if (is('GET', /^\/deposits$/)) return ok({ deposits: [], total: 0 });
  if (is('GET', /^\/withdrawals$/)) return ok({ withdrawals: [], total: 0 });
  if (is('GET', /^\/withdrawal\/history/)) return ok({ withdrawals: [], total: 0 });
  if (is('GET', /^\/export\/json/)) {
    const rows = W.walletRows();
    const txs = W.transactions.map((t) => ({ id: t.id, type: t.type, currency: t.currency, amount: String(t.amount), debit: Number(t.amount) < 0 ? String(-Number(t.amount)) : '0', credit: Number(t.amount) > 0 ? String(t.amount) : '0', fee: '0', balanceBefore: '0', balanceAfter: '0', valueUsd: W.usdOf(t.currency, Math.abs(Number(t.amount))).toFixed(2), reference: t.reference, description: t.description ?? null, source: t.reference?.startsWith('RB') ? 'RECURRING_BUY' : 'MANUAL', metadata: t.metadata ?? null, createdAt: t.createdAt }));
    const total = rows.reduce((s2, w) => s2 + Number(w.fiatValueUsd), 0);
    return ok({ user: { firstName: W.user.firstName, lastName: W.user.lastName, email: W.user.email, createdAt: W.user.createdAt, baseCurrency: 'USD' }, summary: { totalTransactions: 42, totalDeposits: 6, totalWithdrawals: 1, totalFees: 38.4, totalTransfersIn: 14, totalTransfersOut: 11, totalBuys: 7, totalSells: 1, totalRecurringBuys: 4, totalAccountValueUsd: total, totalFrozenUsd: 0 }, wallets: rows.map((w) => ({ currency: w.currency, balance: w.balance, frozen: '0', valueUsd: w.fiatValueUsd, priceUsd: String(W.usdOf(w.currency, 1)) })), recurringBuys: [], transactions: txs, valuation: { currency: 'USD', totalAccountValueUsd: total.toFixed(2), totalFrozenUsd: '0', prices: {}, pricedAt: new Date().toISOString() }, generatedAt: new Date().toISOString() });
  }
  if (is('GET', /^\/referrals?(\/|$)/)) return ok({ referrals: [], count: 3, earned: '15.00' });

  ctx?.unmatched?.add(M + ' ' + path);
  return ok({});
}
