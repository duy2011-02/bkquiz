-- Đợt 7: gỡ vai trò trợ giảng (ta). Chuyển thành viên ta (nếu có) về student rồi tạo lại enum không có 'ta'
-- (Postgres không xoá được một giá trị khỏi enum).
UPDATE "ClassMembership" SET "roleInClass" = 'student' WHERE "roleInClass" = 'ta';

ALTER TYPE "ClassroomRole" RENAME TO "ClassroomRole_old";
CREATE TYPE "ClassroomRole" AS ENUM ('student', 'teacher');
ALTER TABLE "ClassMembership" ALTER COLUMN "roleInClass" DROP DEFAULT,
  ALTER COLUMN "roleInClass" TYPE "ClassroomRole" USING ("roleInClass"::text::"ClassroomRole"),
  ALTER COLUMN "roleInClass" SET DEFAULT 'student';
DROP TYPE "ClassroomRole_old";
