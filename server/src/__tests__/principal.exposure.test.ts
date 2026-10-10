/**
 * Principal crypto exposure limits: with no reachable exchange, customer
 * orders fill against Tazdan; an order that would take Tazdan's unhedged
 * position past its USD limit is refused, orders that reduce it always pass,
 * and recorded hedges reduce the position. Positions are platform-wide, so
 * this suite runs in its own schema.
 */
import { execSync } from 'child_process';
import { Decimal } from '@prisma/client/runtime/library';

const RUN_DB = process.env.CI === 'true' || process.env.RUN_DB_TESTS === '1';
const describeDb = RUN_DB ? describe : describe.skip;
const SCHEMA = `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
if (RUN_DB) {
  const u = new URL(process.env.DATABASE_URL ?? '');
  u.searchParams.set('schema', SCHEMA);
  process.env.DATABASE_URL = u.toString();
}

describeDb('principal crypto exposure', () => {
  let prisma: any;
  let pe: typeof import('../services/exchange/principalExposure.service');
  let userId: string;
  let staffId: string;

  const fill = (asset: string, type: 'BUY' | 'SELL', qty: string, price: string) => prisma.cryptoOrder.create({
    data: {
      userId, type, asset, network: asset, quotedPrice: price, quotedTotal: '0', marketPrice: price, actualCost: '0',
      platformFee: '0', networkFee: '0', spreadCapture: '0', cryptoAmount: qty, status: 'EXECUTED',
    },
  });
  const check = (asset: string, side: 'BUY' | 'SELL', qty: string, price: string) =>
    prisma.$transaction((tx: any) => pe.assertPrincipalCapacity(tx, { asset, side, quantity: new Decimal(qty), priceUsd: new Decimal(price) }));

  beforeAll(async () => {
    execSync('npx prisma migrate deploy', { env: process.env, stdio: 'pipe' });
    ({ prisma } = await import('../utils/prisma'));
    pe = await import('../services/exchange/principalExposure.service');
    const mk = (n: string) => prisma.user.create({ data: { email: `${SCHEMA}_${n}@example.com`, passwordHash: 'x', firstName: n, lastName: 'T', referralCode: `${SCHEMA}${n}`.slice(-16) } });
    userId = (await mk('c')).id;
    staffId = (await mk('s')).id;
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  });

  it('fills as principal when no exchange is configured', () => {
    delete process.env.BINANCE_API_KEY;
    expect(pe.executionMode()).toBe('PRINCIPAL');
  });

  it('refuses orders that would take the position past the per-asset limit, never ones that reduce it', async () => {
    await fill('BTC', 'BUY', '0.02', '50000'); // Tazdan short 0.02 BTC = 1,000 USD
    await expect(check('BTC', 'BUY', '0.02', '50000')).resolves.toBeUndefined(); // → 2,000, at the default limit
    await expect(check('BTC', 'BUY', '0.03', '50000')).rejects.toMatchObject({ statusCode: 503, details: { reason: 'PRINCIPAL_LIMIT' } });
    await expect(check('BTC', 'SELL', '0.02', '50000')).resolves.toBeUndefined(); // back to flat
    await expect(check('BTC', 'SELL', '0.05', '50000')).resolves.toBeUndefined(); // long 0.03 = 1,500
    await expect(check('BTC', 'SELL', '0.1', '50000')).rejects.toMatchObject({ statusCode: 503 }); // long 0.08 = 4,000
  });

  it('recorded hedges reduce the position and are append-only', async () => {
    const hedge = await pe.recordHedge({ asset: 'btc', side: 'BUY', quantity: '0.02', priceUsd: '50100', venue: 'OTC desk', note: 'Offset customer buys', staffId });
    const { positions } = await pe.principalPositions();
    const btc = positions.find((p) => p.asset === 'BTC')!;
    expect(btc.position).toBe('0');
    expect(btc.exposureUsd).toBe('0.00');
    await expect(check('BTC', 'BUY', '0.04', '50000')).resolves.toBeUndefined(); // 2,000 again allowed
    await expect(prisma.principalHedge.update({ where: { id: hedge.id }, data: { quantity: '1' } })).rejects.toThrow(/append-only/);
    expect(await prisma.auditLog.count({ where: { action: 'PRINCIPAL_HEDGE_RECORDED', entityId: hedge.id } })).toBe(1);
  });

  it('applies the total limit across assets and a zero limit stops principal fills', async () => {
    await fill('ETH', 'BUY', '0.5', '3000'); // short 0.5 ETH = 1,500 USD
    await prisma.platformSettings.create({ data: { key: 'principal_max_total_usd', value: '2000' } });
    await expect(check('BTC', 'BUY', '0.01', '50000')).resolves.toBeUndefined(); // 500 + 1,500 = 2,000, at the total limit
    await expect(check('BTC', 'BUY', '0.012', '50000')).rejects.toMatchObject({ statusCode: 503 }); // 600 + 1,500 > 2,000
    await prisma.platformSettings.update({ where: { key: 'principal_max_total_usd' }, data: { value: '100000' } });
    await prisma.platformSettings.create({ data: { key: 'principal_max_net_usd.ETH', value: '0' } });
    await expect(check('ETH', 'BUY', '0.001', '3000')).rejects.toMatchObject({ statusCode: 503 });
    await expect(check('ETH', 'SELL', '0.1', '3000')).resolves.toBeUndefined(); // reduces the short
  });
});
