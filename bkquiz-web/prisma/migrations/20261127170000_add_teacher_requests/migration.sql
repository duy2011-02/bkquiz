-- Đợt 7: chọn vai trò lần đầu + yêu cầu làm giáo viên do quản trị viên duyệt
CREATE TYPE "TeacherRequestStatus" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "User" ADD COLUMN "onboardedAt" TIMESTAMP(3);
-- Người dùng đã có từ trước không phải chọn lại vai trò
UPDATE "User" SET "onboardedAt" = CURRENT_TIMESTAMP WHERE "onboardedAt" IS NULL;

CREATE TABLE "TeacherRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "note" TEXT,
    "status" "TeacherRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    CONSTRAINT "TeacherRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherRequest_userId_key" ON "TeacherRequest"("userId");
CREATE INDEX "TeacherRequest_status_createdAt_idx" ON "TeacherRequest"("status", "createdAt");
ALTER TABLE "TeacherRequest" ADD CONSTRAINT "TeacherRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
