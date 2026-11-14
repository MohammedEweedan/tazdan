/**
 * What the apps may show one viewer: the environment flags, narrowed by the
 * launch scope in production and then by availability rules. Served at
 * GET /api/features (signed-in viewers get their own allow/deny lists) and
 * by the cockpit's "see as customer" preview.
 */
import { featureFlags, type FeatureName } from '../../utils/features';
import { isProduction } from '../../utils/env';
import { currentLaunchReadiness, isRealMoneyEnabled } from '../ops/launchReadiness.service';
import { availabilityFor, type AvailabilityFeature, type Viewer } from './availability.service';

/** Launch-scope feature behind each app flag. */
const LAUNCH_SCOPE: Record<FeatureName, string> = {
  p2p: 'p2p', cards: 'cards', altTrading: 'fx', blockchain: 'blockchain', cryptoTrading: 'fx', remittance: 'remittance', lydt: 'lydt',
};

/** Availability feature behind each app flag. */
const PRODUCT: Record<FeatureName, AvailabilityFeature> = {
  p2p: 'p2p', cards: 'cards', altTrading: 'crypto_trading', blockchain: 'blockchain', cryptoTrading: 'crypto_trading', remittance: 'remittance', lydt: 'lydt',
};

export async function clientFeatures(viewer: Viewer) {
  const flags = featureFlags();
  if (isProduction()) {
    const report = currentLaunchReadiness();
    const open = isRealMoneyEnabled() && report.ok;
    for (const key of Object.keys(flags) as FeatureName[]) {
      flags[key] = flags[key] && open && Boolean(report.evidence?.scope.features.includes(LAUNCH_SCOPE[key] as any));
    }
  }
  const availability = await availabilityFor(viewer);
  for (const key of Object.keys(flags) as FeatureName[]) {
    if (availability.features[PRODUCT[key]]?.state !== 'AVAILABLE') flags[key] = false;
  }
  return { features: flags, availability };
}
