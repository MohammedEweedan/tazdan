-- Add expoPushToken to User table
-- Run with: npx prisma migrate deploy

ALTER TABLE "User" ADD COLUMN "expoPushToken" TEXT;
