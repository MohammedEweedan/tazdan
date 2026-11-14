/**
 * Production switches for product surfaces whose money paths are not yet
 * safe to open to NEW activity.
 *
 * Each flag reads FEATURE_<NAME>: '1' turns it on, '0' turns it off, and when
 * unset it is on outside production and OFF in production.
 *
 * Switching a feature off blocks new activity only. Endpoints that let users
 * finish or unwind something they already started (cancel a listing, complete
 * an open trade, cancel a card) stay open so no funds get stranded.
 */
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';

export type FeatureName = 'p2p' | 'cards' | 'altTrading' | 'blockchain' | 'cryptoTrading' | 'remittance' | 'lydt';

const ENV_KEYS: Record<FeatureName, string> = {
  p2p: 'FEATURE_P2P',
  cards: 'FEATURE_CARDS',
  altTrading: 'FEATURE_ALT_TRADING',
  blockchain: 'FEATURE_BLOCKCHAIN',
  cryptoTrading: 'FEATURE_CRYPTO_TRADING',
  remittance: 'FEATURE_REMITTANCE',
  // LYDT dinar token: a sandbox until the Central Bank of Libya authorises it.
  lydt: 'FEATURE_LYDT',
};

export function isFeatureEnabled(name: FeatureName): boolean {
  // The legacy execution path credits assets before the venue responds and
  // refunds ambiguous transport failures. Keep real money out until the
  // reserve/submit/reconcile/finalise saga has provider certification.
  if (name === 'cryptoTrading' && process.env.NODE_ENV === 'production' && process.env.REAL_MONEY_ENABLED === '1') return false;
  const raw = process.env[ENV_KEYS[name]];
  if (raw === '1') return true;
  if (raw === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

/** Current state of every flag — served publicly so the apps can hide UI. */
export function featureFlags(): Record<FeatureName, boolean> {
  return {
    p2p: isFeatureEnabled('p2p'),
    cards: isFeatureEnabled('cards'),
    altTrading: isFeatureEnabled('altTrading'),
    blockchain: isFeatureEnabled('blockchain'),
    cryptoTrading: isFeatureEnabled('cryptoTrading'),
    remittance: isFeatureEnabled('remittance'),
    lydt: isFeatureEnabled('lydt'),
  };
}

export function assertFeatureEnabled(name: FeatureName): void {
  if (!isFeatureEnabled(name)) {
    throw new AppError('This feature is temporarily unavailable.', 503);
  }
}

export function requireFeature(name: FeatureName) {
  return (_req: Request, _res: Response, next: NextFunction) => {
    if (isFeatureEnabled(name)) return next();
    next(new AppError('This feature is temporarily unavailable.', 503));
  };
}
