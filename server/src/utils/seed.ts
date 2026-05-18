import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';
import { logger } from './logger';

export async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'moeawidan99@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || '11223344';

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

    logger.info('Admin user seeded');
  }

  // Platform-wide settings — kept outside the admin-bootstrap block so
  // newly-added fee keys reach existing deployments on next boot. Upsert
  // with `update:{}` makes this safe to re-run.
  const settings = [
    { key: 'min_deposit_usd', value: '10', description: 'Minimum USD deposit amount' },
    { key: 'min_withdrawal_usdt', value: '10', description: 'Minimum USDT withdrawal amount' },
    { key: 'trading_fee_percent', value: '0.5', description: 'Trading fee percentage on BUY/SELL orders' },
    { key: 'p2p_fee_percent',     value: '0.5', description: 'P2P trade fee percentage' },
    { key: 'card_fee_percent',    value: '1.0', description: 'Card spend platform fee percentage' },
    { key: 'swap_fee_percent',    value: '0.3', description: 'DEX swap fee percentage' },
    { key: 'onramp_fee_percent',  value: '1.0', description: 'On-ramp fee percentage' },
    { key: 'offramp_fee_percent', value: '1.0', description: 'Off-ramp fee percentage' },
    { key: 'withdrawal_fee_usdt', value: '1',   description: 'USDT withdrawal fee' },
    { key: 'withdrawal_fee_usd',  value: '2',   description: 'Fiat USD-equivalent withdrawal fee' },
    { key: 'platform_usdt_wallet', value: 'TRC20_WALLET_ADDRESS_HERE', description: 'Platform USDT TRC20 wallet' },
    { key: 'kyc_required_for_trading', value: 'true', description: 'Require KYC for trading' },
    { key: 'transfer_fee_usdt', value: '0', description: 'USDT internal transfer fee (free)' },
  ];

  for (const setting of settings) {
    await prisma.platformSettings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
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
        firstName:     'promrkts',
        lastName:      'Support',
        username:      'support',
        role:          'ADMIN',
        status:        'ACTIVE',
        kycStatus:     'APPROVED',
        emailVerified: true,
        profilePublic: true,
        referralCode:  `SUP${uuidv4().slice(0, 8).toUpperCase()}`,
      },
    });
    logger.info('Support user seeded');
  }

  // Seed the platform "treasury" user — every collected fee is credited
  // to this account so admins can audit and withdraw revenue. Identified
  // by the reserved `username = 'platform'`.
  const platformEmail = process.env.PLATFORM_EMAIL || 'platform@promrkts.app';
  const platformExisting = await prisma.user.findFirst({
    where: { OR: [{ username: 'platform' }, { email: platformEmail }] },
  });
  if (!platformExisting) {
    const passwordHash = await bcrypt.hash(uuidv4(), 12);
    await prisma.user.create({
      data: {
        email:         platformEmail,
        passwordHash,
        firstName:     'Platform',
        lastName:      'Treasury',
        username:      'platform',
        role:          'ADMIN',
        status:        'ACTIVE',
        kycStatus:     'APPROVED',
        kycTier:       'TIER_3',
        emailVerified: true,
        profilePublic: false,
        referralCode:  `PLT${uuidv4().slice(0, 8).toUpperCase()}`,
      },
    });
    logger.info('Platform treasury user seeded');
  }

  // Platform deposit-rail bank accounts — admin-managed at runtime via
  // /api/admin/platform-banks, but seeded with sensible defaults so the
  // mobile deposit flow has something to display the moment the schema
  // exists. Idempotent: an existing row with the same currency is left
  // alone so admin edits aren't clobbered.
  const platformBanks = [
    { currency: 'USD', country: 'US', bankName: 'JPMorgan Chase Bank',          accountName: 'Promrkts Inc.',     accountNumber: '000123456789',                  swift: 'CHASUS33', routingNumber: '021000021' },
    { currency: 'EUR', country: 'DE', bankName: 'Deutsche Bank AG',             accountName: 'Promrkts GmbH',     iban: 'DE89370400440532013000',                 swift: 'DEUTDEFF' },
    { currency: 'GBP', country: 'GB', bankName: 'Barclays Bank plc',            accountName: 'Promrkts Ltd',      iban: 'GB82WEST12345698765432',                 swift: 'BARCGB22', sortCode: '20-00-00', accountNumber: '98765432' },
    { currency: 'AED', country: 'AE', bankName: 'Emirates NBD',                 accountName: 'Promrkts DMCC',     iban: 'AE070331234567890123456',                swift: 'EBILAEAD' },
    { currency: 'SAR', country: 'SA', bankName: 'Saudi National Bank',          accountName: 'Promrkts Arabia',   iban: 'SA0380000000608010167519',               swift: 'NCBASARI' },
    { currency: 'EGP', country: 'EG', bankName: 'National Bank of Egypt',       accountName: 'Promrkts Egypt',    iban: 'EG380002000000000012345678901',          swift: 'NBEGEGCX' },
    { currency: 'LYD', country: 'LY', bankName: 'Bank of Commerce & Development', accountName: 'Promrkts Libya', accountNumber: '001-123456-001',                swift: 'BCDLLYLT' },
  ];
  for (const b of platformBanks) {
    const existing = await (prisma as any).platformBankAccount.findFirst({
      where: { currency: b.currency, bankName: b.bankName },
    });
    if (!existing) {
      await (prisma as any).platformBankAccount.create({ data: { ...b, isActive: true } });
    }
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
