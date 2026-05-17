-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN     "country" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "iban" TEXT,
ADD COLUMN     "sortCode" TEXT,
ADD COLUMN     "swift" TEXT;

-- CreateIndex
CREATE INDEX "BankAccount_country_idx" ON "BankAccount"("country");
