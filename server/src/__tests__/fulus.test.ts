// Fulus rate service unit tests — pure logic, no real network.
import crypto from 'crypto';
import {
  verifyFulusSignature,
  noteFulusRate,
  getFulusLydRate,
  fulusEnabled,
  fulusCachedRates,
} from '../services/exchange/fulus.service';
// backfillHistory is imported dynamically in tests that mock prisma.

const OLD_ENV = process.env;
beforeEach(() => {
  process.env = { ...OLD_ENV };
});
afterEach(() => {
  process.env = OLD_ENV;
});

describe('verifyFulusSignature', () => {
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ event: 'rate.created', data: { currency: 'USD', rate: '6.85' } });

  it('accepts a correct HMAC-SHA256 hex digest', () => {
    process.env.FULUS_WEBHOOK_SECRET = secret;
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyFulusSignature(sig, body)).toBe(true);
  });

  it('accepts a sha256=<hex> prefixed form', () => {
    process.env.FULUS_WEBHOOK_SECRET = secret;
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyFulusSignature(`sha256=${sig}`, body)).toBe(true);
  });

  it('rejects a tampered body', () => {
    process.env.FULUS_WEBHOOK_SECRET = secret;
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyFulusSignature(sig, body + 'x')).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    delete process.env.FULUS_WEBHOOK_SECRET;
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyFulusSignature(sig, body)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    process.env.FULUS_WEBHOOK_SECRET = secret;
    expect(verifyFulusSignature(undefined, body)).toBe(false);
  });
});

describe('noteFulusRate sanity bounds', () => {
  it('accepts an in-range USD rate (LYD per USD)', () => {
    expect(noteFulusRate('USD', 7.2, 'webhook')).toBe(true);
    expect(fulusCachedRates().USD?.rate).toBe(7.2);
  });

  it('rejects an out-of-range USD rate', () => {
    expect(noteFulusRate('USD', 0.5, 'webhook')).toBe(false); // way below floor
    expect(noteFulusRate('USD', 99, 'webhook')).toBe(false); // way above ceiling
  });

  it('rejects a currency Fulus does not carry', () => {
    expect(noteFulusRate('CAD', 5, 'webhook')).toBe(false);
  });

  it('rejects a non-finite rate', () => {
    expect(noteFulusRate('EUR', NaN, 'webhook')).toBe(false);
  });
});

describe('backfillHistory', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('inserts a tick per sane data point and skips out-of-range rates', async () => {
    process.env.FULUS_API_TOKEN = 'tok_test';
    // Mock the prisma module used inside backfillHistory.
    const created: any[] = [];
    jest.doMock('../utils/prisma', () => ({
      prisma: {
        fxRateTick: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn((args: any) => { created.push(args.data); return Promise.resolve(args.data); }),
        },
      },
    }));
    // Re-import so the mock is picked up.
    const { backfillHistory } = await import('../services/exchange/fulus.service');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [
        { rate: 8.37, timestamp: '2026-06-08T14:00:00+02:00' },  // sane → inserted
        { rate: 99,   timestamp: '2026-06-08T09:00:00+02:00' },  // out of bounds → skipped
        { rate: 8.40 },                                          // no timestamp → skipped
      ] }),
    }) as any;

    const n = await backfillHistory('USD', 1);
    expect(n).toBe(1);
    expect(created).toHaveLength(1);
    expect(created[0].pair).toBe('USD/LYD');
    expect(created[0].price).toBe('8.37000000');
    jest.dontMock('../utils/prisma');
  });

  it('no-ops without a token', async () => {
    delete process.env.FULUS_API_TOKEN;
    const { backfillHistory } = await import('../services/exchange/fulus.service');
    expect(await backfillHistory('USD', 7)).toBe(0);
  });
});

describe('getFulusLydRate', () => {
  it('returns null when no token configured (defers to scraper)', async () => {
    delete process.env.FULUS_API_TOKEN;
    expect(fulusEnabled()).toBe(false);
    expect(await getFulusLydRate('USD')).toBeNull();
  });

  it('serves a fresh webhook-fed value from cache without polling', async () => {
    process.env.FULUS_API_TOKEN = 'tok_test';
    noteFulusRate('GBP', 9.1, 'webhook');
    expect(await getFulusLydRate('GBP')).toBe(9.1);
  });

  it('returns null for an unsupported currency even when enabled', async () => {
    process.env.FULUS_API_TOKEN = 'tok_test';
    expect(await getFulusLydRate('JPY')).toBeNull();
  });
});
