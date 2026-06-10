-- TRY and TND are Fulus corridor currencies (TRY/LYD, TND/LYD parallel
-- rates) but were missing from the Currency enum — every attempt to
-- persist their ExchangeRate rows threw "Expected Currency".
-- ALTER TYPE ... ADD VALUE is non-transactional-safe on PG; each statement
-- stands alone and IF NOT EXISTS makes re-runs idempotent.
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'TRY';
ALTER TYPE "Currency" ADD VALUE IF NOT EXISTS 'TND';
