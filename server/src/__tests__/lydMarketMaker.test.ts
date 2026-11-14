/**
 * LYD market maker: pip maths, demand skew, the owner's floor and cap, the
 * profit invariant, rate-of-change cap, stale-reference handling, Redis
 * fallback, configuration binding and the execution re-check. No DB, no
 * Redis, no network.
 */
import Decimal from 'decimal.js';
import {
  DEFAULT_MARKET_MAKER_CONFIG as D, advanceSkew, checkFillAgainstReference, mergeMarketMakerConfig, pairDecimals, pipUnit,
  priceLydPair, quoteInvariantViolations, summarizeFlow, targetSkewPips, validateMarketMakerConfig, widenPips,
  type FlowEvent, type MarketMakerConfig,
} from '../services/exchange/lydMarketMaker.math';

// ── Mocks for the service-level tests ─────────────────────────────────
const fulusRates: Record<string, { rate: number; checkedAgeMs: number }> = {};
jest.mock('../services/exchange/fulus.service', () => ({
  FULUS_CURRENCIES: ['USD', 'EUR', 'GBP', 'TRY', 'EGP', 'TND', 'SAR', 'AED'],
  getFulusLydRate: jest.fn(async (c: string) => fulusRates[c]?.rate ?? null),
  fulusCachedRates: jest.fn(() => Object.fromEntries(Object.entries(fulusRates).map(([k, v]) => [k, { rate: v.rate, ageMs: v.checkedAgeMs, checkedAgeMs: v.checkedAgeMs, source: 'webhook' }]))),
}));
const isBlocked = jest.fn(async (_scope: string, _key: string) => false);
jest.mock('../services/platform/controls.service', () => ({ isBlocked: (scope: string, key: string) => isBlocked(scope, key) }));
let redisClient: { sendCommand: jest.Mock } | null = null;
jest.mock('../utils/redis', () => ({
  getRedisClient: () => redisClient,
  redisGet: jest.fn(async () => null), redisSet: jest.fn(async () => undefined),
  redisDel: jest.fn(async () => undefined), redisGetDel: jest.fn(async () => null),
}));
const settings = new Map<string, string>();
const approvals = new Map<string, any>();
const audits: any[] = [];
jest.mock('../utils/prisma', () => {
  const client: any = {
    platformSettings: {
      findUnique: jest.fn(async ({ where }: any) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
      upsert: jest.fn(async ({ where, create, update }: any) => { settings.set(where.key, (settings.has(where.key) ? update : create).value); return {}; }),
    },
    approvalRequest: { findUnique: jest.fn(async ({ where }: any) => approvals.get(where.id) ?? null) },
    auditLog: {
      findFirst: jest.fn(async ({ where }: any) => audits.find((a) => a.action === where.action && a.entityId === where.entityId) ?? null),
      create: jest.fn(async ({ data }: any) => { audits.push(data); return data; }),
    },
    exchangeRate: { findUnique: jest.fn(async () => null), upsert: jest.fn(async () => ({})) },
    transaction: { findMany: jest.fn(async () => []) },
    cryptoOrder: { findMany: jest.fn(async () => []) },
  };
  client.$transaction = jest.fn(async (fn: any) => fn(client));
  return { prisma: client };
});
jest.mock('../services/exchange/gasOracle.service', () => ({ liveNetworkCostUsd: jest.fn(async () => null) }));
jest.mock('axios', () => ({ get: jest.fn(async () => ({ data: { price: '50000' } })), post: jest.fn() }));

// eslint-disable-next-line import/first
import * as MM from '../services/exchange/lydMarketMaker.service';
// eslint-disable-next-line import/first
import { getRate } from '../services/exchange/fxRateProvider.service';
// eslint-disable-next-line import/first
import { conversionLedgerLegs, lydConversionMargin, quoteConversion } from '../services/exchange/conversion.service';
// eslint-disable-next-line import/first
import { buildQuote, consumeQuote } from '../services/exchange/priceEngine.service';

const R = new Decimal('9.81');
const cfg = (over: Partial<MarketMakerConfig> = {}): MarketMakerConfig => validateMarketMakerConfig({ ...D, ...over });
const price = (skewPips: number, widen = 0, c = cfg(), ref = R) =>
  priceLydPair({ reference: ref, usdReference: R, isUsd: ref === R, decimals: 4, skewPips, widenPips: widen, cfg: c });
const pipsFromRef = (p: Decimal) => p.minus(R).div('0.0001').toNumber();

describe('pips', () => {
  it('1 pip = 0.0001 LYD on USD/LYD; neutral quote is ±500 pips', () => {
    expect(pipUnit(D, R, R, true).toString()).toBe('0.0001');
    const q = price(0);
    expect(q.ask.toString()).toBe('9.86');
    expect(q.bid.toString()).toBe('9.76');
    expect(pipsFromRef(q.ask)).toBe(500);
    expect(pipsFromRef(q.bid)).toBe(-500);
  });

  it('other currencies take the same pips as fractions of the USD reference, with enough decimals', () => {
    const eur = new Decimal('10.6');
    const unit = pipUnit(D, eur, R, false);
    expect(unit.toNumber()).toBeCloseTo(0.0001 * 10.6 / 9.81, 12);
    expect(pairDecimals(D, eur, R, false)).toBe(4);
    expect(pairDecimals(D, new Decimal('2.67'), R, false)).toBe(5);
    expect(pairDecimals(D, new Decimal('0.2'), R, false)).toBe(6);
    const q = priceLydPair({ reference: eur, usdReference: R, isUsd: false, decimals: 4, skewPips: -500, widenPips: 0, cfg: cfg() });
    expect(q.ask.gte(eur)).toBe(true); // EUR floor is EUR's own Fulus rate
  });

  it('rounds the ask up and the bid down', () => {
    const q = price(0, 0, cfg(), new Decimal('9.81234'));
    expect(q.ask.toString()).toBe('9.8624');
    expect(q.bid.toString()).toBe('9.7623');
  });
});

describe('demand skew in discrete steps', () => {
  const c = cfg();
  it('steps up when customers buy USD and down when they sell', () => {
    expect(targetSkewPips({ imbalance: 0.5, gated: false }, c)).toBe(150);
    expect(targetSkewPips({ imbalance: 1, gated: false }, c)).toBe(300);
    expect(targetSkewPips({ imbalance: -0.5, gated: false }, c)).toBe(-250);
    expect(targetSkewPips({ imbalance: -1, gated: false }, c)).toBe(-500);
    expect(targetSkewPips({ imbalance: 0.03, gated: false }, c)).toBe(0); // rounds to 0 steps
    expect(targetSkewPips({ imbalance: 0.05, gated: false }, c)).toBe(25);
    for (let i = -1; i <= 1; i += 0.01) expect(Math.abs(targetSkewPips({ imbalance: i, gated: false }, c)) % 25).toBe(0);
  });
  it('is zero below the minimum volume or trader count', () => {
    expect(targetSkewPips({ imbalance: 1, gated: true }, c)).toBe(0);
  });
  it('moves both bid and ask in the skew direction', () => {
    const up = price(150); const down = price(-250);
    expect(pipsFromRef(up.ask)).toBe(650); expect(pipsFromRef(up.bid)).toBe(-350);
    expect(pipsFromRef(down.ask)).toBe(250); expect(pipsFromRef(down.bid)).toBe(-750);
  });
});

describe("owner's clamps: Fulus floor, capped upside, bid margin", () => {
  it('maximum seller pressure takes the ask exactly to the Fulus rate, never below', () => {
    const q = price(-500);
    expect(q.ask.toString()).toBe('9.81');
    expect(price(-5_000).ask.toString()).toBe('9.81'); // out-of-range state is clamped
    expect(price(-5_000).bid.toString()).toBe('9.71');
  });
  it('a positive floor offset keeps the ask above Fulus', () => {
    const c = cfg({ askFloorOffsetPips: 100, maxDownSkewPips: 400 });
    expect(pipsFromRef(price(-400, 0, c).ask)).toBe(100);
    expect(pipsFromRef(price(-9_999, 0, c).ask)).toBe(100);
  });
  it('maximum buyer pressure is capped at base + maxUpSkew', () => {
    expect(pipsFromRef(price(300).ask)).toBe(800);
    expect(pipsFromRef(price(99_999).ask)).toBe(800);
  });
  it('the bid stays at least minHalfSpread below Fulus even when the skew could lift it further', () => {
    const c = cfg({ maxUpSkewPips: 1_000 });
    const q = price(1_000, 0, c);
    expect(pipsFromRef(q.bid)).toBe(-100);
    expect(pipsFromRef(q.ask)).toBe(1_500);
  });
  it('widening pushes both sides out and lifts the floor', () => {
    const q = price(-500, 200);
    expect(pipsFromRef(q.ask)).toBe(200);
    expect(pipsFromRef(q.bid)).toBe(-1_200);
  });
  it('config validation enforces the floor rule and step grid', () => {
    expect(() => cfg({ maxDownSkewPips: 525 })).toThrow(/cannot exceed baseHalfSpreadPips − askFloorOffsetPips/);
    expect(() => cfg({ askFloorOffsetPips: 100 })).toThrow(/maxDownSkewPips/); // 500 > 500 − 100
    expect(() => cfg({ maxUpSkewPips: 310 })).toThrow(/multiples/);
    expect(() => cfg({ minHalfSpreadPips: 600 })).toThrow(/minHalfSpreadPips/);
    expect(() => validateMarketMakerConfig({ ...D, surprise: 1 })).toThrow(/Unknown/);
    expect(() => cfg({ pipSize: '0.0002' })).toThrow(/pipSize/);
    expect(mergeMarketMakerConfig(cfg(), { baseHalfSpreadPips: 400, maxDownSkewPips: 400 }).baseHalfSpreadPips).toBe(400);
  });
});

describe('profit invariant', () => {
  it('holds for every skew, widening, reference and valid config (randomised)', () => {
    let seed = 42;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
    for (let i = 0; i < 3_000; i++) {
      const base = 1 + Math.floor(rnd() * 2_000);
      const minHalf = 1 + Math.floor(rnd() * base);
      const floorOff = Math.floor(rnd() * (base - minHalf + 1));
      const step = [1, 5, 25, 50][Math.floor(rnd() * 4)];
      const maxDown = Math.floor((rnd() * (base - floorOff)) / step) * step;
      const maxUp = Math.floor((rnd() * 2_000) / step) * step;
      const c = cfg({ baseHalfSpreadPips: base, minHalfSpreadPips: minHalf, askFloorOffsetPips: floorOff, skewStepPips: step, maxDownSkewPips: maxDown, maxUpSkewPips: maxUp, maxSkewChangePipsPerMin: Math.max(step, 50) });
      const ref = new Decimal((5 + rnd() * 10).toFixed(5));
      const skew = Math.round((rnd() - 0.5) * 20_000); // far outside the allowed range too
      const q = priceLydPair({ reference: ref, usdReference: ref, isUsd: true, decimals: 4, skewPips: skew, widenPips: Math.floor(rnd() * 500), cfg: c });
      const unit = new Decimal(c.pipSize);
      expect(quoteInvariantViolations({ reference: ref, bid: q.bid, ask: q.ask }, c, unit)).toEqual([]);
      expect(q.ask.gte(ref.plus(unit.mul(floorOff)))).toBe(true); // never sell USD below Fulus (+offset)
      expect(q.bid.lte(ref.minus(unit.mul(minHalf)))).toBe(true); // buying USD always earns
      expect(q.ask.lte(q.askCap.toDecimalPlaces(4, Decimal.ROUND_UP))).toBe(true); // capped upside
    }
  });

  it('adversarial one-sided flow cannot push either side through the reference', () => {
    const c = cfg({ minVolumeUsd: 0, minTraders: 1 });
    const t0 = 1_800_000_000_000;
    let state = null as ReturnType<typeof advanceSkew> | null;
    for (const [k, dir] of [1, -1].entries()) {
      const start = t0 + k * 3_600_000;
      const events: FlowEvent[] = Array.from({ length: 400 }, (_, i) => ({ id: `${dir}-${i}`, userId: `u${dir}-${i}`, usd: dir * 1e6, at: start }));
      for (let m = 0; m < 60; m++) {
        const flow = summarizeFlow(events, c, start + m * 60_000);
        state = advanceSkew(state, targetSkewPips(flow, c), c, start + m * 60_000);
        const q = price(state.skewPips, 0, c);
        expect(q.ask.gte(R)).toBe(true);
        expect(q.bid.lte(R.minus('0.01'))).toBe(true);
      }
      expect(state!.skewPips).toBe(dir > 0 ? 300 : -500);
    }
  });
});

describe('flow measurement and anti-gaming', () => {
  const c = cfg();
  const t0 = 1_800_000_000_000;
  const ev = (id: string, userId: string, usd: number, at = t0): FlowEvent => ({ id, userId, usd, at });

  it("ignores a customer's own round trips (FIFO)", () => {
    const f = summarizeFlow([ev('a', 'u1', 5_000), ev('b', 'u1', -5_000, t0 + 1)], c, t0 + 2);
    expect(f.grossUsd).toBe(0);
    expect(f.roundTripUsd).toBe(5_000);
    const g = summarizeFlow([ev('a', 'u1', 5_000), ev('b', 'u1', -2_000, t0 + 1)], c, t0 + 2);
    expect(g.netUsd).toBeCloseTo(3_000, 0);
  });
  it('caps each customer and needs enough distinct customers', () => {
    const one = summarizeFlow([ev('a', 'whale', 1_000_000)], c, t0);
    expect(one.netUsd).toBe(5_000);
    expect(one.gated).toBe(true); // 1 trader < 3
    const split = summarizeFlow(Array.from({ length: 50 }, (_, i) => ev(`s${i}`, 'whale', 20_000)), c, t0);
    expect(split.traders).toBe(1); // splitting orders does not create traders
    const many = summarizeFlow(Array.from({ length: 10 }, (_, i) => ev(`m${i}`, `u${i}`, 5_000)), c, t0);
    expect(many.gated).toBe(false);
    expect(many.imbalance).toBe(1);
    expect(targetSkewPips(many, c)).toBe(300);
  });
  it('scales by depth when volume is thin, and is a ratio once deep', () => {
    const thin = summarizeFlow([ev('a', 'u1', 5_000), ev('b', 'u2', 5_000), ev('c', 'u3', -5_000)], c, t0);
    expect(thin.imbalance).toBeCloseTo(5_000 / 50_000, 6);
  });
  it('decays with the half-life, drops events outside the window and counts a fill once', () => {
    const f = summarizeFlow([ev('a', 'u1', 4_000, t0 - 3_600_000), ev('a', 'u1', 4_000, t0 - 3_600_000)], c, t0);
    expect(f.netUsd).toBeCloseTo(2_000, 0);
    expect(f.events).toBe(1);
    expect(summarizeFlow([ev('old', 'u1', 4_000, t0 - 7 * 3_600_000)], c, t0).events).toBe(0);
  });
});

describe('rate-of-change cap (token bucket)', () => {
  const c = cfg();
  const t0 = 1_800_000_000_000;
  it('moves at most maxSkewChangePipsPerMin, in whole steps', () => {
    let s = advanceSkew(null, 300, c, t0);
    expect(s.skewPips).toBe(50);
    s = advanceSkew(s, 300, c, t0 + 1_000);
    expect(s.skewPips).toBe(50); // 0.83 pips of budget: not a whole step
    s = advanceSkew(s, 300, c, t0 + 30_000);
    expect(s.skewPips).toBe(75);
    s = advanceSkew(s, 300, c, t0 + 90_000);
    expect(s.skewPips).toBe(125);
  });
  it('cannot bank a quiet period for a jump', () => {
    let s = advanceSkew(null, 0, c, t0);
    s = advanceSkew(s, -500, c, t0 + 6 * 3_600_000);
    expect(s.skewPips).toBe(-50);
  });
  it('lands exactly on the target and follows target reversals', () => {
    let s = { skewPips: 30, budgetPips: 25, at: t0 };
    s = advanceSkew(s, 0, c, t0);
    expect(s.skewPips).toBe(5); // one whole step
    s = advanceSkew(s, 0, c, t0 + 60_000);
    expect(s.skewPips).toBe(0); // the remainder lands exactly
    s = advanceSkew(s, 100, c, t0 + 120_000);
    expect(s.skewPips).toBe(50);
  });
  it('never exceeds the cap over any minute in a long adversarial sequence', () => {
    let s = advanceSkew(null, 0, c, t0);
    const hist: Array<[number, number]> = [];
    for (let k = 0; k < 2_000; k++) {
      const now = t0 + k * 997;
      s = advanceSkew(s, k % 400 < 200 ? 300 : -500, c, now);
      hist.push([now, s.skewPips]);
    }
    for (let i = 0; i < hist.length; i++) {
      for (let j = i + 1; j < hist.length && hist[j][0] - hist[i][0] <= 60_000; j++) {
        expect(Math.abs(hist[j][1] - hist[i][1])).toBeLessThanOrEqual(2 * c.maxSkewChangePipsPerMin);
      }
    }
  });
});

describe('reference health', () => {
  it('widens when stale, when held, when degraded', () => {
    const c = cfg();
    expect(widenPips({ refAgeMs: 0, held: false, degraded: false }, c)).toBe(0);
    expect(widenPips({ refAgeMs: 16 * 60_000, held: false, degraded: false }, c)).toBe(200);
    expect(widenPips({ refAgeMs: 0, held: true, degraded: true }, c)).toBe(500);
  });
  it('execution re-check: ask must stay ≥ reference, bid ≤ reference − minHalf', () => {
    const c = cfg();
    const chk = (side: 'ASK' | 'BID', p: string, ref: string) =>
      checkFillAgainstReference({ side, price: new Decimal(p), reference: new Decimal(ref), usdReference: new Decimal(ref), isUsd: true, cfg: c }).ok;
    expect(chk('ASK', '9.86', '9.81')).toBe(true);
    expect(chk('ASK', '9.86', '9.8601')).toBe(false); // market moved through our ask
    expect(chk('BID', '9.76', '9.81')).toBe(true);
    expect(chk('BID', '9.76', '9.7699')).toBe(false); // less than minHalf left
  });
});

// ── Service: references, halts, Redis, config binding, re-check ──────
describe('market-maker service', () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    MM.__resetLydMarketMakerForTests();
    for (const k of Object.keys(fulusRates)) delete fulusRates[k];
    fulusRates.USD = { rate: 9.81, checkedAgeMs: 1_000 };
    fulusRates.EUR = { rate: 10.6, checkedAgeMs: 1_000 };
    isBlocked.mockReset(); isBlocked.mockResolvedValue(false);
    redisClient = null;
    settings.clear(); approvals.clear(); audits.length = 0;
    process.env = { ...OLD };
    delete process.env.REDIS_URL;
  });
  afterAll(() => { process.env = OLD; });

  it('getRate USD/LYD and LYD/USD come from the market maker', async () => {
    const usd = await getRate('USD', 'LYD');
    expect([usd.buyPrice, usd.sellPrice, usd.source]).toEqual(['9.86000000', '9.76000000', 'live:fulus']);
    const inv = await getRate('LYD', 'USD');
    expect(Number(inv.buyPrice)).toBeCloseTo(1 / 9.76, 7);
    expect(Number(inv.buyPrice)).toBeGreaterThanOrEqual(1 / 9.76);
    expect(Number(inv.sellPrice)).toBeCloseTo(1 / 9.86, 7);
    expect(Number(inv.sellPrice)).toBeLessThanOrEqual(1 / 9.86); // rounded in our favour
    expect(inv.source).toBe('derived:fulus');
    expect(Object.keys(usd)).not.toContain('marketMaker'); // customers see only the price
  });

  it('a stale reference widens; a too-old one stops quoting; a missing one is unavailable', async () => {
    fulusRates.USD.checkedAgeMs = 20 * 60_000;
    const q = await MM.quoteLydMarket('USD');
    expect(q.quote.widenPips).toBe(200);
    expect(q.ask.toString()).toBe('9.88');
    fulusRates.USD.checkedAgeMs = 2 * 3_600_000;
    await expect(MM.quoteLydMarket('USD')).rejects.toMatchObject({ statusCode: 503 });
    delete fulusRates.TND;
    await expect(getRate('TND', 'LYD')).rejects.toThrow('Fulus rate unavailable');
  });

  it('kill switch halts the pair; a failing control lookup fails closed', async () => {
    isBlocked.mockImplementation(async (_s, key) => key === 'FX_MM:USD/LYD');
    await expect(MM.quoteLydMarket('USD')).rejects.toMatchObject({ statusCode: 503, code: 'FEATURE_DISABLED' });
    expect((await MM.quoteLydMarket('EUR')).ask.gt(10.6)).toBe(true);
    isBlocked.mockRejectedValue(new Error('db down'));
    await expect(MM.quoteLydMarket('USD')).rejects.toThrow('db down');
  });

  it('shares flow and skew through Redis (atomic script) and records each fill once', async () => {
    process.env.REDIS_URL = 'redis://test';
    const zset = new Map<string, number>();
    let skew: any = null;
    const { advanceSkew: adv } = jest.requireActual('../services/exchange/lydMarketMaker.math');
    redisClient = {
      sendCommand: jest.fn(async (args: string[]) => {
        const [cmd] = args;
        if (cmd === 'ZADD') { const isNew = !zset.has(args[3]); zset.set(args[3], Number(args[2])); return isNew ? 1 : 0; }
        if (cmd === 'ZRANGEBYSCORE') return [...zset.entries()].filter(([, s]) => s >= Number(args[2])).flatMap(([m, s]) => [m, String(s)]);
        if (cmd === 'EVAL') { // stand-in for SKEW_LUA, which mirrors advanceSkew()
          const [target, now, rate, step, up, down] = args.slice(4).map(Number);
          skew = adv(skew, target, { ...D, maxSkewChangePipsPerMin: rate, skewStepPips: step, maxUpSkewPips: up, maxDownSkewPips: down }, now);
          return [String(skew.skewPips), String(skew.budgetPips), String(skew.at)];
        }
        return 1;
      }),
    };
    for (let i = 0; i < 10; i++) {
      expect(await MM.recordLydFill({ fillId: `swap:R${i}`, userId: `u${i}`, side: 'BUY', usd: 5_000 })).toBe(true);
    }
    expect(await MM.recordLydFill({ fillId: 'swap:R0', userId: 'u0', side: 'BUY', usd: 5_000 })).toBe(false);
    const st = await MM.marketMakerState();
    expect(st.mode).toBe('SHARED');
    expect(st.targetSkewPips).toBe(300);
    expect(st.skewPips).toBe(50); // rate-limited
    const q = await MM.quoteLydMarket('USD');
    expect(q.quote.widenPips).toBe(0);
    expect(q.ask.toString()).toBe('9.865');
    expect(redisClient.sendCommand.mock.calls.some(([a]) => a[0] === 'EVAL' && a[1] === MM.SKEW_LUA)).toBe(true);
    expect(MM.takePendingVolumeUsd()).toBe(50_000);
  });

  it('falls back to a local copy and widens while Redis is down', async () => {
    process.env.REDIS_URL = 'redis://test';
    redisClient = { sendCommand: jest.fn(async () => { throw new Error('ECONNREFUSED'); }) };
    expect(await MM.recordLydFill({ fillId: 'swap:X1', userId: 'u1', side: 'SELL', usd: 1_000 })).toBe(true);
    const q = await MM.quoteLydMarket('USD');
    expect(q.state.mode).toBe('DEGRADED');
    expect(q.state.flow.events).toBe(1); // kept locally
    expect(q.quote.widenPips).toBe(200);
    expect(q.ask.toString()).toBe('9.88');
    expect(q.bid.toString()).toBe('9.74');
  });

  it('uses a stored configuration only when it is bound to an approved, audited request', async () => {
    const config = { ...D, baseHalfSpreadPips: 300, maxDownSkewPips: 300 };
    const digest = MM.configDigest(validateMarketMakerConfig(config));
    settings.set(MM.MARKET_MAKER_SETTING_KEY, JSON.stringify({ v: 1, config, approvalId: 'ap1', digest }));
    // Written directly (e.g. through the generic settings endpoint): rejected.
    expect((await MM.getMarketMakerConfig()).source).toBe('rejected');
    expect((await MM.quoteLydMarket('USD')).ask.toString()).toBe('9.86');

    // Through maker-checker: request validated, approved by someone else, applied with an audit row.
    MM.invalidateLydMarketMaker();
    settings.clear();
    const payload = { kind: MM.MARKET_MAKER_REQUEST_KIND, changes: { baseHalfSpreadPips: 300, maxDownSkewPips: 300 } };
    await expect(MM.validateMarketMakerRequest({ changes: { maxDownSkewPips: 900 } })).rejects.toMatchObject({ statusCode: 400 });
    await MM.validateMarketMakerRequest(payload);
    approvals.set('ap2', { type: 'FX_OVERRIDE', status: 'APPROVED', requestedById: 'maker', decidedById: 'checker', payload });
    await MM.applyMarketMakerRequest(payload, { requestId: 'ap2', requestedById: 'maker', approvedById: 'checker', reason: 'tighten spread for launch' });
    expect(audits.find((a) => a.action === MM.MARKET_MAKER_APPLIED_ACTION)).toBeTruthy();
    const loaded = await MM.getMarketMakerConfig();
    expect(loaded.source).toBe('approved');
    expect((await MM.quoteLydMarket('USD')).ask.toString()).toBe('9.84');

    // Tampering with the stored value afterwards is detected.
    const stored = JSON.parse(settings.get(MM.MARKET_MAKER_SETTING_KEY)!);
    stored.config.baseHalfSpreadPips = 50; stored.config.minHalfSpreadPips = 1; stored.config.maxDownSkewPips = 50;
    stored.digest = MM.configDigest(validateMarketMakerConfig(stored.config));
    settings.set(MM.MARKET_MAKER_SETTING_KEY, JSON.stringify(stored));
    MM.invalidateLydMarketMaker();
    const tampered = await MM.getMarketMakerConfig();
    expect(tampered.problem).toMatch(/audit/);
    expect(tampered.config.baseHalfSpreadPips).toBe(300); // last verified configuration stays in force
  });

  it('conversions use our ask/bid exactly and the margin journal balances', async () => {
    const buyLyd = await quoteConversion('USD', 'LYD', new Decimal('100'));
    expect(buyLyd.credited.toString()).toBe('976');
    expect(lydConversionMargin(buyLyd).toString()).toBe('5'); // 100 × 9.81 − 976
    const sellLyd = await quoteConversion('LYD', 'USD', new Decimal('1000'));
    expect(sellLyd.credited.toString()).toBe('101.41');
    expect(lydConversionMargin(sellLyd).toString()).toBe('5.167'); // 1000 − 101.41 × 9.81, rounded down to the dirham
    for (const q of [buyLyd, sellLyd]) {
      const sums = new Map<string, Decimal>();
      for (const l of conversionLedgerLegs('u1', q)) sums.set(l.currency, (sums.get(l.currency) ?? new Decimal(0)).plus(l.amount.toString()));
      for (const v of sums.values()) expect(v.isZero()).toBe(true);
      expect(conversionLedgerLegs('u1', q).find((l) => l.type === 'PLATFORM')).toBeTruthy();
    }
  });

  it('crypto quotes in LYD are priced at our side, book the FX margin, and re-check at execution', async () => {
    const q = await buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 986, side: 'BUY', settlementCurrency: 'LYD', userId: 'u1' });
    expect(Number(q.fiatAmount)).toBeCloseTo(100, 6); // 986 LYD at our 9.86 ask
    const cryptoSpread = (Number(q.quotedPrice) - Number(q.marketPrice)) * Number(q.cryptoAmount);
    expect(Number(q.spreadCapture) - cryptoSpread).toBeCloseTo(986 / 9.81 - 100, 6);
    fulusRates.USD.rate = 9.87; // market moved through our ask before execution
    await expect(consumeQuote(q.id, 'u1')).rejects.toMatchObject({ statusCode: 409 });

    fulusRates.USD.rate = 9.81;
    const s = await buildQuote({ asset: 'BTC', network: 'BTC', cryptoAmount: 0.001, side: 'SELL', settlementCurrency: 'LYD', userId: 'u1' });
    expect(Number(s.settlementAmount) / Number(s.fiatAmount)).toBeLessThanOrEqual(9.76);
    expect((await consumeQuote(s.id, 'u1'))?.id).toBe(s.id); // unchanged market: fills
  });

  it('refuses to treat an unpriced currency as USD (old 1:1 fallback)', async () => {
    delete fulusRates.USD;
    await expect(buildQuote({ asset: 'BTC', network: 'BTC', fiatAmount: 1000, side: 'BUY', settlementCurrency: 'LYD' })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('turns committed swap and crypto rows into attributed fills', () => {
    const ref = new Decimal('9.81');
    const at = new Date(1_800_000_000_000);
    const sold = MM.fillFromSwapRow({ id: 't1', userId: 'u1', type: 'SELL', amount: '-1000', reference: 'SWP-1', createdAt: at, metadata: { kind: 'swap', counterparty: 'USD', rate: String(101.41 / 1000) } }, ref)!;
    expect(sold).toMatchObject({ fillId: 'swap:SWP-1', userId: 'u1', side: 'BUY', usd: 101.41 });
    expect(sold.marginLyd!).toBeGreaterThan(0);
    const bought = MM.fillFromSwapRow({ id: 't2', userId: 'u2', type: 'BUY', amount: '976', reference: 'SWP-2', createdAt: at, metadata: { kind: 'swap', counterparty: 'USDT', rate: '9.76' } }, ref)!;
    expect(bought).toMatchObject({ side: 'SELL', usd: 100 });
    expect(bought.marginLyd!).toBeCloseTo(5, 6);
    const row = { id: 't3', userId: 'u3', type: 'BUY', amount: '-986', reference: 'CRPT', createdAt: at, metadata: { kind: 'crypto_order', settlementCurrency: 'LYD', orderId: 'o1', fiatAmount: '100.00', settlementAmount: '986.00' } };
    expect(MM.fillFromCryptoRow(row, 'FAILED', ref)).toBeNull();
    expect(MM.fillFromCryptoRow(row, 'EXECUTED', ref)).toMatchObject({ fillId: 'crypto:o1', side: 'BUY', usd: 100 });
  });
});
