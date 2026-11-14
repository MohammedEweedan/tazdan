jest.mock('../utils/prisma', () => ({ prisma: {
  platformSettings: { findUnique: jest.fn(), upsert: jest.fn() },
} }));
jest.mock('../utils/logger', () => ({ logger: { error: jest.fn(), info: jest.fn() } }));

import { prisma } from '../utils/prisma';
import { isTradingHalted, setTradingHalt } from '../services/ledger/reconcile.service';

const read = prisma.platformSettings.findUnique as jest.Mock;
const write = prisma.platformSettings.upsert as jest.Mock;

describe('shared financial halt failures', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    read.mockReset(); write.mockReset();
    write.mockResolvedValue({ value: '0' });
    await setTradingHalt(false, 'test reset');
    jest.advanceTimersByTime(5_001);
  });
  afterEach(() => { jest.useRealTimers(); });

  it('blocks when the shared read fails after a healthy state expires', async () => {
    read.mockRejectedValue(new Error('database unavailable'));
    expect(await isTradingHalted()).toBe(true);
  });

  it('does not clear a local halt when persistence of clearance fails', async () => {
    await setTradingHalt(true, 'integrity discrepancy');
    write.mockRejectedValue(new Error('database unavailable'));
    await expect(setTradingHalt(false, 'attempted clearance')).rejects.toThrow();
    expect(await isTradingHalted()).toBe(true);
  });

  it('keeps this process halted when writing a new halt fails', async () => {
    write.mockRejectedValue(new Error('database unavailable'));
    await expect(setTradingHalt(true, 'integrity discrepancy')).rejects.toThrow();
    jest.advanceTimersByTime(5_001);
    read.mockResolvedValue({ value: '0' });
    expect(await isTradingHalted()).toBe(true);
  });

  it('recovers only after the shared state can be read again', async () => {
    read.mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValue({ value: '1' });
    expect(await isTradingHalted()).toBe(true);
    expect(await isTradingHalted()).toBe(true);
    jest.advanceTimersByTime(5_001);
    read.mockResolvedValue({ value: '0' });
    expect(await isTradingHalted()).toBe(false);
  });
});
