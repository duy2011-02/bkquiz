-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CheckpointEventType" ADD VALUE 'teacher_unlock';
ALTER TYPE "CheckpointEventType" ADD VALUE 'teacher_extend';
ALTER TYPE "CheckpointEventType" ADD VALUE 'teacher_submit';

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "extraSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);
