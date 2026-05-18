// Price engine unit tests — mock Binance so no real network calls
jest.mock('axios');
import axios from 'axios';
import { buildQuote, getQuote, consumeQuote } from '../services/exchange/priceEngine.service';
import Decimal from 'decimal.js';

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  mockedAxios.get.mockResolvedValue({ data: { symbol: 'BTCUSDT', price: '50000.00' } });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('buildQuote — BUY', () => {
  it('returns a valid quote for BUY BTC', async () => {
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 100, side: 'BUY' });
    expect(quote.id).toBeDefined();
    expect(quote.side).toBe('BUY');
    expect(quote.asset).toBe('BTC');
    expect(new Decimal(quote.fiatAmount).toNumber()).toBeCloseTo(100, 0);
    expect(new Decimal(quote.cryptoAmount).toNumber()).toBeGreaterThan(0);
    expect(quote.expiresAt).toBeGreaterThan(Date.now());
  });

  it('throws if fiatAmount is missing for BUY', async () => {
    await expect(buildQuote({ asset: 'BTC', network: 'BTC', side: 'BUY' })).rejects.toThrow('fiatAmount');
  });

  it('still returns a quote for very small amounts (no minimum enforced at quote stage)', async () => {
    // Minimum-amount enforcement happens at the withdrawal/order layer, not quote.
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 0.001, side: 'BUY' });
    expect(quote.id).toBeDefined();
    expect(new Decimal(quote.cryptoAmount).gt(0)).toBe(true);
  });
});

describe('buildQuote — SELL', () => {
  it('returns a valid quote for SELL BTC', async () => {
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', cryptoAmount: 0.001, side: 'SELL' });
    expect(quote.side).toBe('SELL');
    expect(new Decimal(quote.fiatAmount).toNumber()).toBeGreaterThan(0);
  });

  it('BUY quoted price is higher than market (spread applied)', async () => {
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 100, side: 'BUY' });
    expect(new Decimal(quote.quotedPrice).gt(quote.marketPrice)).toBe(true);
  });

  it('SELL quoted price is lower than market (spread applied)', async () => {
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', cryptoAmount: 0.01, side: 'SELL' });
    expect(new Decimal(quote.quotedPrice).lt(quote.marketPrice)).toBe(true);
  });
});

describe('Quote cache', () => {
  it('getQuote returns the stored quote by id', async () => {
    const quote = await buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 100, side: 'BUY' });
    const retrieved = await getQuote(quote.id);
    expect(retrieved?.id).toBe(quote.id);
  });

  it('consumeQuote removes the quote from cache', async () => {
    const quote = await buildQuote({ asset: 'ETH', network: 'ETH', fiatAmount: 50, side: 'BUY' });
    const consumed = await consumeQuote(quote.id);
    expect(consumed?.id).toBe(quote.id);
    expect(await getQuote(quote.id)).toBeNull();
  });

  it('getQuote returns null for unknown id', async () => {
    expect(await getQuote('nonexistent-id')).toBeNull();
  });
});

describe('USDT stablecoin (1:1 peg)', () => {
  it('does not call Binance for USDT', async () => {
    await buildQuote({ asset: 'USDT', network: 'TRC20', fiatAmount: 100, side: 'BUY' });
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });
});
