// Global test setup — sets minimum env vars needed for validateEnv() to pass
// so importing index.ts in integration tests doesn't crash.

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-at-least-16-chars-long-00000000';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-at-least-16-chars-0000000';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.DISABLE_RECURRING_BUY_SCHEDULER = process.env.DISABLE_RECURRING_BUY_SCHEDULER ?? '1';
process.env.LEDGER_BACKFILL_ON_BOOT = process.env.LEDGER_BACKFILL_ON_BOOT ?? '0';
process.env.FUND_AUDIT_HALT = process.env.FUND_AUDIT_HALT ?? '0';
