/**
 * Comprehensive platform seed.
 *
 * Idempotent: re-running upserts users, wipes the demo user's transactional
 * data, and re-creates a realistic snapshot. Safe to run repeatedly during
 * development — it never deletes the admin or non-demo users.
 *
 * Run with:
 *   cd server && npm run seed
 *
 * Seeds:
 *   - Admin user                 (admin@exchange.ly  / Admin123!@#)
 *   - Demo user "Rayan Zahi"     (rayan@Fortuni.app / Demo123!)
 *   - 4 fake P2P trader users    (so the marketplace has variety)
 *   - Wallets w/ realistic balances for the demo user
 *   - Recent transactions
 *   - 2 issued cards (PRO + MASTER)
 *   - A handful of P2P listings across multiple fiats / cryptos
 *   - Notifications
 *   - Exchange rates + market listings (covered already by utils/seed.ts on boot)
 */

import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { PrismaClient, Currency, OrderSide } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'rayan@Fortuni.app';
const DEMO_PASSWORD = 'Demo123!';

/* ── Helpers ───────────────────────────────────────────────── */

async function upsertUser(opts: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username?: string;
  country?: string;
  role?: 'USER' | 'ADMIN';
}) {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(opts.password, 12);
  const referralCode = `REF${uuid().slice(0, 8).toUpperCase()}`;

  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      firstName: opts.firstName,
      lastName: opts.lastName,
      username: opts.username,
      country: opts.country,
      role: opts.role ?? 'USER',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycTier: 'TIER_2',
      emailVerified: true,
      referralCode,
    },
  });
}

async function setWallet(userId: string, currency: Currency, balance: number) {
  await prisma.wallet.upsert({
    where:  { userId_currency: { userId, currency } },
    update: { balance, frozen: 0 },
    create: { userId, currency, balance, frozen: 0 },
  });
}

/* ── Seed body ─────────────────────────────────────────────── */

async function main() {
  console.log('🌱 Seeding platform data...');

  /* ── Admin (idempotent — utils/seed.ts also handles this on boot) ── */
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@exchange.ly';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!@#';
  const adminUser = await upsertUser({
    email: adminEmail,
    password: adminPassword,
    firstName: 'Admin',
    lastName:  'Exchange',
    role: 'ADMIN',
  });
  console.log('✓ Admin:', adminUser.email);

  /* ── Demo user ─────────────────────────────────────────── */
  const demo = await upsertUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    firstName: 'Rayan',
    lastName: 'Zahi',
    username: 'rayofsunshine',
    country: 'AE',
  });
  console.log('✓ Demo user:', demo.email, '(password:', DEMO_PASSWORD + ')');

  /* ── Fake traders for the P2P marketplace ─────────────── */
  const traders = await Promise.all([
    upsertUser({ email: 'sami@trader.ae',   password: 'TraderPass1!', firstName: 'Sami',   lastName: 'AlMarri',  username: 'trader.uae',     country: 'AE' }),
    upsertUser({ email: 'khalid@fast.sa',   password: 'TraderPass1!', firstName: 'Khalid', lastName: 'AlSaud',   username: 'fast.sa',        country: 'SA' }),
    upsertUser({ email: 'lina@global.eg',   password: 'TraderPass1!', firstName: 'Lina',   lastName: 'Mahmoud',  username: 'global.trader',  country: 'EG' }),
    upsertUser({ email: 'omar@quickly.eg',  password: 'TraderPass1!', firstName: 'Omar',   lastName: 'Hassan',   username: 'quickly',        country: 'EG' }),
    upsertUser({ email: 'maya@swift.gb',    password: 'TraderPass1!', firstName: 'Maya',   lastName: 'Patel',    username: 'swift.uk',       country: 'GB' }),
  ]);
  console.log(`✓ ${traders.length} fake traders`);

  /* ── Demo wallets ──────────────────────────────────────── */
  const balances: Array<[Currency, number]> = [
    ['USDT', 41_120],
    ['BTC',     0.314],
    ['ETH',     4.82],
    ['SOL',    85.6],
    ['BNB',     6.2],
    ['XRP',  2_500],
    ['ADA',  3_200],
    ['DOGE', 9_800],
    ['USD', 11_444.28],
    ['EUR',  8_200],
    ['GBP',  2_200],
    ['AED', 38_000],
    ['SAR', 18_500],
    ['EGP', 42_000],
    ['LYD',  6_800],
  ];
  for (const [cur, amt] of balances) await setWallet(demo.id, cur, amt);
  console.log(`✓ ${balances.length} wallets seeded for demo user`);

  // Also give each trader a token bag so escrow can be funded
  for (const t of traders) {
    await setWallet(t.id, 'USDT', 50_000);
    await setWallet(t.id, 'BTC', 1.2);
    await setWallet(t.id, 'ETH', 12);
  }

  /* ── Demo transaction history ──────────────────────────── */
  await prisma.transaction.deleteMany({ where: { userId: demo.id } });
  const now = Date.now();
  const min = (m: number) => new Date(now - m * 60_000);

  const txs = [
    { type: 'TRANSFER_IN' as const,    currency: 'USDT' as Currency, amount: 1114.20,  ref: 'TX-001', desc: 'From @moe.ali',    minutes: 0 },
    { type: 'BUY' as const,            currency: 'BTC'  as Currency, amount: 0.0123,   ref: 'TX-002', desc: 'Market buy',       minutes: 8 },
    { type: 'TRANSFER_OUT' as const,   currency: 'USDT' as Currency, amount: -280.00,  ref: 'TX-003', desc: 'To @rahma.a',      minutes: 34 },
    { type: 'WITHDRAWAL' as const,     currency: 'USDT' as Currency, amount: -42.50,   ref: 'TX-004', desc: 'Apple iCloud+',    minutes: 120 },
    { type: 'DEPOSIT' as const,        currency: 'USD'  as Currency, amount: 500.00,   ref: 'TX-005', desc: 'Visa •• 4421',     minutes: 180 },
    { type: 'BUY' as const,            currency: 'USDT' as Currency, amount: 5_000.00, ref: 'TX-006', desc: 'P2P AED→USDT',     minutes: 360 },
    { type: 'WITHDRAWAL' as const,     currency: 'USDT' as Currency, amount: -1_200,   ref: 'TX-007', desc: 'TRC20 withdrawal', minutes: 720 },
    { type: 'COMMISSION' as const,     currency: 'USDT' as Currency, amount: 3.20,     ref: 'TX-008', desc: '1% cashback',      minutes: 1_440 },
  ];
  for (const t of txs) {
    await prisma.transaction.create({
      data: {
        userId: demo.id,
        type: t.type,
        currency: t.currency,
        amount: t.amount,
        balanceBefore: 0,
        balanceAfter:  0,
        reference: t.ref,
        description: t.desc,
        createdAt: min(t.minutes),
      },
    });
  }
  console.log(`✓ ${txs.length} transactions seeded`);

  /* ── Cards ──────────────────────────────────────────────── */
  await prisma.cardTransaction.deleteMany({ where: { userId: demo.id } });
  await prisma.card.deleteMany({ where: { userId: demo.id } });
  const card1 = await prisma.card.create({
    data: {
      userId: demo.id,
      tier: 'PRO',
      status: 'ACTIVE',
      nickname: 'Travel & online',
      last4: '1144',
      expiryMonth: 11,
      expiryYear: 2029,
      cardHolder: 'RAYAN ZAHI',
      currency: 'USDT',
      spentMonth: 4_214.20,
      dailyLimit: 50_000,
      monthlyLimit: 500_000,
      cashbackRate: 0.02,
      cashbackBalance: 142.60,
      issuedAt: new Date(),
      activatedAt: new Date(),
    },
  });
  const card2 = await prisma.card.create({
    data: {
      userId: demo.id,
      tier: 'MASTER',
      status: 'ACTIVE',
      nickname: 'Daily spending',
      last4: '8821',
      expiryMonth: 4,
      expiryYear: 2028,
      cardHolder: 'RAYAN ZAHI',
      currency: 'USDT',
      spentMonth: 1_014.00,
      dailyLimit: 15_000,
      monthlyLimit: 150_000,
      cashbackRate: 0.015,
      cashbackBalance: 34.80,
      issuedAt: new Date(),
      activatedAt: new Date(),
    },
  });
  console.log(`✓ 2 cards seeded (${card1.last4}, ${card2.last4})`);

  /* ── P2P Listings ───────────────────────────────────────── */
  await prisma.p2PListing.deleteMany({
    where: { userId: { in: traders.map((t) => t.id) } },
  });

  const listings = [
    { trader: 0, side: 'SELL', currency: 'USDT', fiat: 'AED', price:    3.68, amount: 20_000, min: 500,  max: 5_000, methods: ['Bank Transfer', 'Apple Pay'] },
    { trader: 1, side: 'SELL', currency: 'USDT', fiat: 'SAR', price:    3.75, amount: 15_000, min: 300,  max: 4_000, methods: ['Bank Transfer'] },
    { trader: 2, side: 'BUY',  currency: 'BTC',  fiat: 'USD', price: 65_180, amount: 0.4,    min: 0.01, max: 0.5,    methods: ['Internal Wallet'] },
    { trader: 3, side: 'SELL', currency: 'USDT', fiat: 'EGP', price:   49.00, amount: 12_000, min: 100,  max: 3_000, methods: ['Vodafone Cash', 'Bank Transfer'] },
    { trader: 4, side: 'SELL', currency: 'ETH',  fiat: 'GBP', price: 2_572,   amount: 5,      min: 0.05, max: 1.5,   methods: ['Revolut', 'Bank Transfer'] },
    { trader: 0, side: 'BUY',  currency: 'USDT', fiat: 'AED', price:    3.65, amount: 15_000, min: 200,  max: 4_000, methods: ['Bank Transfer'] },
    { trader: 2, side: 'SELL', currency: 'USDT', fiat: 'EGP', price:   49.50, amount: 25_000, min: 500,  max: 8_000, methods: ['Instapay', 'Vodafone Cash'] },
  ] as const;

  for (const l of listings) {
    await prisma.p2PListing.create({
      data: {
        userId:        traders[l.trader].id,
        currency:      l.currency as Currency,
        fiatCurrency:  l.fiat as Currency,
        side:          l.side as OrderSide,
        price:         l.price,
        amount:        l.amount,
        minLimit:      l.min,
        maxLimit:      l.max,
        paymentMethods:[...l.methods],
        country:       traders[l.trader].country ?? undefined,
        status:        'ACTIVE',
      },
    });
  }
  console.log(`✓ ${listings.length} P2P listings seeded`);

  /* ── Notifications ───────────────────────────────────────── */
  await prisma.notification.deleteMany({ where: { userId: demo.id } });
  await prisma.notification.createMany({
    data: [
      { userId: demo.id, title: 'Deposit received',       message: 'Your USD 500 deposit is being processed.',  type: 'deposit', isRead: false },
      { userId: demo.id, title: 'P2P trade complete',     message: '5,000 USDT bought from @trader.uae.',       type: 'p2p',     isRead: false },
      { userId: demo.id, title: 'Card spend',             message: 'Apple iCloud+ — 42.50 USDT.',               type: 'card',    isRead: true  },
      { userId: demo.id, title: 'Cashback earned',        message: 'You earned 3.20 USDT (1% cashback).',       type: 'reward',  isRead: true  },
    ],
  });
  console.log('✓ 4 notifications seeded');

  /* ── Exchange rates ──────────────────────────────────────── */
  const rates: Array<[Currency, Currency, number, number]> = [
    ['USDT', 'USD', 1.01, 0.99],
    ['USDT', 'AED', 3.68, 3.65],
    ['USDT', 'SAR', 3.76, 3.74],
    ['USDT', 'EGP', 49.5, 48.8],
    ['USDT', 'EUR', 0.93, 0.91],
    ['USDT', 'GBP', 0.80, 0.78],
    ['USDT', 'LYD', 4.85, 4.80],
  ];
  for (const [base, quote, buy, sell] of rates) {
    await prisma.exchangeRate.upsert({
      where:  { baseCurrency_quoteCurrency: { baseCurrency: base, quoteCurrency: quote } },
      update: { buyPrice: buy, sellPrice: sell, isActive: true },
      create: { baseCurrency: base, quoteCurrency: quote, buyPrice: buy, sellPrice: sell, isActive: true },
    });
  }
  console.log(`✓ ${rates.length} exchange rates seeded`);

  /* ── Market listings ──────────────────────────────────────── */
  const markets = [
    { symbol: 'BTCUSDT',   baseAsset: 'BTC' as Currency,   displayName: 'Bitcoin',    rank: 1 },
    { symbol: 'ETHUSDT',   baseAsset: 'ETH' as Currency,   displayName: 'Ethereum',   rank: 2 },
    { symbol: 'SOLUSDT',   baseAsset: 'SOL' as Currency,   displayName: 'Solana',     rank: 3 },
    { symbol: 'BNBUSDT',   baseAsset: 'BNB' as Currency,   displayName: 'BNB',        rank: 4 },
    { symbol: 'XRPUSDT',   baseAsset: 'XRP' as Currency,   displayName: 'XRP',        rank: 5 },
    { symbol: 'ADAUSDT',   baseAsset: 'ADA' as Currency,   displayName: 'Cardano',    rank: 6 },
    { symbol: 'DOGEUSDT',  baseAsset: 'DOGE' as Currency,  displayName: 'Dogecoin',   rank: 7 },
    { symbol: 'MATICUSDT', baseAsset: 'MATIC' as Currency, displayName: 'Polygon',    rank: 8 },
    { symbol: 'DOTUSDT',   baseAsset: 'DOT' as Currency,   displayName: 'Polkadot',   rank: 9 },
    { symbol: 'AVAXUSDT',  baseAsset: 'AVAX' as Currency,  displayName: 'Avalanche',  rank: 10 },
  ];
  for (const m of markets) {
    await prisma.marketListing.upsert({
      where:  { symbol: m.symbol },
      update: { isActive: true, displayName: m.displayName, rank: m.rank },
      create: { symbol: m.symbol, baseAsset: m.baseAsset, displayName: m.displayName, rank: m.rank, isActive: true, isNew: false },
    });
  }
  console.log(`✓ ${markets.length} market listings seeded`);

  console.log('\n🎉 Seed complete!');
  console.log(`\n📋 Demo credentials:`);
  console.log(`   Email:    ${DEMO_EMAIL}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log(`\n📋 Admin credentials:`);
  console.log(`   Email:    ${adminEmail}`);
  console.log(`   Password: ${adminPassword}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
