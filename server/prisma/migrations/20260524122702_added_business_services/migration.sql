-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "KYBStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'PERSONAL';

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "registrationNo" TEXT,
    "taxId" TEXT,
    "country" TEXT NOT NULL,
    "industry" TEXT,
    "employeeCount" TEXT,
    "website" TEXT,
    "billingEmail" TEXT,
    "supportEmail" TEXT,
    "useCase" TEXT,
    "monthlyVolumeUsd" DECIMAL(20,2),
    "kybStatus" "KYBStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "kybNotes" TEXT,
    "kybReviewedAt" TIMESTAMP(3),
    "kybReviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_userId_key" ON "BusinessProfile"("userId");

-- CreateIndex
CREATE INDEX "BusinessProfile_country_idx" ON "BusinessProfile"("country");

-- CreateIndex
CREATE INDEX "BusinessProfile_kybStatus_idx" ON "BusinessProfile"("kybStatus");

-- CreateIndex
CREATE INDEX "User_accountType_idx" ON "User"("accountType");

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
