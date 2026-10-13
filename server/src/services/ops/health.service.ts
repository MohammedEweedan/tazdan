import { prisma } from '../../utils/prisma';
import { getRedisClient } from '../../utils/redis';
import { isTradingHalted } from '../ledger/reconcile.service';
import { currentLaunchReadiness, isRealMoneyEnabled } from './launchReadiness.service';

export async function withDeadline<T>(work: Promise<T>, ms = 1500): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Dependency deadline exceeded')), ms); timer.unref(); })]);
  } finally { if (timer) clearTimeout(timer); }
}
let pending: Promise<Awaited<ReturnType<typeof inspectDependencies>>> | null = null;
async function inspectDependencies() {
  const redis = getRedisClient();
  const [database, cache, halt] = await Promise.allSettled([
    withDeadline(prisma.$queryRaw`SELECT 1`),
    redis ? withDeadline(redis.ping()) : Promise.reject(new Error('Shared cache unavailable')),
    withDeadline(isTradingHalted()),
  ]);
  const checks = { database: database.status === 'fulfilled' ? 'ok' : 'error', redis: cache.status === 'fulfilled' ? 'ok' : 'error' };
  const dependenciesReady = Object.values(checks).every(x => x === 'ok');
  const launch = process.env.NODE_ENV !== 'production' || (isRealMoneyEnabled() && currentLaunchReadiness().ok);
  const moneyReady = dependenciesReady && launch && halt.status === 'fulfilled' && !halt.value;
  return { dependenciesReady, moneyReady, checks };
}
let cached: Awaited<ReturnType<typeof inspectDependencies>> | null = null;
let at = 0;
/** Single-flight and short cache avoid unauthenticated health checks flooding DB. */
export async function dependencyReadiness() {
  if (cached && Date.now() - at < 1000) return cached;
  if (!pending) pending = inspectDependencies().then(result => { cached = result; at = Date.now(); return result; }).finally(() => { pending = null; });
  return pending;
}
