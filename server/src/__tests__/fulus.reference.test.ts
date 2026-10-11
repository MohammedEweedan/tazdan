import { noteFulusRate } from '../services/exchange/fulus.service';
import { getRate, invalidateRate, getLiveProviderRate } from '../services/exchange/fxRateProvider.service';

jest.mock('../utils/prisma', () => ({ prisma: {
  exchangeRate: {
    findUnique: jest.fn().mockResolvedValue({ isActive: true, setBy: 'treasury', updatedAt: new Date(), overrideExpiresAt: new Date(Date.now() + 3600000), buyPrice: 9, sellPrice: 8 }),
    upsert: jest.fn().mockResolvedValue({}),
  },
  platformSettings: { findUnique: jest.fn().mockImplementation(({ where }: { where: { key: string } }) => Promise.resolve({ value: where.key.includes('floor') ? '0' : '2' })) },
} }));
jest.mock('../services/exchange/lydOrderBook.service', () => ({
  currentLydSkewPct: () => .06, applyLydDemandSkew: () => { throw Error('Fulus must not be skewed'); }, noteLydPrice: jest.fn(),
}));
jest.mock('axios', () => ({ get: jest.fn().mockResolvedValue({ data: {} }) }));

beforeAll(() => { process.env.FULUS_API_TOKEN = 'test-only'; });
afterAll(() => { delete process.env.FULUS_API_TOKEN; });

it('uses an extreme Fulus reference instead of a live manual override, in both directions', async () => {
  expect(noteFulusRate('USD', 123.45)).toBe(true);
  invalidateRate('USD', 'LYD'); invalidateRate('LYD', 'USD');
  const direct = await getRate('USD', 'LYD');
  expect(direct.source).toBe('live:fulus');
  expect((Number(direct.buyPrice) + Number(direct.sellPrice)) / 2).toBeCloseTo(123.45, 7);
  const inverse = await getRate('LYD', 'USD');
  expect(inverse.source).toBe('derived:fulus');
  expect((Number(inverse.buyPrice) + Number(inverse.sellPrice)) / 2).toBeCloseTo(1 / 123.45, 7);
  const live = await getLiveProviderRate('USD', 'LYD');
  expect(live?.source).toBe('live:fulus');
});

it('accepts a large downward update and rejects malformed values', async () => {
  expect(noteFulusRate('USD', .25)).toBe(true);
  for (const value of [0, -2, NaN, Infinity]) expect(noteFulusRate('USD', value)).toBe(false);
  invalidateRate('USD', 'LYD');
  const rate = await getRate('USD', 'LYD');
  expect((Number(rate.buyPrice) + Number(rate.sellPrice)) / 2).toBeCloseTo(.25, 7);
});

it('does not substitute an official, scraped, static or manual rate when Fulus has none', async () => {
  invalidateRate('TND', 'LYD');
  await expect(getRate('TND', 'LYD')).rejects.toThrow('Fulus rate unavailable');
});
