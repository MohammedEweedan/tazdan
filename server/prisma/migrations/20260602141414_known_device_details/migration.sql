-- Add device detail columns to KnownDevice so Trusted Devices shows
-- real name/type/OS, IP, and "City, Country" instead of a generic label.
ALTER TABLE "KnownDevice" ADD COLUMN "deviceType" TEXT;
ALTER TABLE "KnownDevice" ADD COLUMN "os" TEXT;
ALTER TABLE "KnownDevice" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "KnownDevice" ADD COLUMN "location" TEXT;
