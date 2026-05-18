// Financial math precision tests — critical for a fintech app
import Decimal from 'decimal.js';

Decimal.set({ precision: 40 });

describe('Decimal financial arithmetic', () => {
  it('avoids floating point errors in addition', () => {
    const result = new Decimal('0.1').plus('0.2');
    expect(result.toFixed(1)).toBe('0.3');
  });

  it('computes fee correctly (0.5% of 1000)', () => {
    const amount = new Decimal('1000');
    const fee = amount.mul('0.005');
    expect(fee.toFixed(2)).toBe('5.00');
  });

  it('handles micro amounts without losing precision', () => {
    const amount = new Decimal('0.00000001'); // 1 satoshi
    const fee = amount.mul('0.001');
    // Use toFixed to force non-scientific notation for small values
    expect(fee.toFixed(11)).toBe('0.00000000001');
  });

  it('correctly computes spread on BUY', () => {
    const marketPrice = new Decimal('50000');
    const spread = new Decimal('0.005');
    const quotedPrice = marketPrice.mul(new Decimal(1).plus(spread));
    expect(quotedPrice.toFixed(2)).toBe('50250.00');
  });

  it('correctly computes spread on SELL', () => {
    const marketPrice = new Decimal('50000');
    const spread = new Decimal('0.005');
    const quotedPrice = marketPrice.mul(new Decimal(1).minus(spread));
    expect(quotedPrice.toFixed(2)).toBe('49750.00');
  });

  it('returns Infinity when dividing by zero (use explicit zero-guard in prod)', () => {
    // Decimal.js returns Infinity rather than throwing; production code must
    // guard against zero divisor before calling .div().
    const result = new Decimal('100').div('0');
    expect(result.isFinite()).toBe(false);
  });

  it('correctly handles large numbers (LYD volumes)', () => {
    const volume = new Decimal('1000000.000000');
    const fee = volume.mul('0.005');
    expect(fee.toFixed(2)).toBe('5000.00');
  });
});
