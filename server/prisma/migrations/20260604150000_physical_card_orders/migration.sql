-- Physical card orders: a virtual card can request a physical print for a fee.

DO $$ BEGIN
  CREATE TYPE "CardOrderStatus" AS ENUM ('NONE', 'REQUESTED', 'PRINTING', 'SHIPPED', 'DELIVERED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Card"
  ADD COLUMN IF NOT EXISTS "physicalStatus"    "CardOrderStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "physicalOrderedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "physicalFee"       DECIMAL(20,8),
  ADD COLUMN IF NOT EXISTS "shippingName"      TEXT,
  ADD COLUMN IF NOT EXISTS "shippingLine1"     TEXT,
  ADD COLUMN IF NOT EXISTS "shippingLine2"     TEXT,
  ADD COLUMN IF NOT EXISTS "shippingCity"      TEXT,
  ADD COLUMN IF NOT EXISTS "shippingPostcode"  TEXT,
  ADD COLUMN IF NOT EXISTS "shippingCountry"   TEXT,
  ADD COLUMN IF NOT EXISTS "shippingPhone"     TEXT;
