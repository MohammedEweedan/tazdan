jest.mock('../utils/prisma', () => ({ prisma: { controlSwitch: { findMany: jest.fn().mockResolvedValue([]) } } }));
jest.mock('../services/ops/launchReadiness.service', () => ({ assertLaunchMovement: jest.fn() }));
jest.mock('../services/ledger/reconcile.service', () => ({ isTradingHalted: jest.fn() }));
jest.mock('../utils/redis', () => ({ getRedisClient: jest.fn() }));
import { assertMovementAllowed } from '../services/platform/controls.service';
import { getRedisClient } from '../utils/redis';
import { isTradingHalted } from '../services/ledger/reconcile.service';
const old = process.env.NODE_ENV;
afterEach(() => { process.env.NODE_ENV = old; });
it('refuses new production movements without shared coordination', async () => {
  process.env.NODE_ENV = 'production'; (getRedisClient as jest.Mock).mockReturnValue(null);
  await expect(assertMovementAllowed({ feature: 'transfers' })).rejects.toThrow(/coordination/);
});
it('a shared integrity halt blocks all guarded money paths', async () => {
  process.env.NODE_ENV = 'test'; (isTradingHalted as jest.Mock).mockResolvedValue(true);
  await expect(assertMovementAllowed({ feature: 'deposits' })).rejects.toThrow(/integrity/);
  (isTradingHalted as jest.Mock).mockResolvedValue(false);
  await expect(assertMovementAllowed({ feature: 'deposits' })).resolves.toBeUndefined();
});
