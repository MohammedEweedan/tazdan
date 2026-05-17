-- AlterTable
ALTER TABLE "UserWallet" ADD COLUMN     "altBalances" JSONB NOT NULL DEFAULT '{}';
