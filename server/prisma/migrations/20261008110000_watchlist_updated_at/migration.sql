-- Watchlist entries are refreshed in place from the official lists; record
-- when each changed so earlier false-positive reviews stop suppressing it.
-- AlterTable
ALTER TABLE "WatchlistEntry" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
