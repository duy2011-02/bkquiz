-- Ảnh minh hoạ cho câu hỏi (Task 6.5); snapshot của phiên giữ bản chép riêng
ALTER TABLE "Question" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "imageAlt" TEXT;

ALTER TABLE "SessionQuestionSnapshot" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "imageAlt" TEXT;
