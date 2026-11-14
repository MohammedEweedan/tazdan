-- Messaging reliability: idempotent sends, receiver-private unread state and
-- idempotent person-to-person transfers. Additive only; no data is removed.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "seenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN     "idempotencyKey" TEXT;

-- Messages already read keep counting as opened, so no old thread turns
-- unread again when unread counts switch from "isRead" to "seenAt".
UPDATE "Message" SET "seenAt" = COALESCE("readAt", "createdAt") WHERE "isRead" = true;

-- CreateIndex
CREATE INDEX "Message_receiverId_seenAt_idx" ON "Message"("receiverId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_senderId_clientId_key" ON "Message"("senderId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_senderId_idempotencyKey_key" ON "Transfer"("senderId", "idempotencyKey");
