// AML limits tests — uses the exported KYC_LIMITS table and toUsd helper directly
// (kycLimits.ts does not export a getKYCLimits function; enforceKycLimit requires
// a live Prisma connection, so we test the data and toUsd helper in isolation.)

// Stub out @prisma/client and the prisma singleton before importing the module
jest.mock('@prisma/client', () => {
  const KYCTier = {
    TIER_0: 'TIER_0',
    TIER_1: 'TIER_1',
    TIER_2: 'TIER_2',
    TIER_3: 'TIER_3',
  };
  const TransactionType = {
    TRANSFER_OUT: 'TRANSFER_OUT',
    WITHDRAWAL: 'WITHDRAWAL',
    BUY: 'BUY',
    SELL: 'SELL',
  };
  const Prisma = { Decimal: Number };
  return { KYCTier, TransactionType, Prisma };
});

jest.mock('../utils/prisma', () => ({ prisma: {} }));
jest.mock('../middleware/errorHandler', () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

import { KYC_LIMITS, toUsd } from '../utils/kycLimits';

describe('KYC Tier Limits — data integrity', () => {
  it('TIER_0 WITHDRAW daily limit is 0 (blocked)', () => {
    expect(KYC_LIMITS.TIER_0.WITHDRAW.daily).toBe(0);
  });

  it('TIER_0 OFFRAMP_SELL daily limit is 0 (blocked)', () => {
    expect(KYC_LIMITS.TIER_0.OFFRAMP_SELL.daily).toBe(0);
  });

  it('TIER_1 has higher withdrawal limit than TIER_0', () => {
    expect(KYC_LIMITS.TIER_1.WITHDRAW.daily).toBeGreaterThan(KYC_LIMITS.TIER_0.WITHDRAW.daily);
  });

  it('TIER_3 has the highest daily withdrawal limit', () => {
    expect(KYC_LIMITS.TIER_3.WITHDRAW.daily).toBeGreaterThanOrEqual(KYC_LIMITS.TIER_2.WITHDRAW.daily);
    expect(KYC_LIMITS.TIER_3.WITHDRAW.daily).toBeGreaterThanOrEqual(KYC_LIMITS.TIER_1.WITHDRAW.daily);
  });

  it('returns limits for all tiers without throwing', () => {
    const tiers = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'] as const;
    tiers.forEach(tier => {
      expect(() => KYC_LIMITS[tier]).not.toThrow();
      expect(KYC_LIMITS[tier]).toBeDefined();
    });
  });

  it('each tier has all four action types defined', () => {
    const actions = ['SEND', 'WITHDRAW', 'ONRAMP_BUY', 'OFFRAMP_SELL'] as const;
    const tiers = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'] as const;
    tiers.forEach(tier => {
      actions.forEach(action => {
        const limit = KYC_LIMITS[tier][action];
        expect(limit).toBeDefined();
        expect(typeof limit.daily).toBe('number');
        expect(typeof limit.monthly).toBe('number');
        expect(typeof limit.perTx).toBe('number');
      });
    });
  });
});

describe('toUsd conversion', () => {
  it('converts USDT 1:1', () => {
    expect(toUsd(100, 'USDT')).toBe(100);
  });

  it('converts BTC at the static rate', () => {
    // BTC static rate is 65_000 in kycLimits.ts
    expect(toUsd(1, 'BTC')).toBe(65_000);
  });

  it('converts LYD at 0.21', () => {
    expect(toUsd(1000, 'LYD')).toBeCloseTo(210, 5);
  });

  it('uses rate 1 for unknown currencies', () => {
    expect(toUsd(500, 'UNKNOWN_COIN')).toBe(500);
  });

  it('returns absolute value for negative amounts', () => {
    expect(toUsd(-100, 'USDT')).toBe(100);
  });
});
