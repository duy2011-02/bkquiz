import { NextResponse } from 'next/server';
import { requireStudent, requireUser } from '@/server/authz';
import { checkAuthz } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { attemptResult } from '@/server/scoring';

/** Thống kê kết quả của sinh viên. Mọi điểm trả về đều ở thang 10 (`grade`), kèm số câu đúng / tổng số câu. */
export async function GET() {
  const { userId, devRole } = await requireUser();
  const roleDenied = await checkAuthz(() => requireStudent(userId, devRole as 'teacher' | 'student' | undefined));
  if (roleDenied) {
    return roleDenied;
  }

  const attempts = await prisma.attempt.findMany({
    where: {
      userId,
      status: 'submitted',
      score: { not: null },
      totalQuestions: { gt: 0 },
    },
    select: {
      id: true,
      score: true,
      correctCount: true,
      totalQuestions: true,
      submittedAt: true,
      quizSession: {
        select: {
          quiz: {
            select: {
              title: true,
            },
          },
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
    take: 100, // Limit để tính stats
  });

  if (attempts.length === 0) {
    return NextResponse.json({
      totalAttempts: 0,
      averageScore: null,
      highestScore: null,
      recentAttempts: [],
    });
  }

  const results = attempts.map(a => ({ a, r: attemptResult(a) }));
  const grades = results.map(x => x.r.grade).filter((g): g is number => g !== null);
  const averageScore = grades.length > 0 ? grades.reduce((sum, g) => sum + g, 0) / grades.length : null;
  const highestScore = grades.length > 0 ? Math.max(...grades) : null;

  const recentAttempts = results.slice(0, 5).map(({ a, r }) => ({
    id: a.id,
    grade: r.grade,
    correctCount: r.correctCount,
    totalQuestions: r.totalQuestions,
    submittedAt: a.submittedAt,
    quizTitle: a.quizSession.quiz.title,
  }));

  return NextResponse.json({
    totalAttempts: attempts.length,
    averageScore: averageScore !== null ? Number(averageScore.toFixed(2)) : null,
    highestScore: highestScore !== null ? Number(highestScore.toFixed(2)) : null,
    recentAttempts,
  });
}
