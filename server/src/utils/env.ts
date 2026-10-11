/**
 * Startup environment validation. Fails fast if a money-handling server is
 * missing a secret that would silently fall back to a default in code.
 *
 * Call once from src/index.ts before any router is mounted.
 */
import { currentLaunchReadiness } from '../services/ops/launchReadiness.service';
import { custodyMode } from '../services/wallet/custodyProvider.service';

const REQUIRED_ALWAYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'] as const;

const REQUIRED_IN_PRODUCTION = [
  'CLIENT_URL',
  'DEPOSIT_WEBHOOK_SECRET',
  'REDIS_URL',
] as const;

const PLACEHOLDER_FRAGMENTS = [
  'change-in-production',
  'your-super-secret',
  'your-refresh-secret',
  'changeme',
  'placeholder',
];

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(`\n[env] ${msg}\n`);
  process.exit(1);
}

function warn(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn(`\n[env] ${msg}\n`);
}

function parseDbUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function validateEnv() {
  const env = process.env.NODE_ENV ?? 'development';
  const isProd = env === 'production';

  for (const key of REQUIRED_ALWAYS) {
    const v = process.env[key];
    if (!v || v.length < 16) {
      fail(`Missing or too-short ${key}. Generate with: openssl rand -hex 48`);
    }
    const lower = v.toLowerCase();
    if (PLACEHOLDER_FRAGMENTS.some((p) => lower.includes(p))) {
      fail(`${key} looks like the placeholder value. Replace before starting.`);
    }
  }

  if (isProd) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!process.env[key]) fail(`Missing required production env: ${key}`);
    }
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DEPOSIT_WEBHOOK_SECRET']) {
      if ((process.env[key]?.length ?? 0) < 32) fail(`${key} must contain at least 32 characters in production.`);
    }
    if (new Set([process.env.JWT_SECRET, process.env.JWT_REFRESH_SECRET, process.env.DEPOSIT_WEBHOOK_SECRET]).size !== 3) {
      fail('JWT, refresh and deposit webhook secrets must differ in production.');
    }

    // MOCK KYC approves any uploaded file, which would let unverified users
    // unlock withdrawals. Unset means MANUAL (admin review) in production.
    if ((process.env.KYC_PROVIDER ?? '').toUpperCase() === 'MOCK') {
      fail('KYC_PROVIDER=MOCK auto-approves identity checks and is not allowed in production. Use MANUAL or a real provider.');
    }

    const dbUrl = parseDbUrl(process.env.DATABASE_URL ?? '');
    if (!dbUrl) fail('DATABASE_URL must be a valid PostgreSQL connection URL.');
    const isLocalDb = ['localhost', '127.0.0.1', '::1'].includes(dbUrl.hostname);
    if (!isLocalDb && dbUrl.searchParams.get('sslmode') !== 'require') {
      fail('Production DATABASE_URL for a remote database must include sslmode=require.');
    }
    const connectionLimit = Number.parseInt(dbUrl.searchParams.get('connection_limit') ?? process.env.DB_CONNECTION_LIMIT ?? '3', 10);
    if (Number.isFinite(connectionLimit) && connectionLimit > 10) {
      fail('Production DB connection_limit is too high. Use <=10 per app process; 3 is recommended on small managed Postgres plans.');
    }
    const clusterWorkers = Number.parseInt(process.env.CLUSTER_WORKERS ?? '1', 10);
    if (Number.isFinite(connectionLimit) && Number.isFinite(clusterWorkers) && connectionLimit * clusterWorkers > 20) {
      warn(`DB pool budget is ${connectionLimit * clusterWorkers} connections (${connectionLimit} x ${clusterWorkers}). Confirm your Postgres plan can handle this.`);
    }

    if (process.env.MASTER_SEED_ENC_KEY || process.env.MASTER_SEED_KMS_KEY_ID || process.env.MASTER_SEED_PASSPHRASE) {
      fail('Production API processes must not hold master-seed keys or KMS decrypt configuration. Move custody to an isolated provider.');
    }
    try { custodyMode(); } catch { fail('Production CUSTODY_MODE must be disabled or remote.'); }
    for (const origin of process.env.CLIENT_URL!.split(',')) {
      try {
        const url = new URL(origin.trim());
        if (url.protocol !== 'https:' || url.origin !== origin.trim()) throw new Error();
      } catch { fail('Production CLIENT_URL must contain HTTPS origins only.'); }
    }
    if (process.env.REAL_MONEY_ENABLED === '1') {
      if (process.env.FUND_AUDIT_HALT !== '1') fail('Real-money operation requires FUND_AUDIT_HALT=1.');
      if (process.env.LEDGER_BACKFILL_ON_BOOT !== '0') fail('Real-money operation requires LEDGER_BACKFILL_ON_BOOT=0.');
      const readiness = currentLaunchReadiness();
      if (!readiness.ok) fail(`Launch verification failed: ${readiness.problems.join('; ')}`);
      if ((process.env.FEATURE_BLOCKCHAIN === '1' || process.env.FEATURE_CRYPTO_TRADING === '1') && custodyMode() !== 'remote') fail('Crypto activity requires an isolated custody provider.');
    }
    if (custodyMode() === 'remote') {
      if ((process.env.CUSTODY_PROVIDER_CODE?.length ?? 0) < 2) fail('A reviewed CUSTODY_PROVIDER_CODE is required.');
      if ((process.env.CUSTODY_PROVIDER_TOKEN?.length ?? 0) < 32) fail('A custody provider credential is required.');
      try {
        const url = new URL(process.env.CUSTODY_PROVIDER_URL ?? '');
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
      } catch { fail('CUSTODY_PROVIDER_URL must be an HTTPS endpoint without embedded credentials.'); }
    }
  }

  if (process.env.REDIS_URL !== undefined && process.env.REDIS_URL.trim().length === 0) {
    fail('REDIS_URL is set but empty. Remove it or set a valid Redis connection string.');
  }
}

export const isProduction = () => process.env.NODE_ENV === 'production';
