-- Product availability: hide or lock a feature, currency or pair for everyone or chosen customers.

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('FEATURE', 'CURRENCY', 'PAIR');

-- CreateEnum
CREATE TYPE "AvailabilityState" AS ENUM ('AVAILABLE', 'LOCKED', 'HIDDEN');

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "key" TEXT NOT NULL,
    "state" "AvailabilityState" NOT NULL DEFAULT 'AVAILABLE',
    "allowUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "includeStaff" BOOLEAN NOT NULL DEFAULT false,
    "denyUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "denyState" "AvailabilityState" NOT NULL DEFAULT 'LOCKED',
    "message" TEXT,
    "reason" TEXT NOT NULL,
    "setById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_kind_key_key" ON "AvailabilityRule"("kind", "key");

