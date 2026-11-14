import { Decimal } from '@prisma/client/runtime/library';
jest.mock('../utils/prisma', () => ({ prisma: {} }));
jest.mock('../services/exchange/fxRateProvider.service', () => ({ getRate: jest.fn() }));
import { collectFee } from '../services/fee/feeCollector.service';
import { getRate } from '../services/exchange/fxRateProvider.service';

const input = { source: 'withdrawal' as const, sourceId: 'withdrawal-1', payerId: 'customer', amount: '10', currency: 'GBP' };
function transaction() {
  return {
    $executeRaw: jest.fn().mockResolvedValue(0),
    platformFee: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'fee-1', ...data })) },
    wallet: { upsert: jest.fn() }, ledgerEntry: { create: jest.fn() }, user: { create: jest.fn(), findFirst: jest.fn() },
  };
}
describe('fee reporting preserves native money', () => {
  beforeEach(() => jest.clearAllMocks());
  it('records a valuation without issuing corporate USDT or a fictional FX conversion', async () => {
    (getRate as jest.Mock).mockResolvedValue({ sellPrice: '1.25', source: 'test-live', fetchedAt: new Date() });
    const tx = transaction();
    await collectFee({ ...input, tx });
    const data = tx.platformFee.create.mock.calls[0][0].data;
    expect(data.currency).toBe('GBP'); expect(data.amount.toString()).toBe('10'); expect(data.amountUsd.toString()).toBe('12.5');
    expect(tx.wallet.upsert).not.toHaveBeenCalled(); expect(tx.ledgerEntry.create).not.toHaveBeenCalled(); expect(tx.user.create).not.toHaveBeenCalled();
  });
  it('preserves unpriced revenue and rejects historical fallback rates', async () => {
    (getRate as jest.Mock).mockResolvedValue({ sellPrice: '1.25', source: 'fallback', fetchedAt: new Date() });
    const tx = transaction(); await collectFee({ ...input, tx });
    expect(tx.platformFee.create.mock.calls[0][0].data).toMatchObject({ amountUsd: null, valuationSource: 'UNPRICED', currency: 'GBP' });
  });
  it('replays the same fee once and rejects altered terms', async () => {
    const tx = transaction(); tx.platformFee.findFirst.mockResolvedValue({ id: 'fee-existing', amount: new Decimal(10), currency: 'GBP' });
    expect(await collectFee({ ...input, tx })).toBe('fee-existing');
    expect(tx.platformFee.create).not.toHaveBeenCalled();
    await expect(collectFee({ ...input, tx, amount: '11' })).rejects.toMatchObject({ statusCode: 409 });
  });
});
