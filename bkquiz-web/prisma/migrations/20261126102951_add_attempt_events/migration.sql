-- CreateEnum
CREATE TYPE "AttemptEventType" AS ENUM ('tab_hidden', 'window_blur', 'copy', 'paste', 'device_changed');

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "deviceId" TEXT;

-- CreateTable
CREATE TABLE "AttemptEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "AttemptEventType" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttemptEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttemptEvent_attemptId_at_idx" ON "AttemptEvent"("attemptId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptEvent_attemptId_type_deviceId_key" ON "AttemptEvent"("attemptId", "type", "deviceId");

-- AddForeignKey
ALTER TABLE "AttemptEvent" ADD CONSTRAINT "AttemptEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
