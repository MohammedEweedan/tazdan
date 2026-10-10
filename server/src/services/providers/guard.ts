/**
 * Production guard for provider adapters.
 *
 * Mock and sandbox adapters exist so internal flows can be exercised end to
 * end. They must never execute against customer money in production: a mock
 * that reports "COMPLETED" is a fake money movement. In production, any
 * call through a MOCK or SANDBOX adapter is refused with
 * PROVIDER_NOT_ACTIVATED until a real provider is configured.
 *
 * Labels used across the platform and documentation:
 *   INTERNAL IMPLEMENTATION COMPLETE — EXTERNAL PROVIDER ACTIVATION REQUIRED
 */
import { AppError } from '../../middleware/errorHandler';

export type AdapterMode = 'PRODUCTION' | 'SANDBOX' | 'MOCK';

export function adapterModeOf(name: string): AdapterMode {
  const n = name.toUpperCase();
  if (n === 'MOCK' || n.startsWith('MOCK_')) return 'MOCK';
  if (n.startsWith('SANDBOX')) return 'SANDBOX';
  return 'PRODUCTION';
}

export const isProductionEnv = () => process.env.NODE_ENV === 'production';

export function assertAdapterUsable(category: string, adapterName: string): void {
  const mode = adapterModeOf(adapterName);
  if (mode !== 'PRODUCTION' && isProductionEnv()) {
    throw new AppError(
      `${category} is not available yet — external provider activation required.`,
      503,
      'PROVIDER_NOT_ACTIVATED',
      { category, adapter: adapterName, mode },
    );
  }
}
