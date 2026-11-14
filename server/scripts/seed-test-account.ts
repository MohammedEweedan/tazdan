#!/usr/bin/env ts-node
/**
 * Test account with a full history — for trying the app on a phone.
 *
 * Creates (or reuses) a fully verified customer plus three counterparts and
 * runs every customer feature through the real API, the same way the app
 * does: funding, conversions, crypto orders, sends, Pay, chat payments, claim
 * links, budgets, recurring buys, P2P, remittance, cards, withdrawals, LYDT
 * and referrals. Every balance therefore comes from real, balanced ledger
 * journals. Each step prints PASS or FAIL with the server's reason, so the
 * run doubles as an end-to-end check.
 *
 * Development only: refuses to run when NODE_ENV=production or against a
 * non-local API. Accounts use @tazdan.test addresses, which the mail service
 * never emails. Accounts have authenticator 2FA; the printed setup key goes
 * into an authenticator app for sign-in and payment approval on the phone.
 *
 * Usage (API running on :5001):
 *   npx ts-node --transpile-only scripts/seed-test-account.ts
 *   npx ts-node --transpile-only scripts/seed-test-account.ts --base=http://localhost:5001/api
 *   npx ts-node --transpile-only scripts/seed-test-account.ts --only=convert,crypto,lydt
 *
 * Re-running adds another round of history to the same accounts.
 */
/// <reference types="node" />
import 'dotenv/config';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { prisma } from '../src/utils/prisma';
import { generateTokens } from '../src/middleware/auth';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const BASE = arg('base') ?? 'http://localhost:5001/api';
const PASSWORD = arg('password') ?? 'TazdanTest#2026';
/** --only=convert,crypto,… re-runs just those sections (no new funding). */
const ONLY = arg('only')?.split(',').map((x) => x.trim());
const want = (section: string) => !ONLY || ONLY.includes(section);

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed test accounts in production.');
if (!/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(BASE)) throw new Error(`Refusing to seed a non-local API (${BASE}).`);

interface Persona { key: string; email: string; username: string; firstName: string; lastName: string; phone: string; accountType?: 'PERSONAL' | 'BUSINESS' }
const PERSONAS: Persona[] = [
  { key: 'main', email: 'tester@tazdan.test', username: 'qa.tester', firstName: 'Test', lastName: 'Account', phone: '+218910000001' },
  { key: 'layla', email: 'layla@tazdan.test', username: 'layla.qa', firstName: 'Layla', lastName: 'Mansour', phone: '+218910000002' },
  { key: 'omar', email: 'omar@tazdan.test', username: 'omar.qa', firstName: 'Omar', lastName: 'Trader', phone: '+218910000003' },
  { key: 'souk', email: 'souk@tazdan.test', username: 'souk.qa', firstName: 'Souk', lastName: 'Tripoli', phone: '+218910000004', accountType: 'BUSINESS' },
];

interface Actor { id: string; email: string; role: string; username: string; token: string; secret: string; device: string; lastCode?: string }
const actors: Record<string, Actor> = {};
let admin: { id: string; email: string; role: string; token: string };

// ── HTTP ─────────────────────────────────────────────────────────────

const results: Array<{ feature: string; step: string; ok: boolean; detail: string }> = [];
const idem = (p: string) => `${p}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function totp(a: Actor): Promise<string> {
  let code = speakeasy.totp({ secret: a.secret, encoding: 'base32' });
  // A code is accepted once; wait for the next 30-second window if it was just used.
  while (code === a.lastCode) {
    await sleep(2000);
    code = speakeasy.totp({ secret: a.secret, encoding: 'base32' });
  }
  a.lastCode = code;
  return code;
}

async function http(method: string, path: string, opts: { as?: Actor | 'admin'; body?: any; stepUp?: boolean } = {}): Promise<any> {
  const who = opts.as === 'admin' ? admin : opts.as;
  const send = async (body: any) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-simulator': 'true',
        'user-agent': 'tazdan-seed/1.0',
        ...(who ? { authorization: `Bearer ${who.token}` } : {}),
        ...(who && 'device' in who ? { 'x-device-id': (who as Actor).device } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 200) }; }
    return { status: res.status, data };
  };
  let r = await send(opts.body);
  // Step-up: answer with the authenticator code and resubmit, as the app does.
  if (r.status === 401 && (r.data?.code === 'STEP_UP_REQUIRED' || r.data?.requiresStepUp) && who && 'secret' in who && opts.stepUp !== false) {
    r = await send({ ...(opts.body ?? {}), stepUpCode: await totp(who as Actor) });
    // A code near the end of its window, or one already used, is refused: wait for a fresh one.
    if (r.status === 401 && /security code/i.test(JSON.stringify(r.data))) {
      await sleep((30 - (Math.floor(Date.now() / 1000) % 30) + 1) * 1000);
      r = await send({ ...(opts.body ?? {}), stepUpCode: await totp(who as Actor) });
    }
  }
  if (r.status >= 400) {
    const msg = typeof r.data?.error === 'string' ? r.data.error : r.data?.error?.message ?? r.data?.message ?? JSON.stringify(r.data).slice(0, 300);
    const err = new Error(`${r.status} ${msg}`) as Error & { status: number; data: any };
    err.status = r.status; err.data = r.data;
    throw err;
  }
  return r.data;
}

async function step<T>(feature: string, name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const out = await fn();
    results.push({ feature, step: name, ok: true, detail: '' });
    console.log(`  \x1b[32mPASS\x1b[0m ${feature} · ${name}`);
    return out;
  } catch (e: any) {
    results.push({ feature, step: name, ok: false, detail: e?.message ?? String(e) });
    console.log(`  \x1b[31mFAIL\x1b[0m ${feature} · ${name} — ${e?.message ?? e}`);
    return null;
  }
}

// ── Accounts ─────────────────────────────────────────────────────────

async function ensureUser(p: Persona, referralCode?: string): Promise<Actor> {
  let user = await prisma.user.findUnique({ where: { email: p.email } });
  if (!user) {
    await http('POST', '/auth/register', {
      body: {
        email: p.email, password: PASSWORD, firstName: p.firstName, lastName: p.lastName, username: p.username,
        country: 'LY', phoneCountryCode: '218', phone: p.phone.replace('+218', ''), dateOfBirth: '1992-04-18',
        ...(referralCode ? { referralCode } : {}),
        ...(p.accountType === 'BUSINESS' ? { accountType: 'BUSINESS', businessProfile: { companyName: 'Souk Tripoli Coffee', legalName: 'Souk Tripoli Coffee LLC', country: 'LY', industry: 'Food & drink', employeeCount: '1-10', useCase: 'Accept payments in the shop' } } : {}),
      },
    }).catch((e) => { throw new Error(`register ${p.email}: ${e.message}`); });
    user = await prisma.user.findUniqueOrThrow({ where: { email: p.email } });
  }
  // Identity fixtures: a fully verified Libyan customer (no money moves here).
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      status: 'ACTIVE', country: 'LY', emailVerified: true, phone: p.phone, phoneVerified: true,
      kycStatus: 'APPROVED', kycTier: 'TIER_3', ...(p.accountType ? { accountType: p.accountType } : {}),
    } as any,
  });
  const token = generateTokens({ id: user.id, email: user.email, role: user.role } as any).accessToken;
  const actor: Actor = { id: user.id, email: user.email, role: user.role, username: user.username ?? p.username, token, secret: '', device: `seed-${p.key}-device` };
  // Authenticator 2FA (step-up codes come from it, never from email).
  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    const setup = await http('POST', '/auth/2fa/enable', { as: actor });
    actor.secret = setup.secret;
    await http('POST', '/auth/2fa/verify', { as: actor, body: { code: await totp(actor), password: PASSWORD } });
  } else {
    actor.secret = user.twoFactorSecret;
  }
  return actor;
}

async function balances(a: Actor): Promise<Record<string, number>> {
  const ws = await prisma.wallet.findMany({ where: { userId: a.id } });
  return Object.fromEntries(ws.map((w) => [w.currency, Number(w.balance) - Number(w.frozen)]));
}

// ── Run ──────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeeding test accounts against ${BASE}\n`);
  await http('GET', '/features').catch(() => { throw new Error(`API not reachable at ${BASE}`); });

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN', email: 'admin@exchange.ly' } })
    ?? await prisma.user.findFirstOrThrow({ where: { role: 'ADMIN', staffRoles: { has: 'SUPER_ADMIN' } } });
  admin = { id: adminUser.id, email: adminUser.email, role: 'ADMIN', token: generateTokens({ id: adminUser.id, email: adminUser.email, role: 'ADMIN' } as any).accessToken };

  console.log('Accounts');
  const main = await ensureUser(PERSONAS[0]);
  const mainCode = (await prisma.user.findUniqueOrThrow({ where: { id: main.id }, select: { referralCode: true } })).referralCode;
  actors.main = main;
  for (const p of PERSONAS.slice(1)) actors[p.key] = await ensureUser(p, p.key === 'layla' ? mainCode ?? undefined : undefined);
  const { layla, omar, souk } = actors;
  console.log(`  main ${main.id} · layla ${layla.id} · omar ${omar.id} · souk ${souk.id}`);

  // Merchant: KYB-approved business so Pay shows its trading name.
  await step('Pay', 'merchant KYB fixture', async () => {
    const existing = await prisma.businessProfile.findFirst({ where: { userId: souk.id } });
    if (!existing) throw new Error('business profile missing after registration');
    await prisma.businessProfile.update({ where: { id: existing.id }, data: { kybStatus: 'APPROVED', tradingName: 'Souk Tripoli', kybReviewedAt: new Date() } as any });
  });

  if (want('funding')) {
  console.log('\nFunding (dev admin credit, balanced ledger entry)');
  const credits: Array<[Actor, string, number]> = [
    [main, 'LYD', 25000], [main, 'USD', 3000], [main, 'USDT', 1500], [main, 'EUR', 800], [main, 'BTC', 0.02], [main, 'ETH', 0.4],
    [layla, 'LYD', 4000], [layla, 'USD', 500], [omar, 'USDT', 3000], [omar, 'LYD', 6000], [souk, 'LYD', 1000],
  ];
  for (const [a, currency, amount] of credits) {
    await step('Funding', `${a === main ? 'tester' : a.username} +${amount} ${currency}`, () => http('POST', '/admin/seed-balance', { as: 'admin', body: { userId: a.id, currency, amount } }));
  }
  }

  if (want('convert')) {
  console.log('\nConvert currencies');
  for (const [from, to, amount] of [['LYD', 'USD', 700], ['USD', 'EUR', 120], ['USD', 'LYD', 150], ['EUR', 'GBP', 60]] as Array<[string, string, number]>) {
    await step('Convert', `${amount} ${from} → ${to}`, async () => {
      const q = await http('GET', `/wallets/swap/quote?from=${from}&to=${to}&amount=${amount}`, { as: main });
      const min = (Number(q.quote.credited) * 0.98).toFixed(8);
      return http('POST', '/wallets/swap', { as: main, body: { from, to, amount, minCredited: min } });
    });
  }
  }

  if (want('crypto')) {
  console.log('\nBuy and sell crypto');
  const order = async (side: 'BUY' | 'SELL', asset: string, network: string, amount: number, currency: string) => {
    const q = await http('POST', '/exchange/quote', {
      as: main,
      body: side === 'BUY' ? { asset, network, side, fiatAmount: amount, fundingCurrency: currency } : { asset, network, side, cryptoAmount: amount, receiveCurrency: currency },
    });
    const quoteId = q.quote?.id ?? q.quoteId ?? q.id;
    return http('POST', '/exchange/execute', { as: main, body: { quoteId, confirmedByUser: true, idempotencyKey: idem('ord'), fundingCurrency: side === 'BUY' ? currency : undefined } });
  };
  // Dev databases carry stress-test fills; give test orders room above the existing position.
  const principal = await http('GET', '/cockpit/treasury/principal', { as: 'admin' }).catch(() => null);
  for (const asset of ['ETH', 'TOTAL']) {
    const now = asset === 'TOTAL' ? Number(principal?.totalExposureUsd ?? 0) : Number((principal?.positions ?? []).find((x: any) => x.asset === asset)?.exposureUsd ?? 0);
    const limitUsd = Math.min(10_000_000, Math.ceil((Math.abs(now) * 1.5 + 250_000) / 1000) * 1000);
    await step('Crypto', `dev principal limit ${asset} → $${limitUsd.toLocaleString()}`, () => http('PUT', '/cockpit/treasury/principal/limits', { as: 'admin', body: { asset, limitUsd, reason: 'Local test environment: room for test orders above stress-test fills' } }));
  }
  await step('Crypto', 'buy ETH with 200 USD', () => order('BUY', 'ETH', 'ERC20', 200, 'USD'));
  await step('Crypto', 'buy ETH with 300 LYD', () => order('BUY', 'ETH', 'ERC20', 300, 'LYD'));
  await step('Crypto', 'sell 0.03 ETH for USD', () => order('SELL', 'ETH', 'ERC20', 0.03, 'USD'));
  await step('Crypto', 'buy BTC with 150 USD', () => order('BUY', 'BTC', 'BTC', 150, 'USD'));
  }

  if (want('send')) {
  console.log('\nSend money');
  const send = (from: Actor, to: Actor, currency: string, amount: number, note: string) =>
    http('POST', '/transactions/transfer', { as: from, body: { receiverId: to.id, currency, amount, note, idempotencyKey: idem('trf') } });
  await step('Send', 'tester → Layla 150 LYD', () => send(main, layla, 'LYD', 150, 'Dinner last night'));
  await step('Send', 'Layla → tester 40 LYD', () => send(layla, main, 'LYD', 40, 'My half of the taxi'));
  await step('Send', 'tester → Layla 25 USD', () => send(main, layla, 'USD', 25, 'Gift'));
  await step('Send', 'high-value send with step-up (2,500 LYD)', () => send(main, omar, 'LYD', 2500, 'Rent share'));
  }

  if (want('pay')) {
  console.log('\nPay (merchant)');
  await step('Pay', 'look up @souk.qa', () => http('GET', `/pay/payee/${souk.username}`, { as: main }));
  await step('Pay', 'pay Souk Tripoli 18.5 LYD', () => send(main, souk, 'LYD', 18.5, 'Coffee and pastries'));
  await step('Pay', 'pay Souk Tripoli 42 LYD', () => send(main, souk, 'LYD', 42, 'Lunch'));
  }

  if (want('chat')) {
  console.log('\nChat');
  const say = (from: Actor, to: Actor, content: string) => http('POST', '/messages', { as: from, body: { receiverId: to.id, content, clientId: idem('msg') } });
  await step('Chat', 'conversation with Layla', async () => {
    await say(main, layla, 'Salam Layla! Are we still on for Friday?');
    await say(layla, main, 'Yes! I booked the table for 8.');
    await say(main, layla, 'Perfect, I will send my share now.');
  });
  await step('Chat', 'payment in chat 60 LYD', () => http('POST', '/messages', {
    as: main, body: { receiverId: layla.id, type: 'PAYMENT', content: 'Friday dinner', metadata: { amount: 60, currency: 'LYD' }, clientId: idem('pay') },
  }));
  await step('Chat', 'conversation with Omar', async () => {
    await say(omar, main, 'Your USDT order is ready whenever you are.');
    await say(main, omar, 'Thanks Omar, sending the dinars now.');
  });
  }

  if (want('claims')) {
  console.log('\nClaim links');
  const claim = await step('Claim links', 'create 20 USDT link', () => http('POST', '/claim-links', { as: main, body: { asset: 'USDT', amount: 20, note: 'Welcome gift', expiresInDays: 7, recipientHandle: layla.username } }));
  const token = claim?.link?.claimToken ?? claim?.claimToken ?? claim?.token ?? claim?.link?.token;
  if (token) await step('Claim links', 'Layla claims it', () => http('POST', `/claim-links/by-token/${token}/claim`, { as: layla, body: {} }));
  await step('Claim links', 'create 10 USDT link for Omar (left open)', () => http('POST', '/claim-links', { as: main, body: { asset: 'USDT', amount: 10, note: 'For the quiz winner', expiresInDays: 14, recipientHandle: omar.username } }));
  await step('Claim links', 'create and cancel a link', async () => {
    const c = await http('POST', '/claim-links', { as: main, body: { asset: 'USDT', amount: 5, expiresInDays: 3, recipientHandle: layla.username } });
    const id = c?.link?.id ?? c?.id;
    return http('POST', `/claim-links/${id}/cancel`, { as: main, body: { reason: 'Sent by mistake' } });
  });
  }

  if (want('budgets')) {
  console.log('\nBudget wallets');
  const hajj = await step('Budgets', 'create “Umrah fund” (LYD, target 9,000)', () => http('POST', '/budgets', {
    as: main, body: { name: 'Umrah fund', emoji: '🕋', currency: 'LYD', targetAmount: 9000, lockType: 'NONE', auto: { amount: 150, frequency: 'WEEKLY' } },
  }));
  const hajjId = hajj?.budget?.id ?? hajj?.id;
  if (hajjId) {
    await step('Budgets', 'contribute 1,200 LYD', () => http('POST', `/budgets/${hajjId}/contribute`, { as: main, body: { amount: 1200 } }));
    await step('Budgets', 'contribute 300 LYD', () => http('POST', `/budgets/${hajjId}/contribute`, { as: main, body: { amount: 300 } }));
  }
  const rainy = await step('Budgets', 'create “Emergency” (USD, date lock)', () => http('POST', '/budgets', {
    as: main, body: { name: 'Emergency', emoji: '🛟', currency: 'USD', targetAmount: 1000, lockType: 'DATE', unlockDate: new Date(Date.now() + 90 * 86400_000).toISOString() },
  }));
  const rainyId = rainy?.budget?.id ?? rainy?.id;
  if (rainyId) await step('Budgets', 'contribute 250 USD', () => http('POST', `/budgets/${rainyId}/contribute`, { as: main, body: { amount: 250 } }));
  if (hajjId) await step('Budgets', 'withdraw 100 LYD from Umrah fund', () => http('POST', `/budgets/${hajjId}/withdraw`, { as: main, body: { amount: 100 } }));
  }

  if (want('recurring')) {
  console.log('\nRecurring buys');
  await step('Recurring', 'weekly 25 USD of BTC', () => http('POST', '/recurring-buys', { as: main, body: { asset: 'BTC', network: 'BTC', fiatCurrency: 'USD', fiatAmount: 25, frequency: 'WEEKLY', sourceType: 'WALLET' } }));
  await step('Recurring', 'monthly 100 LYD of ETH', () => http('POST', '/recurring-buys', { as: main, body: { asset: 'ETH', network: 'ERC20', fiatCurrency: 'LYD', fiatAmount: 100, frequency: 'MONTHLY', sourceType: 'WALLET' } }));
  }

  if (want('p2p')) {
  console.log('\nP2P');
  const listing = await step('P2P', 'Omar lists 500 USDT for LYD', () => http('POST', '/p2p/listings', {
    as: omar, body: { currency: 'USDT', fiatCurrency: 'LYD', side: 'SELL', price: 9.6, amount: 500, minLimit: 50, maxLimit: 4800, paymentMethods: ['BANK_TRANSFER', 'CASH'], terms: 'Bank transfer within 30 minutes.', city: 'Tripoli', timeframeMins: 30 },
  }));
  const listingId = listing?.listing?.id ?? listing?.id;
  if (listingId) {
    const trade = await step('P2P', 'tester buys 40 USDT', () => http('POST', '/p2p/trades', { as: main, body: { listingId, amount: 40, paymentMethod: 'BANK_TRANSFER', note: 'Sending from Jumhouria bank' } }));
    const tradeId = trade?.trade?.id ?? trade?.id;
    if (tradeId) {
      await step('P2P', 'buyer marks payment sent', () => http('PUT', `/p2p/trades/${tradeId}/payment-sent`, { as: main }));
      await step('P2P', 'seller confirms and releases', () => http('PUT', `/p2p/trades/${tradeId}/confirm`, { as: omar }));
    }
    const second = await step('P2P', 'second trade (cancelled by buyer)', async () => {
      const t = await http('POST', '/p2p/trades', { as: main, body: { listingId, amount: 10, paymentMethod: 'CASH' } });
      return http('PUT', `/p2p/trades/${t?.trade?.id ?? t?.id}/cancel`, { as: main });
    });
    void second;
  }
  await step('P2P', 'tester lists a BUY order for USDT', () => http('POST', '/p2p/listings', {
    as: main, body: { currency: 'USDT', fiatCurrency: 'LYD', side: 'BUY', price: 9.5, amount: 100, minLimit: 50, maxLimit: 950, paymentMethods: ['BANK_TRANSFER'], city: 'Tripoli' },
  }));
  }

  if (want('remittance')) {
  console.log('\nInternational transfer');
  const corridors = await step('Remittance', 'list corridors', () => http('GET', '/remittance/corridors', { as: main }));
  const corridor = (corridors?.corridors ?? corridors ?? []).find?.((c: any) => c.sourceCurrency === 'LYD') ?? null;
  if (corridor) {
    const ben = await step('Remittance', `add beneficiary (${corridor.destCountry ?? corridor.code})`, () => http('POST', '/remittance/beneficiaries', {
      as: main, body: {
        fullName: 'Amira Test', relationship: 'Sister', country: (corridor.destCountry ?? 'GB').slice(0, 2), currency: corridor.destCurrency,
        payoutMethod: 'BANK_ACCOUNT', bankName: 'Test Bank', accountNumber: '12345678', city: 'Test City',
        // Published example IBANs (valid checksums, no real account).
        ...(({ AE: { iban: 'AE070331234567890123456' }, GB: { iban: 'GB29NWBK60161331926819', sortCode: '601613' }, TR: { iban: 'TR330006100519786457841326' }, TN: { iban: 'TN5910006035183598478831' } } as Record<string, object>)[(corridor.destCountry ?? 'GB').slice(0, 2)] ?? {}),
      },
    }));
    const benId = ben?.beneficiary?.id ?? ben?.id;
    if (benId) {
      await step('Remittance', `send 900 LYD on ${corridor.code}`, async () => {
        const q = await http('POST', '/remittance/quotes', { as: main, body: { corridorCode: corridor.code, sendAmount: 900, beneficiaryId: benId, payoutMethod: 'BANK_ACCOUNT' } });
        const quoteId = q?.quote?.id ?? q?.id;
        return http('POST', '/remittance/transfers', { as: main, body: { quoteId, beneficiaryId: benId, purpose: 'FAMILY_SUPPORT', sourceOfFunds: 'Salary', idempotencyKey: idem('rmt') } });
      });
    }
  } else {
    results.push({ feature: 'Remittance', step: 'corridor from LYD', ok: false, detail: 'No LYD corridor configured in this database' });
  }
  }

  if (want('cards')) {
  console.log('\nCards');
  const card = await step('Cards', 'issue a virtual USD card', () => http('POST', '/cards', { as: main, body: { tier: 'STARTER', nickname: 'Online shopping', currency: 'USD' } }));
  const cardId = card?.card?.id ?? card?.id;
  if (cardId) {
    await step('Cards', 'top up 120 USD', () => http('POST', `/cards/${cardId}/topup`, { as: main, body: { amount: 120, currency: 'USD' } }));
    await step('Cards', 'purchase 23.99 at Amazon', () => http('POST', `/cards/${cardId}/transactions`, { as: main, body: { merchant: 'Amazon', category: 'Shopping', country: 'US', amount: 23.99, type: 'PURCHASE' } }));
    await step('Cards', 'purchase 9.99 at Spotify', () => http('POST', `/cards/${cardId}/transactions`, { as: main, body: { merchant: 'Spotify', category: 'Subscriptions', country: 'SE', amount: 9.99, type: 'PURCHASE' } }));
    await step('Cards', 'freeze and unfreeze', async () => { await http('POST', `/cards/${cardId}/freeze`, { as: main }); return http('POST', `/cards/${cardId}/unfreeze`, { as: main }); });
  }
  }

  if (want('money')) {
  console.log('\nTop up and withdraw');
  await step('Top up', 'card top-up quote 50 USD → USDT', async () => {
    const q = await http('POST', '/deposits/gateway/quote', { as: main, body: { fiatCurrency: 'USD', fiatAmount: 50, cryptoCurrency: 'USDT', paymentMethod: 'CARD' } });
    const providerRef = q?.quote?.providerRef ?? q?.providerRef ?? q?.quote?.id;
    return http('POST', '/deposits/gateway/confirm', { as: main, body: { providerRef, fiatCurrency: 'USD', fiatAmount: 50, cryptoCurrency: 'USDT', idempotencyKey: idem('onr') } });
  });
  const wd = await step('Withdraw', 'bank withdrawal 300 LYD', () => http('POST', '/withdrawals', {
    as: main, body: { currency: 'LYD', amount: 300, paymentMethod: 'BANK_TRANSFER', bankName: 'Jumhouria Bank', accountNumber: '0011223344', accountName: 'Test Account' },
  }));
  const wdId = wd?.withdrawal?.id ?? wd?.id;
  if (wdId) await step('Withdraw', 'operations processes it', () => http('PUT', `/admin/withdrawals/${wdId}/process`, { as: 'admin', body: { txHash: undefined, note: 'Paid by bank transfer' } }));
  await step('Withdraw', 'withdrawal requested then cancelled', async () => {
    const w = await http('POST', '/withdrawals', { as: main, body: { currency: 'LYD', amount: 120, paymentMethod: 'BANK_TRANSFER', bankName: 'Wahda Bank', accountNumber: '9988776655', accountName: 'Test Account' } });
    return http('PUT', `/withdrawals/${w?.withdrawal?.id ?? w?.id}/cancel`, { as: main });
  });
  }

  if (want('lydt')) {
  console.log('\nLYDT dinar token (sandbox)');
  await step('LYDT', 'reserve statement (supervisor)', () => http('POST', '/cockpit/lydt/attestations', { as: 'admin', body: { balance: 5_000_000, reference: idem('TEST-STATEMENT'), statementDate: new Date(Date.now() - 60_000).toISOString() } }));
  await step('LYDT', 'issue 500 LYDT', () => http('POST', '/lydt/issue', { as: main, body: { amount: 500, idempotencyKey: idem('lydt-i') } }));
  await step('LYDT', 'send 50 LYDT to Layla', () => http('POST', '/lydt/transfer', { as: main, body: { receiverId: layla.id, amount: 50, idempotencyKey: idem('lydt-t') } }));
  await step('LYDT', 'redeem 100 LYDT', () => http('POST', '/lydt/redeem', { as: main, body: { amount: 100, idempotencyKey: idem('lydt-r') } }));
  }

  console.log('\nReferrals and account');
  await step('Referrals', 'referral dashboard (Layla joined with this code)', () => http('GET', '/referrals/dashboard', { as: main }));
  await step('Notifications', 'notifications exist', async () => {
    const n = await http('GET', '/notifications', { as: main });
    const count = (n?.notifications ?? n?.items ?? []).length;
    if (!count) throw new Error('no notifications');
    return count;
  });
  await step('History', 'transaction history', async () => {
    const t = await http('GET', '/transactions?limit=100', { as: main });
    const count = (t?.transactions ?? t?.items ?? []).length;
    if (count < 10) throw new Error(`only ${count} transactions`);
    return count;
  });

  // ── Report ──
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\n${pass} passed, ${fail.length} failed`);
  for (const f of fail) console.log(`  FAIL ${f.feature} · ${f.step}: ${f.detail}`);
  console.log('\nBalances (available):', await balances(main));
  console.log(`\nSign in on the phone:\n  email     ${main.email}\n  password  ${PASSWORD}\n  2FA key   ${main.secret}\n  otpauth://totp/tazdan:${encodeURIComponent(main.email)}?secret=${main.secret}&issuer=tazdan`);
  const fs = await import('fs');
  fs.writeFileSync(`${__dirname}/../seed-test-account.result.json`, JSON.stringify({ at: new Date().toISOString(), base: BASE, account: { email: main.email, password: PASSWORD, totpSecret: main.secret, id: main.id }, results }, null, 2));
}

main()
  .catch((e) => { console.error('\nSeed failed:', e?.message ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
