/**
 * Startup environment validation. Fails fast if a money-handling server is
 * missing a secret that would silently fall back to a default in code.
 *
 * Call once from src/index.ts before any router is mounted.
 */

const REQUIRED_ALWAYS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'] as const;

const REQUIRED_IN_PRODUCTION = [
  'MASTER_SEED_ENC_KEY',
  'CLIENT_URL',
  'DEPOSIT_WEBHOOK_SECRET',
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
    const masterKey = process.env.MASTER_SEED_ENC_KEY;
    if (masterKey && !/^[0-9a-fA-F]{64}$/.test(masterKey)) {
      fail('MASTER_SEED_ENC_KEY must be 32 bytes hex (64 hex chars).');
    }
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
      fail('JWT_SECRET and JWT_REFRESH_SECRET must differ in production.');
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

    // ── Custody key posture ─────────────────────────────────────────
    // With only MASTER_SEED_ENC_KEY, one env leak + one DB read = every
    // user's crypto. KMS envelope encryption removes that single point:
    // the data key is decryptable only via an AWS KMS call the attacker
    // can't make. Loud on every prod boot; hard-fail once the org is
    // ready to enforce it (MASTER_SEED_REQUIRE_KMS=1).
    if (!process.env.MASTER_SEED_KMS_KEY_ID) {
      if (process.env.MASTER_SEED_REQUIRE_KMS === '1') {
        fail(
          'MASTER_SEED_KMS_KEY_ID is not set but MASTER_SEED_REQUIRE_KMS=1. ' +
          'Configure AWS KMS envelope encryption (see docs/runbooks/custody-kms.md) before starting.'
        );
      }
      warn(
        'CUSTODY RISK: master seed is protected only by MASTER_SEED_ENC_KEY in the environment. ' +
        'A server+DB compromise exposes ALL user funds. Enable KMS envelope encryption ' +
        '(MASTER_SEED_KMS_KEY_ID — see docs/runbooks/custody-kms.md), then set MASTER_SEED_REQUIRE_KMS=1.'
      );
    }
  }

  if (process.env.REDIS_URL !== undefined && process.env.REDIS_URL.trim().length === 0) {
    fail('REDIS_URL is set but empty. Remove it or set a valid Redis connection string.');
  }
}

export const isProduction = () => process.env.NODE_ENV === 'production';
