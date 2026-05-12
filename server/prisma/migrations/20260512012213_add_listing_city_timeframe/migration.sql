-- AlterTable
ALTER TABLE "P2PListing" ADD COLUMN     "city" TEXT,
ADD COLUMN     "timeframeMins" INTEGER NOT NULL DEFAULT 30;
