// Deposit-verification unit tests — pure logic, no real network.
import {
  unverifiedDepositsAllowed,
  tronBase58ToHex,
} from '../services/wallet/depositVerification.service';

const OLD_ENV = process.env;
beforeEach(() => {
  process.env = { ...OLD_ENV };
});
afterEach(() => {
  process.env = OLD_ENV;
});

describe('unverifiedDepositsAllowed', () => {
  it('is allowed under NODE_ENV=test (jest default)', () => {
    process.env.NODE_ENV = 'test';
    expect(unverifiedDepositsAllowed()).toBe(true);
  });

  it('is NEVER allowed in production, even with the flag set', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_UNVERIFIED_DEPOSITS = '1';
    expect(unverifiedDepositsAllowed()).toBe(false);
  });

  it('requires the explicit flag outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_UNVERIFIED_DEPOSITS;
    expect(unverifiedDepositsAllowed()).toBe(false);
    process.env.ALLOW_UNVERIFIED_DEPOSITS = '1';
    expect(unverifiedDepositsAllowed()).toBe(true);
  });
});

describe('tronBase58ToHex', () => {
  it('decodes the canonical USDT TRC-20 contract address', () => {
    // TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t ↔ 41a614f803b6fd780986a42c78ec9c7f77e6ded13c
    expect(tronBase58ToHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(
      '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
    );
  });

  it('rejects garbage that is not base58', () => {
    expect(() => tronBase58ToHex('not-an-address-0OIl')).toThrow();
  });

  it('rejects addresses with the wrong decoded length', () => {
    expect(() => tronBase58ToHex('TQQg4')).toThrow();
  });
});
