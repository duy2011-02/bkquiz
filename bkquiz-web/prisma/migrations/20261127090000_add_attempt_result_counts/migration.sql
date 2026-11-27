-- Số câu đúng / tổng số câu của bài làm, để quy điểm về thang 10 và hiển thị "đúng a/b câu".
ALTER TABLE "Attempt" ADD COLUMN "correctCount" INTEGER,
ADD COLUMN "totalQuestions" INTEGER;

-- Điền cho các bài đã nộp trước đây.
-- Câu được giao: AttemptQuestion; bài cũ không có AttemptQuestion thì là mọi câu của phiên (giống submitAttempt.ts).
-- Đúng hoàn toàn: tập phương án đã chọn trùng đúng tập phương án đúng (giống scoreQuestion trong scoring.ts).
WITH assigned AS (
  SELECT aq."attemptId" AS attempt_id, aq."sessionQuestionId" AS q_id
  FROM "AttemptQuestion" aq
  JOIN "Attempt" a ON a.id = aq."attemptId"
  WHERE a.status = 'submitted'
  UNION ALL
  SELECT a.id, sq.id
  FROM "Attempt" a
  JOIN "SessionQuestionSnapshot" sq ON sq."sessionId" = a."sessionId"
  WHERE a.status = 'submitted'
    AND NOT EXISTS (SELECT 1 FROM "AttemptQuestion" aq WHERE aq."attemptId" = a.id)
),
graded AS (
  SELECT s.attempt_id,
    COALESCE((
      SELECT array_agg(o."order" ORDER BY o."order")
      FROM "SessionOptionSnapshot" o
      WHERE o."sessionQuestionId" = s.q_id AND o."isCorrect"
    ), '{}'::int[])
    = COALESCE((
      SELECT array_agg(DISTINCT x.v::int ORDER BY x.v::int)
      FROM "Answer" an
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(an.selected) = 'array' THEN an.selected ELSE '[]'::jsonb END
      ) AS x(v)
      WHERE an."attemptId" = s.attempt_id AND an."sessionQuestionId" = s.q_id
    ), '{}'::int[]) AS ok
  FROM assigned s
)
UPDATE "Attempt" a
SET "totalQuestions" = g.total, "correctCount" = g.correct
FROM (
  SELECT attempt_id, count(*)::int AS total, (count(*) FILTER (WHERE ok))::int AS correct
  FROM graded
  GROUP BY attempt_id
) g
WHERE a.id = g.attempt_id;
