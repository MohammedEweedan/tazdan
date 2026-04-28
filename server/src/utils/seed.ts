import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';

export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@exchange.ly';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!@#';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const referralCode = `ADM${uuidv4().slice(0, 8).toUpperCase()}`;

    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: 'Admin',
        lastName: 'Exchange',
        role: 'ADMIN',
        status: 'ACTIVE',
        kycStatus: 'APPROVED',
        emailVerified: true,
        referralCode,
      },
    });

    // Seed default exchange rates
    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency: {
          baseCurrency: 'USDT',
          quoteCurrency: 'LYD',
        },
      },
      update: {},
      create: {
        baseCurrency: 'USDT',
        quoteCurrency: 'LYD',
        buyPrice: 7.50,
        sellPrice: 7.30,
        isActive: true,
      },
    });

    await prisma.exchangeRate.upsert({
      where: {
        baseCurrency_quoteCurrency: {
          baseCurrency: 'USDT',
          quoteCurrency: 'USD',
        },
      },
      update: {},
      create: {
        baseCurrency: 'USDT',
        quoteCurrency: 'USD',
        buyPrice: 1.01,
        sellPrice: 0.99,
        isActive: true,
      },
    });

    // Seed platform settings
    const settings = [
      { key: 'min_deposit_lyd', value: '50', description: 'Minimum LYD deposit amount' },
      { key: 'min_deposit_usd', value: '10', description: 'Minimum USD deposit amount' },
      { key: 'min_withdrawal_lyd', value: '100', description: 'Minimum LYD withdrawal amount' },
      { key: 'min_withdrawal_usdt', value: '10', description: 'Minimum USDT withdrawal amount' },
      { key: 'trading_fee_percent', value: '0.5', description: 'Trading fee percentage' },
      { key: 'withdrawal_fee_lyd', value: '5', description: 'LYD withdrawal fee' },
      { key: 'withdrawal_fee_usdt', value: '1', description: 'USDT withdrawal fee' },
      { key: 'platform_usdt_wallet', value: 'TRC20_WALLET_ADDRESS_HERE', description: 'Platform USDT TRC20 wallet' },
      { key: 'kyc_required_for_trading', value: 'true', description: 'Require KYC for trading' },
      { key: 'max_daily_withdrawal_lyd', value: '50000', description: 'Max daily LYD withdrawal' },
      { key: 'transfer_fee_usdt', value: '0', description: 'USDT internal transfer fee' },
      { key: 'agent_deposit_fee_percent', value: '0', description: 'Agent deposit fee %' },
      { key: 'agent_withdrawal_fee_percent', value: '0', description: 'Agent withdrawal fee %' },
    ];

    for (const setting of settings) {
      await prisma.platformSettings.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }

    console.log('Admin user and default settings seeded');
  }

  // Seed the system "support" user — every user can DM this account
  // and escalation threads route to it. Idempotent: only created once,
  // identified by the reserved `username = 'support'`.
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@promrkts.com';
  const supportExisting = await prisma.user.findFirst({
    where: { OR: [{ username: 'support' }, { email: supportEmail }] },
  });
  if (!supportExisting) {
    const passwordHash = await bcrypt.hash(uuidv4(), 12);
    await prisma.user.create({
      data: {
        email:         supportEmail,
        passwordHash,
        firstName:     'Promrkts',
        lastName:      'Support',
        username:      'support',
        role:          'AGENT',
        status:        'ACTIVE',
        kycStatus:     'APPROVED',
        emailVerified: true,
        profilePublic: true,
        referralCode:  `SUP${uuidv4().slice(0, 8).toUpperCase()}`,
      },
    });
    console.log('Support user seeded');
  }

  // Seed market listings (idempotent — safe to run on every boot)
  const listings = [
    { symbol: 'BTCUSDT',   baseAsset: 'BTC',   displayName: 'Bitcoin',   rank: 1 },
    { symbol: 'ETHUSDT',   baseAsset: 'ETH',   displayName: 'Ethereum',  rank: 2 },
    { symbol: 'SOLUSDT',   baseAsset: 'SOL',   displayName: 'Solana',    rank: 3 },
    { symbol: 'BNBUSDT',   baseAsset: 'BNB',   displayName: 'BNB',       rank: 4 },
    { symbol: 'XRPUSDT',   baseAsset: 'XRP',   displayName: 'XRP',       rank: 5 },
    { symbol: 'ADAUSDT',   baseAsset: 'ADA',   displayName: 'Cardano',   rank: 6 },
    { symbol: 'DOGEUSDT',  baseAsset: 'DOGE',  displayName: 'Dogecoin',  rank: 7 },
    { symbol: 'MATICUSDT', baseAsset: 'MATIC', displayName: 'Polygon',   rank: 8 },
    { symbol: 'DOTUSDT',   baseAsset: 'DOT',   displayName: 'Polkadot',  rank: 9 },
    { symbol: 'AVAXUSDT',  baseAsset: 'AVAX',  displayName: 'Avalanche', rank: 10 },
  ] as const;
  for (const l of listings) {
    await prisma.marketListing.upsert({
      where:  { symbol: l.symbol },
      update: { isActive: true, displayName: l.displayName, rank: l.rank },
      create: { symbol: l.symbol, baseAsset: l.baseAsset, displayName: l.displayName, rank: l.rank, isActive: true, isNew: false },
    });
  }
}
