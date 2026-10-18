-- Fail on unresolved legacy duplicates/invalid identities instead of silently
-- merging financial evidence. Rehearse on a restored production copy first.
CREATE UNIQUE INDEX "LedgerAccount_system_identity_idx"
  ON "LedgerAccount" ("type", "currency") WHERE "userId" IS NULL;

CREATE UNIQUE INDEX "TreasuryMovement_manual_reference_idx"
  ON "TreasuryMovement" ("poolId", "type", "reference")
  WHERE "type" IN ('PREFUND', 'WITHDRAW', 'ADJUST_IN', 'ADJUST_OUT') AND "reference" IS NOT NULL;

ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_owner_check"
  CHECK (("type" = 'USER') = ("userId" IS NOT NULL));
ALTER TABLE "AssetLedgerAccount" ADD CONSTRAINT "AssetLedgerAccount_owner_check"
  CHECK (("type" = 'USER') = ("userId" IS NOT NULL));
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_finite_check" CHECK ("balance" <> 'NaN'::numeric);
ALTER TABLE "AssetLedgerAccount" ADD CONSTRAINT "AssetLedgerAccount_finite_check" CHECK ("balance" <> 'NaN'::numeric);
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_finite_check" CHECK ("amount" <> 'NaN'::numeric);
ALTER TABLE "AssetLedgerEntry" ADD CONSTRAINT "AssetLedgerEntry_finite_check" CHECK ("amount" <> 'NaN'::numeric);

CREATE OR REPLACE FUNCTION tazdan_check_ledger_group_balanced() RETURNS trigger AS $$
DECLARE s numeric;
BEGIN
  EXECUTE format('SELECT COALESCE(SUM("amount"), 0) FROM %I."LedgerEntry" WHERE "groupId" = $1 AND "currency"::text = $2', TG_TABLE_SCHEMA)
    INTO s USING NEW."groupId", NEW."currency"::text;
  IF s <> 0 THEN
    RAISE EXCEPTION 'Unbalanced ledger group % for %: legs sum to %', NEW."groupId", NEW."currency", s USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION tazdan_check_asset_group_balanced() RETURNS trigger AS $$
DECLARE s numeric;
BEGIN
  EXECUTE format('SELECT COALESCE(SUM("amount"), 0) FROM %I."AssetLedgerEntry" WHERE "groupId" = $1 AND "asset" = $2', TG_TABLE_SCHEMA)
    INTO s USING NEW."groupId", NEW."asset";
  IF s <> 0 THEN
    RAISE EXCEPTION 'Unbalanced asset ledger group % for %: legs sum to %', NEW."groupId", NEW."asset", s USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "AssetLedgerEntry_balanced_group" AFTER INSERT ON "AssetLedgerEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tazdan_check_asset_group_balanced();

CREATE FUNCTION tazdan_check_entry_account_currency() RETURNS trigger AS $$
DECLARE matches boolean;
BEGIN
  IF TG_TABLE_NAME = 'LedgerEntry' THEN
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."LedgerAccount" WHERE "id" = $1 AND "currency"::text = $2)', TG_TABLE_SCHEMA)
      INTO matches USING NEW."accountId", NEW."currency"::text;
    IF NOT matches THEN
      RAISE EXCEPTION 'Ledger entry currency differs from account' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I."AssetLedgerAccount" WHERE "id" = $1 AND "asset" = $2)', TG_TABLE_SCHEMA)
      INTO matches USING NEW."accountId", NEW."asset";
    IF NOT matches THEN
      RAISE EXCEPTION 'Asset ledger entry asset differs from account' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LedgerEntry_account_currency" BEFORE INSERT ON "LedgerEntry" FOR EACH ROW EXECUTE FUNCTION tazdan_check_entry_account_currency();
CREATE TRIGGER "AssetLedgerEntry_account_asset" BEFORE INSERT ON "AssetLedgerEntry" FOR EACH ROW EXECUTE FUNCTION tazdan_check_entry_account_currency();

-- Preserve old values as unverified; future missing valuations are NULL.
ALTER TABLE "PlatformFee" ALTER COLUMN "amountUsd" DROP NOT NULL;
ALTER TABLE "PlatformFee" ALTER COLUMN "amountUsd" DROP DEFAULT;
ALTER TABLE "PlatformFee" ADD COLUMN "valuationSource" TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED';
CREATE UNIQUE INDEX "PlatformFee_source_reference_idx" ON "PlatformFee" ("source", "sourceId") WHERE "sourceId" IS NOT NULL;
