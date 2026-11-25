import type { ResolvedScoring } from '@/server/scoring';
import { validateAttemptTimeLimit } from '@/server/attemptTimeLimit';
import { prisma } from '@/server/prisma';
import { resolveScoringSettings, scoreAttempt } from '@/server/scoring';

export type SubmitAttemptBy = 'student' | 'teacher';

export type SubmitAttemptResult
  = | {
    ok: true;
    attempt: { id: string; status: string; submittedAt: Date | null; score: number | null };
    totalQuestions: number;
    correctCount: number;
    scoring: ResolvedScoring;
  }
  | { ok: false; error: 'ATTEMPT_NOT_FOUND'; status: 404 }
  | { ok: false; error: 'ATTEMPT_NOT_ACTIVE'; status: 400 }
  | { ok: false; error: 'TIME_LIMIT_EXCEEDED'; status: 400; timeRemaining: number | null };

/**
 * Nộp và chấm một bài làm (không kiểm tra quyền — route gọi phải kiểm tra trước).
 *
 * - `by: 'student'`: bài phải đang `active`; hết giờ vẫn được nộp (tự nộp khi hết giờ).
 * - `by: 'teacher'` (giáo viên thu bài hộ): nhận cả bài `active` lẫn `locked`, bỏ qua kiểm tra thời gian.
 *
 * Chỉ chấm các câu trong `AttemptQuestion` của bài (đề biến thể); bài cũ không có `AttemptQuestion`
 * thì chấm toàn bộ câu của session.
 */
export async function submitAttempt(attemptId: string, opts: { by: SubmitAttemptBy }): Promise<SubmitAttemptResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      sessionId: true,
      quizSession: { select: { quiz: { select: { settings: true } } } },
    },
  });
  if (!attempt) {
    return { ok: false, error: 'ATTEMPT_NOT_FOUND', status: 404 };
  }

  const allowedStatuses = opts.by === 'teacher' ? ['active', 'locked'] : ['active'];
  if (!allowedStatuses.includes(attempt.status)) {
    return { ok: false, error: 'ATTEMPT_NOT_ACTIVE', status: 400 };
  }

  if (opts.by === 'student') {
    const timeLimit = await validateAttemptTimeLimit(attemptId);
    // Hết giờ vẫn cho nộp để lưu kết quả (client tự nộp khi đồng hồ về 0).
    if (!timeLimit.valid && !timeLimit.isTimeUp) {
      return { ok: false, error: 'TIME_LIMIT_EXCEEDED', status: 400, timeRemaining: timeLimit.timeRemaining };
    }
  }

  const assigned = await prisma.attemptQuestion.findMany({
    where: { attemptId },
    select: { sessionQuestionId: true },
  });
  const assignedIds = assigned.map(a => a.sessionQuestionId);

  const questions = await prisma.sessionQuestionSnapshot.findMany({
    where: assignedIds.length > 0
      ? { sessionId: attempt.sessionId, id: { in: assignedIds } }
      : { sessionId: attempt.sessionId },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      options: { select: { order: true, isCorrect: true } },
    },
  });

  const answers = await prisma.answer.findMany({
    where: { attemptId },
    select: { sessionQuestionId: true, selected: true },
  });
  const answerByQ = new Map<string, unknown>(answers.map(a => [a.sessionQuestionId, a.selected]));

  const scoring = resolveScoringSettings((attempt.quizSession.quiz.settings as { scoring?: unknown } | null)?.scoring);
  const result = scoreAttempt({ questions, answers: answerByQ, scoring });

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      status: 'submitted',
      submittedAt: new Date(),
      score: result.score,
      questionScores: result.questionScores,
    },
    select: { id: true, status: true, submittedAt: true, score: true },
  });

  return {
    ok: true,
    attempt: updated,
    totalQuestions: result.totalQuestions,
    correctCount: result.correctCount,
    scoring,
  };
}
