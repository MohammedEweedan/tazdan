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
}
