jest.mock('../utils/prisma', () => ({ prisma: {} }));
jest.mock('../services/exchange/fxRateProvider.service', () => ({ getRate: jest.fn() }));
jest.mock('../services/exchange/priceEngine.service', () => ({ getMarketPrice: jest.fn() }));
import { usdRate } from '../utils/kycLimits';
import { getRate } from '../services/exchange/fxRateProvider.service';
import { getMarketPrice } from '../services/exchange/priceEngine.service';

describe('real-money risk valuation', () => {
  const saved = { mode: process.env.NODE_ENV, money: process.env.REAL_MONEY_ENABLED };
  beforeEach(() => { process.env.NODE_ENV = 'production'; process.env.REAL_MONEY_ENABLED = '1'; });
  afterEach(() => { process.env.NODE_ENV = saved.mode; if (saved.money === undefined) delete process.env.REAL_MONEY_ENABLED; else process.env.REAL_MONEY_ENABLED = saved.money; jest.resetAllMocks(); });
  it.each(['fallback:static', 'stale:operator'])('refuses %s instead of understating AML and KYC exposure', async source => {
    (getRate as jest.Mock).mockResolvedValue({ sellPrice: '1.2', source, fetchedAt: new Date() });
    await expect(usdRate('GBP')).rejects.toMatchObject({ statusCode: 503, code: 'RATE_UNAVAILABLE' });
  });
  it('refuses missing crypto prices instead of valuing one bitcoin as one dollar', async () => {
    (getMarketPrice as jest.Mock).mockRejectedValue(new Error('price feed down'));
    await expect(usdRate('BTC')).rejects.toMatchObject({ statusCode: 503 });
  });
  it('accepts a current sourced FX price and rejects an aged one', async () => {
    (getRate as jest.Mock).mockResolvedValue({ sellPrice: '1.25', source: 'live:provider', fetchedAt: new Date() });
    expect(await usdRate('GBP')).toBe(1.25);
    (getRate as jest.Mock).mockResolvedValue({ sellPrice: '1.25', source: 'live:provider', fetchedAt: new Date(Date.now() - 600_000) });
    await expect(usdRate('GBP')).rejects.toMatchObject({ statusCode: 503 });
  });
});
