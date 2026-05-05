/*
  Warnings:

  - The values [LARGE_WITHDRAWAL] on the enum `AMLFlagType` will be removed. If these variants are still used in the database, this will fail.
  - The values [LYD] on the enum `Currency` will be removed. If these variants are still used in the database, this will fail.
  - The values [SADAD,MASREFY,MOAMALAT,TADAWUL,CASH_DEPOSIT,AGENT] on the enum `PaymentMethod` will be removed. If these variants are still used in the database, this will fail.
  - The values [AGENT_DEPOSIT,AGENT_WITHDRAWAL] on the enum `TransactionType` will be removed. If these variants are still used in the database, this will fail.
  - The values [AGENT] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Agent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AgentTransaction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MemeToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SmartContract` table. If the table is not empty, all the data it contains will be lost.

*/

-- Drop deprecated tables FIRST so their columns no longer depend on the
-- enum types we are about to rename/drop below.
ALTER TABLE IF EXISTS "Agent" DROP CONSTRAINT IF EXISTS "Agent_userId_fkey";
ALTER TABLE IF EXISTS "AgentTransaction" DROP CONSTRAINT IF EXISTS "AgentTransaction_agentId_fkey";
ALTER TABLE IF EXISTS "AgentTransaction" DROP CONSTRAINT IF EXISTS "AgentTransaction_userId_fkey";
ALTER TABLE IF EXISTS "MemeToken" DROP CONSTRAINT IF EXISTS "MemeToken_userId_fkey";
ALTER TABLE IF EXISTS "SmartContract" DROP CONSTRAINT IF EXISTS "SmartContract_userId_fkey";
DROP TABLE IF EXISTS "AgentTransaction";
DROP TABLE IF EXISTS "Agent";
DROP TABLE IF EXISTS "MemeToken";
DROP TABLE IF EXISTS "SmartContract";
DROP TYPE IF EXISTS "ContractStatus";
DROP TYPE IF EXISTS "ContractType";
DROP TYPE IF EXISTS "TokenStatus";

-- AlterEnum: AMLFlagType
CREATE TYPE "AMLFlagType_new" AS ENUM ('HIGH_VOLUME', 'RAPID_TRANSACTIONS', 'SUSPICIOUS_PATTERN', 'SANCTIONED_ADDRESS', 'STRUCTURING', 'MANUAL');
ALTER TABLE "AMLFlag" ALTER COLUMN "type" TYPE "AMLFlagType_new" USING ("type"::text::"AMLFlagType_new");
ALTER TYPE "AMLFlagType" RENAME TO "AMLFlagType_old";
ALTER TYPE "AMLFlagType_new" RENAME TO "AMLFlagType";
DROP TYPE "AMLFlagType_old";

-- AlterEnum: Currency (remove LYD)
-- First coerce any existing LYD rows to USD so the cast below never fails.
-- For users who already have a USD wallet, delete the LYD one to avoid unique key conflict.
DELETE FROM "Wallet" WHERE "currency"::text = 'LYD' AND EXISTS (
  SELECT 1 FROM "Wallet" w2 WHERE w2."userId" = "Wallet"."userId" AND w2."currency"::text = 'USD'
);
-- For users with only a LYD wallet (no USD), convert it.
UPDATE "Wallet"             SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "Deposit"            SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "Withdrawal"         SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "Transaction"        SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
-- Delete all LYD exchange rates (updating would cause duplicate key with existing USDT/USD row)
DELETE FROM "ExchangeRate" WHERE "baseCurrency"::text = 'LYD' OR "quoteCurrency"::text = 'LYD';
UPDATE "OnChainTx"          SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "Transfer"           SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "Order"              SET "baseCurrency"    = 'USD' WHERE "baseCurrency"::text    = 'LYD';
UPDATE "Order"              SET "quoteCurrency"   = 'USD' WHERE "quoteCurrency"::text   = 'LYD';
UPDATE "P2PListing"         SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "P2PListing"         SET "fiatCurrency"    = 'USD' WHERE "fiatCurrency"::text    = 'LYD';
UPDATE "P2PTrade"           SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "P2PTrade"           SET "fiatCurrency"    = 'USD' WHERE "fiatCurrency"::text    = 'LYD';
UPDATE "AMLFlag"            SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "ReferralReward"     SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "Card"               SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "CardTransaction"    SET "currency"        = 'USD' WHERE "currency"::text        = 'LYD';
UPDATE "OnRampTransaction"  SET "fiatCurrency"    = 'USD' WHERE "fiatCurrency"::text    = 'LYD';
UPDATE "OnRampTransaction"  SET "cryptoCurrency"  = 'USD' WHERE "cryptoCurrency"::text  = 'LYD';
UPDATE "OnRampTransaction"  SET "feeCurrency"     = 'USD' WHERE "feeCurrency"::text     = 'LYD';
UPDATE "OffRampTransaction" SET "cryptoCurrency"  = 'USD' WHERE "cryptoCurrency"::text  = 'LYD';
UPDATE "OffRampTransaction" SET "fiatCurrency"    = 'USD' WHERE "fiatCurrency"::text    = 'LYD';
UPDATE "OffRampTransaction" SET "feeCurrency"     = 'USD' WHERE "feeCurrency"::text     = 'LYD';

ALTER TABLE "Card" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "CardTransaction" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "ExchangeRate" ALTER COLUMN "baseCurrency" DROP DEFAULT;
ALTER TABLE "MarketListing" ALTER COLUMN "quoteAsset" DROP DEFAULT;
ALTER TABLE "OnChainTx" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "baseCurrency" DROP DEFAULT;
ALTER TABLE "P2PListing" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "P2PListing" ALTER COLUMN "fiatCurrency" DROP DEFAULT;
ALTER TABLE "ReferralReward" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Transfer" ALTER COLUMN "currency" DROP DEFAULT;
CREATE TYPE "Currency_new" AS ENUM ('USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP');
ALTER TABLE "Wallet"             ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "Deposit"            ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "Withdrawal"         ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "Order"              ALTER COLUMN "baseCurrency"   TYPE "Currency_new" USING (CASE WHEN "baseCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "baseCurrency"::text::"Currency_new" END);
ALTER TABLE "Order"              ALTER COLUMN "quoteCurrency"  TYPE "Currency_new" USING (CASE WHEN "quoteCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "quoteCurrency"::text::"Currency_new" END);
ALTER TABLE "Transaction"        ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "ExchangeRate"       ALTER COLUMN "baseCurrency"   TYPE "Currency_new" USING (CASE WHEN "baseCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "baseCurrency"::text::"Currency_new" END);
ALTER TABLE "ExchangeRate"       ALTER COLUMN "quoteCurrency"  TYPE "Currency_new" USING (CASE WHEN "quoteCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "quoteCurrency"::text::"Currency_new" END);
ALTER TABLE "OnChainTx"          ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "Transfer"           ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "P2PListing"         ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "P2PListing"         ALTER COLUMN "fiatCurrency"   TYPE "Currency_new" USING (CASE WHEN "fiatCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "fiatCurrency"::text::"Currency_new" END);
ALTER TABLE "P2PTrade"           ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "P2PTrade"           ALTER COLUMN "fiatCurrency"   TYPE "Currency_new" USING (CASE WHEN "fiatCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "fiatCurrency"::text::"Currency_new" END);
ALTER TABLE "AMLFlag"            ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "ReferralReward"     ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "Card"               ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "CardTransaction"    ALTER COLUMN "currency"       TYPE "Currency_new" USING (CASE WHEN "currency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "currency"::text::"Currency_new" END);
ALTER TABLE "MarketListing"      ALTER COLUMN "baseAsset"      TYPE "Currency_new" USING (CASE WHEN "baseAsset"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "baseAsset"::text::"Currency_new" END);
ALTER TABLE "MarketListing"      ALTER COLUMN "quoteAsset"     TYPE "Currency_new" USING (CASE WHEN "quoteAsset"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "quoteAsset"::text::"Currency_new" END);
ALTER TABLE "OnRampTransaction"  ALTER COLUMN "fiatCurrency"   TYPE "Currency_new" USING (CASE WHEN "fiatCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "fiatCurrency"::text::"Currency_new" END);
ALTER TABLE "OnRampTransaction"  ALTER COLUMN "cryptoCurrency" TYPE "Currency_new" USING (CASE WHEN "cryptoCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "cryptoCurrency"::text::"Currency_new" END);
ALTER TABLE "OnRampTransaction"  ALTER COLUMN "feeCurrency"    TYPE "Currency_new" USING (CASE WHEN "feeCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "feeCurrency"::text::"Currency_new" END);
ALTER TABLE "OffRampTransaction" ALTER COLUMN "cryptoCurrency" TYPE "Currency_new" USING (CASE WHEN "cryptoCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "cryptoCurrency"::text::"Currency_new" END);
ALTER TABLE "OffRampTransaction" ALTER COLUMN "fiatCurrency"   TYPE "Currency_new" USING (CASE WHEN "fiatCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "fiatCurrency"::text::"Currency_new" END);
ALTER TABLE "OffRampTransaction" ALTER COLUMN "feeCurrency"    TYPE "Currency_new" USING (CASE WHEN "feeCurrency"::text = 'LYD' THEN 'USD'::"Currency_new" ELSE "feeCurrency"::text::"Currency_new" END);
ALTER TYPE "Currency" RENAME TO "Currency_old";
ALTER TYPE "Currency_new" RENAME TO "Currency";
DROP TYPE "Currency_old";
ALTER TABLE "Card" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "CardTransaction" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "ExchangeRate" ALTER COLUMN "baseCurrency" SET DEFAULT 'USDT';
ALTER TABLE "MarketListing" ALTER COLUMN "quoteAsset" SET DEFAULT 'USDT';
ALTER TABLE "OnChainTx" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "Order" ALTER COLUMN "baseCurrency" SET DEFAULT 'USDT';
ALTER TABLE "P2PListing" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "P2PListing" ALTER COLUMN "fiatCurrency" SET DEFAULT 'USD';
ALTER TABLE "ReferralReward" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "Transfer" ALTER COLUMN "currency" SET DEFAULT 'USDT';

-- AlterEnum: PaymentMethod
UPDATE "Deposit"    SET "paymentMethod" = 'BANK_TRANSFER' WHERE "paymentMethod"::text IN ('SADAD','MASREFY','MOAMALAT','TADAWUL','CASH_DEPOSIT','AGENT');
UPDATE "Withdrawal" SET "paymentMethod" = 'BANK_TRANSFER' WHERE "paymentMethod"::text IN ('SADAD','MASREFY','MOAMALAT','TADAWUL','CASH_DEPOSIT','AGENT');
CREATE TYPE "PaymentMethod_new" AS ENUM ('BANK_TRANSFER');
ALTER TABLE "Deposit"    ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TABLE "Withdrawal" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";

-- AlterEnum: TransactionType
UPDATE "Transaction" SET "type" = 'DEPOSIT'    WHERE "type"::text = 'AGENT_DEPOSIT';
UPDATE "Transaction" SET "type" = 'WITHDRAWAL' WHERE "type"::text = 'AGENT_WITHDRAWAL';
CREATE TYPE "TransactionType_new" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT', 'FEE', 'COMMISSION', 'REFERRAL_BONUS', 'ADMIN_CREDIT', 'ADMIN_DEBIT');
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "TransactionType_old";

-- AlterEnum: UserRole
CREATE TYPE "UserRole_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';

