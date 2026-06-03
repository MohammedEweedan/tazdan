-- 2FA recovery for locked-out users: store a hashed 6-digit code + expiry.
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryCode" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorRecoveryExpires" TIMESTAMP(3);
