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
  }

  if (process.env.REDIS_URL !== undefined && process.env.REDIS_URL.trim().length === 0) {
    fail('REDIS_URL is set but empty. Remove it or set a valid Redis connection string.');
  }
}

export const isProduction = () => process.env.NODE_ENV === 'production';
