/**
 * Unit tests for the P0 hardening guards that don't need a database:
 * amount parsing, feature switches, effective KYC tier and single-use,
 * owner-bound price quotes.
 */
import { parsePositiveAmount, assertTransitioned } from '../services/wallet/atomicWallet';
import { featureFlags, isFeatureEnabled } from '../utils/features';
import { effectiveTier } from '../utils/kycLimits';
import { buildQuote, consumeQuote, getQuote } from '../services/exchange/priceEngine.service';

describe('parsePositiveAmount', () => {
  it.each([-1, 0, -0.0001, '-5', '0', 'abc', '', NaN, Infinity, -Infinity])('rejects %p', (value) => {
    expect(() => parsePositiveAmount(value)).toThrow();
  });

  it('rejects non-numeric types', () => {
    expect(() => parsePositiveAmount(null)).toThrow();
    expect(() => parsePositiveAmount(undefined)).toThrow();
    expect(() => parsePositiveAmount({})).toThrow();
  });

  it('rejects more than 18 decimal places', () => {
    expect(() => parsePositiveAmount('0.0000000000000000001')).toThrow();
  });

  it('accepts Decimal instances', () => {
    expect(parsePositiveAmount(parsePositiveAmount('12.5')).toString()).toBe('12.5');
  });

  it('accepts positive numbers and numeric strings exactly', () => {
    expect(parsePositiveAmount(10).toString()).toBe('10');
    expect(parsePositiveAmount('0.1').plus(parsePositiveAmount('0.2')).toString()).toBe('0.3');
  });
});

describe('assertTransitioned', () => {
  it('passes only when exactly one row moved', () => {
    expect(() => assertTransitioned({ count: 1 }, 'x')).not.toThrow();
    expect(() => assertTransitioned({ count: 0 }, 'already processed')).toThrow('already processed');
  });
});

describe('feature switches', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('default to off in production and on elsewhere', () => {
    delete process.env.FEATURE_P2P;
    process.env.NODE_ENV = 'production';
    expect(isFeatureEnabled('p2p')).toBe(false);
    process.env.NODE_ENV = 'development';
    expect(isFeatureEnabled('p2p')).toBe(true);
  });

  it('respect explicit overrides', () => {
    process.env.NODE_ENV = 'production';
    process.env.FEATURE_CARDS = '1';
    process.env.FEATURE_ALT_TRADING = '0';
    expect(featureFlags()).toMatchObject({ cards: true, altTrading: false });
  });
});

describe('effectiveTier', () => {
  it('holds anyone not approved to TIER_0, whatever tier is stored', () => {
    expect(effectiveTier({ kycStatus: 'REJECTED', kycTier: 'TIER_2' })).toBe('TIER_0');
    expect(effectiveTier({ kycStatus: 'PENDING', kycTier: 'TIER_3' })).toBe('TIER_0');
  });

  it('gives approved users with no tier set TIER_1', () => {
    expect(effectiveTier({ kycStatus: 'APPROVED', kycTier: 'TIER_0' })).toBe('TIER_1');
    expect(effectiveTier({ kycStatus: 'APPROVED', kycTier: 'TIER_2' })).toBe('TIER_2');
  });
});

describe('price quotes', () => {
  const build = (userId?: string) =>
    buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 100, side: 'BUY', settlementCurrency: 'USD', userId });

  it('cannot be consumed by another user, and stay available to the owner', async () => {
    const quote = await build('owner');
    expect(await consumeQuote(quote.id, 'someone-else')).toBeNull();
    expect(await getQuote(quote.id)).not.toBeNull();
    expect((await consumeQuote(quote.id, 'owner'))?.id).toBe(quote.id);
  });

  it('can be consumed exactly once, even concurrently', async () => {
    const quote = await build('owner');
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeQuote(quote.id, 'owner')));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await consumeQuote(quote.id, 'owner')).toBeNull();
  });
});
