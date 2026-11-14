-- Business brand colours, kiosk manager PIN, public posts (offers/deals/news) and plaque orders.

-- CreateEnum
CREATE TYPE "BusinessPostKind" AS ENUM ('OFFER', 'DEAL', 'NEWS');

-- CreateEnum
CREATE TYPE "PlaqueOrderStatus" AS ENUM ('REQUESTED', 'IN_PRODUCTION', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "brandPrimary" TEXT,
ADD COLUMN     "brandSecondary" TEXT,
ADD COLUMN     "kioskPinFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "kioskPinHash" TEXT,
ADD COLUMN     "kioskPinLockedUntil" TIMESTAMP(3),
ADD COLUMN     "kioskPinSetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BusinessPost" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" "BusinessPostKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT true,
    "hiddenByStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaqueOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tillId" TEXT,
    "quantity" INTEGER NOT NULL,
    "size" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "shippingName" TEXT NOT NULL,
    "shippingPhone" TEXT NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "notes" TEXT,
    "status" "PlaqueOrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "statusNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaqueOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessPost_businessId_published_createdAt_idx" ON "BusinessPost"("businessId", "published", "createdAt");

-- CreateIndex
CREATE INDEX "PlaqueOrder_businessId_createdAt_idx" ON "PlaqueOrder"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "PlaqueOrder_status_idx" ON "PlaqueOrder"("status");

-- AddForeignKey
ALTER TABLE "BusinessPost" ADD CONSTRAINT "BusinessPost_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaqueOrder" ADD CONSTRAINT "PlaqueOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
