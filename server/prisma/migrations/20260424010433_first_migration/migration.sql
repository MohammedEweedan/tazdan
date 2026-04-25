/*
  Warnings:

  - The values [LYD,LYDT] on the enum `Currency` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Currency_new" AS ENUM ('USD', 'USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX');
ALTER TABLE "Card" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "CardTransaction" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "ExchangeRate" ALTER COLUMN "baseCurrency" DROP DEFAULT;
ALTER TABLE "OnChainTx" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "baseCurrency" DROP DEFAULT;
ALTER TABLE "P2PListing" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "P2PListing" ALTER COLUMN "fiatCurrency" DROP DEFAULT;
ALTER TABLE "ReferralReward" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Transfer" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "Wallet" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "Deposit" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "Withdrawal" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "Order" ALTER COLUMN "baseCurrency" TYPE "Currency_new" USING ("baseCurrency"::text::"Currency_new");
ALTER TABLE "Order" ALTER COLUMN "quoteCurrency" TYPE "Currency_new" USING ("quoteCurrency"::text::"Currency_new");
ALTER TABLE "Transaction" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "ExchangeRate" ALTER COLUMN "baseCurrency" TYPE "Currency_new" USING ("baseCurrency"::text::"Currency_new");
ALTER TABLE "ExchangeRate" ALTER COLUMN "quoteCurrency" TYPE "Currency_new" USING ("quoteCurrency"::text::"Currency_new");
ALTER TABLE "OnChainTx" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "AgentTransaction" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "Transfer" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "P2PListing" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "P2PListing" ALTER COLUMN "fiatCurrency" TYPE "Currency_new" USING ("fiatCurrency"::text::"Currency_new");
ALTER TABLE "P2PTrade" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "P2PTrade" ALTER COLUMN "fiatCurrency" TYPE "Currency_new" USING ("fiatCurrency"::text::"Currency_new");
ALTER TABLE "AMLFlag" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "ReferralReward" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "Card" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TABLE "CardTransaction" ALTER COLUMN "currency" TYPE "Currency_new" USING ("currency"::text::"Currency_new");
ALTER TYPE "Currency" RENAME TO "Currency_old";
ALTER TYPE "Currency_new" RENAME TO "Currency";
DROP TYPE "Currency_old";
ALTER TABLE "Card" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "CardTransaction" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "ExchangeRate" ALTER COLUMN "baseCurrency" SET DEFAULT 'USDT';
ALTER TABLE "OnChainTx" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "Order" ALTER COLUMN "baseCurrency" SET DEFAULT 'USDT';
ALTER TABLE "P2PListing" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "P2PListing" ALTER COLUMN "fiatCurrency" SET DEFAULT 'USD';
ALTER TABLE "ReferralReward" ALTER COLUMN "currency" SET DEFAULT 'USDT';
ALTER TABLE "Transfer" ALTER COLUMN "currency" SET DEFAULT 'USDT';
COMMIT;

-- AlterTable
ALTER TABLE "P2PListing" ALTER COLUMN "fiatCurrency" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "acceptedCurrencies" SET DEFAULT ARRAY['USDT', 'USD', 'BTC', 'ETH']::TEXT[];
