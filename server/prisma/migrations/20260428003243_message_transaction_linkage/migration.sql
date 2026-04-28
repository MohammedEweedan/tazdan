/*
  Warnings:

  - A unique constraint covering the columns `[transferId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[senderTxId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[receiverTxId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "receiverTxId" TEXT,
ADD COLUMN     "senderTxId" TEXT,
ADD COLUMN     "transferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Message_transferId_key" ON "Message"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderTxId_key" ON "Message"("senderTxId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_receiverTxId_key" ON "Message"("receiverTxId");

-- CreateIndex
CREATE INDEX "Message_transferId_idx" ON "Message"("transferId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderTxId_fkey" FOREIGN KEY ("senderTxId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverTxId_fkey" FOREIGN KEY ("receiverTxId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
