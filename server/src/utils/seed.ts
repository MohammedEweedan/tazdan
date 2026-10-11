import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Bootstrap staff account. There is no default password: production needs
 * ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) or no account is
 * created. Outside production a missing password is replaced by a random one
 * printed once to the local console. The account is only ever CREATED here —
 * an existing account's password is never changed by a restart.
 */
function bootstrapAdminCredentials(): { email: string; password: string } | null {
  const isProd = process.env.NODE_ENV === 'production';
  const email = process.env.ADMIN_EMAIL?.trim();
  let password = process.env.ADMIN_PASSWORD ?? '';
  const weak = password.length < 12 || /^(\d+|password|admin|changeme)/i.test(password);
  if (isProd) {
    if (!email || weak) {
      logger.error('[seed] bootstrap admin NOT created: set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ chars) to create one');
      return null;
    }
    return { email, password };
  }
  if (!password) {
    password = randomBytes(12).toString('base64url');
    // eslint-disable-next-line no-console
    console.warn(`\n[seed] Development bootstrap admin password (shown once): ${password}\n`);
  }
  return { email: email || 'admin@localhost.test', password };
}

export async function seedAdmin() {
  const creds = bootstrapAdminCredentials();
  const existingAdmin = creds ? await prisma.user.findUnique({ where: { email: creds.email } }) : null;

  if (creds && !existingAdmin) {
    const adminEmail = creds.email;
    const adminPassword = creds.password;
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
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@tazdan.com';
  const supportExisting = await prisma.user.findFirst({
    where: { OR: [{ username: 'support' }, { email: supportEmail }] },
  });
  if (!supportExisting) {
    const passwordHash = await bcrypt.hash(uuidv4(), 12);
    await prisma.user.create({
      data: {
        email:         supportEmail,
        passwordHash,
        firstName:     'tazdan',
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
  const platformEmail = process.env.PLATFORM_EMAIL || 'platform@tazdan.com';
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

  // Platform deposit bank accounts are NOT seeded. Customers are told to
  // wire real money to whatever appears here, so every account must be
  // entered by an administrator (/api/admin/platform-banks) from the bank's
  // own documentation. Earlier builds seeded illustrative accounts; the
  // 20261007100000_disable_placeholder_platform_banks migration deactivates them.

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
