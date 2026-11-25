import { NextResponse } from 'next/server';
import { requireSessionAccess, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';

type SnapshotWithOptions = {
  id: string;
  type: 'mcq_single' | 'mcq_multi';
  prompt: string;
  options: Array<{ order: number; content: string; isCorrect: boolean }>;
};

function normalizeSelected(x: unknown): number[] {
  const arr = Array.isArray(x) ? x : [];
  return Array.from(new Set(arr.filter(n => Number.isInteger(n)).map(n => Number(n)))).sort((a, b) => a - b);
}

/**
 * Giáo viên xem chi tiết một bài làm trong session:
 * từng câu được giao (theo thứ tự trong đề của sinh viên), phương án đã chọn, đáp án đúng,
 * điểm từng câu (từ cache Attempt.questionScores) và nhật ký checkpoint.
 * Bài đang làm cũng xem được (điểm câu = null).
 */
export async function GET(_: Request, ctx: { params: Promise<{ sessionId: string; attemptId: string }> }) {
  try {
    const { userId } = await requireUser();
    const { sessionId, attemptId } = await ctx.params;
    await requireSessionAccess(userId, sessionId, 'teacher');

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        sessionId: true,
        status: true,
        score: true,
        attemptStartedAt: true,
        submittedAt: true,
        failedCount: true,
        lockedUntil: true,
        questionScores: true,
        user: { select: { id: true, name: true, email: true } },
        quizSession: {
          select: {
            id: true,
            status: true,
            settings: true,
            quiz: { select: { title: true, settings: true } },
            classroom: { select: { id: true, name: true } },
          },
        },
      },
    });
    // Không lộ việc attempt tồn tại ở session khác
    if (!attempt || attempt.sessionId !== sessionId) {
      return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
    }

    // Câu được giao cho attempt (đề biến thể). Dữ liệu cũ không có AttemptQuestion → toàn bộ câu của session.
    const optionSelect = { orderBy: { order: 'asc' as const }, select: { order: true, content: true, isCorrect: true } };
    const assigned = await prisma.attemptQuestion.findMany({
      where: { attemptId },
      orderBy: { order: 'asc' },
      select: {
        sessionQuestion: { select: { id: true, type: true, prompt: true, options: optionSelect } },
      },
    });
    const snapshots: SnapshotWithOptions[] = assigned.length > 0
      ? assigned.map(a => a.sessionQuestion)
      : await prisma.sessionQuestionSnapshot.findMany({
          where: { sessionId },
          orderBy: { order: 'asc' },
          select: { id: true, type: true, prompt: true, options: optionSelect },
        });

    const [answers, checkpoints] = await Promise.all([
      prisma.answer.findMany({
        where: { attemptId },
        select: { sessionQuestionId: true, selected: true },
      }),
      prisma.checkpointLog.findMany({
        where: { attemptId },
        orderBy: { createdAt: 'asc' },
        select: { type: true, ok: true, enteredToken: true, dueAt: true, createdAt: true },
      }),
    ]);
    const selectedByQ = new Map(answers.map(a => [a.sessionQuestionId, normalizeSelected(a.selected)]));
    const questionScores = (attempt.questionScores ?? {}) as Record<string, number>;
    const isSubmitted = attempt.status === 'submitted';

    const questions = snapshots.map((q, idx) => {
      const selected = selectedByQ.get(q.id) ?? [];
      const correctOrders = q.options.filter(o => o.isCorrect).map(o => o.order);
      const isFullyCorrect = selected.length === correctOrders.length
        && correctOrders.every(o => selected.includes(o));
      const score = isSubmitted && typeof questionScores[q.id] === 'number' ? questionScores[q.id]! : null;
      return {
        sessionQuestionId: q.id,
        order: idx + 1,
        type: q.type,
        prompt: q.prompt,
        options: q.options.map(o => ({ ...o, selected: selected.includes(o.order) })),
        answered: selected.length > 0,
        isFullyCorrect,
        score,
      };
    });

    const sessionSettings = attempt.quizSession.settings as { sessionName?: string } | null;
    const scoringMode = ((attempt.quizSession.quiz.settings as any)?.scoring?.mode ?? 'all_or_nothing') as
      'all_or_nothing' | 'partial' | 'penalty';

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        score: attempt.score,
        maxScore: questions.length, // mỗi câu tối đa 1 điểm
        attemptStartedAt: attempt.attemptStartedAt,
        submittedAt: attempt.submittedAt,
        failedCount: attempt.failedCount,
        lockedUntil: attempt.lockedUntil,
      },
      user: attempt.user,
      session: {
        id: attempt.quizSession.id,
        status: attempt.quizSession.status,
        title: sessionSettings?.sessionName || attempt.quizSession.quiz.title,
        classroomName: attempt.quizSession.classroom.name,
      },
      scoring: { mode: scoringMode },
      questions,
      checkpoints,
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
