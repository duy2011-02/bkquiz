import type { StatsAttempt } from '@/server/questionStats';
import { NextResponse } from 'next/server';
import { requireSessionAccess, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { computeQuestionStats } from '@/server/questionStats';
import { resolveScoringSettings } from '@/server/scoring';

/**
 * Thống kê câu hỏi của một phiên (chỉ giáo viên): tổng quan điểm, phân bố điểm, từng câu
 * (tỉ lệ đúng, độ phân biệt, lượt chọn từng phương án). Tính trên bài đã nộp.
 */
export async function GET(_: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  try {
    const { userId } = await requireUser();
    const { sessionId } = await ctx.params;
    await requireSessionAccess(userId, sessionId, 'teacher');

    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        settings: true,
        quiz: { select: { title: true, settings: true } },
        classroom: { select: { name: true } },
        _count: { select: { attempts: true } },
      },
    });
    if (!session) {
      return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }

    const [questions, attempts] = await Promise.all([
      prisma.sessionQuestionSnapshot.findMany({
        where: { sessionId },
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          type: true,
          prompt: true,
          imageUrl: true,
          imageAlt: true,
          options: { orderBy: { order: 'asc' }, select: { order: true, content: true, isCorrect: true } },
        },
      }),
      prisma.attempt.findMany({
        where: { sessionId, status: 'submitted' },
        select: {
          id: true,
          score: true,
          questionScores: true,
          attemptQuestions: { select: { sessionQuestionId: true } },
          answers: { select: { sessionQuestionId: true, selected: true } },
        },
      }),
    ]);

    const statsAttempts: StatsAttempt[] = attempts.map(a => ({
      id: a.id,
      score: a.score ?? 0,
      questionScores: (a.questionScores ?? {}) as Record<string, number>,
      assigned: a.attemptQuestions.map(x => x.sessionQuestionId),
      answers: Object.fromEntries(a.answers.map(x => [x.sessionQuestionId, x.selected])),
    }));

    const stats = computeQuestionStats({ questions, attempts: statsAttempts });
    const settings = session.settings as { sessionName?: string } | null;
    const scoringMode = resolveScoringSettings((session.quiz.settings as { scoring?: unknown } | null)?.scoring).mode;

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        title: settings?.sessionName || session.quiz.title,
        classroomName: session.classroom.name,
        joined: session._count.attempts,
        scoringMode,
      },
      ...stats,
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
