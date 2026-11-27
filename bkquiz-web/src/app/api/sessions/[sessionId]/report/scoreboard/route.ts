import { NextResponse } from 'next/server';
import { requireSessionAccess, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { attemptResult } from '@/server/scoring';
import { computeSessionFlags } from '@/server/suspicionData';

function csvEscape(x: string) {
  if (x.includes('"') || x.includes(',') || x.includes('\n') || x.includes('\r')) {
    return `"${x.replaceAll('"', '""')}"`;
  }
  return x;
}

export async function GET(_: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  try {
    const { userId } = await requireUser();
    const { sessionId } = await ctx.params;
    const url = new URL(_.url);
    const format = url.searchParams.get('format');
    await requireSessionAccess(userId, sessionId, 'teacher');

    const rows = await prisma.attempt.findMany({
      where: { sessionId },
      orderBy: [{ score: 'desc' }, { updatedAt: 'asc' }],
      select: {
        id: true,
        status: true,
        score: true,
        correctCount: true,
        totalQuestions: true,
        submittedAt: true,
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // Xếp theo điểm thang 10 (đề biến thể: số câu mỗi bài có thể khác nhau nên không xếp theo điểm thô)
    const attempts = rows
      .map(a => ({ ...a, ...attemptResult(a) }))
      .sort((x, y) => (y.grade ?? -1) - (x.grade ?? -1));

    // Cờ nghi vấn (Task 5.4): màn chiếu chỉ hiện dấu ⚑, lý do xem ở trang giám sát / chi tiết bài làm
    const flagsByAttempt = await computeSessionFlags(sessionId);

    if (format === 'csv') {
      const headers = ['userId', 'email', 'name', 'attemptId', 'status', 'grade', 'correctCount', 'totalQuestions', 'score', 'submittedAt', 'flags'];
      const lines = [headers.join(',')];
      for (const a of attempts) {
        const email = a.user.email ?? '';
        const name = a.user.name ?? '';
        const submittedAt = a.submittedAt ? a.submittedAt.toISOString() : '';
        lines.push([
          csvEscape(a.user.id),
          csvEscape(email),
          csvEscape(name),
          csvEscape(a.id),
          csvEscape(a.status),
          csvEscape(a.grade === null ? '' : String(a.grade)),
          csvEscape(a.correctCount === null ? '' : String(a.correctCount)),
          csvEscape(a.totalQuestions === null ? '' : String(a.totalQuestions)),
          csvEscape(a.score === null ? '' : String(a.score)),
          csvEscape(submittedAt),
          csvEscape((flagsByAttempt.get(a.id) ?? []).map(f => f.code).join(' ')),
        ].join(','));
      }
      return new NextResponse(lines.join('\n'), {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="scoreboard-${sessionId}.csv"`,
        },
      });
    }

    return NextResponse.json({
      attempts: attempts.map(a => ({ ...a, flagged: (flagsByAttempt.get(a.id)?.length ?? 0) > 0 })),
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
