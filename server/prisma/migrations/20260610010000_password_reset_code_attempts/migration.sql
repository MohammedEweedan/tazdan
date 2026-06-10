-- Split the password-reset secret into two paths:
--   passwordResetToken  — 32-byte random link token (hash), unguessable.
--   passwordResetCode   — 6-digit typed code (hash) for the mobile app,
--                         verified together with the account email and
--                         capped at 5 attempts via passwordResetAttempts.
ALTER TABLE "User" ADD COLUMN "passwordResetCode" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0;
