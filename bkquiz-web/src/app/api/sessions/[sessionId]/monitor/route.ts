import type { LiveStatus } from '@/server/liveStatus';
import type { SuspicionFlag } from '@/server/suspicion';
import { NextResponse } from 'next/server';
import { calculateAttemptEndTime, getEffectiveDurationSeconds, MAX_ATTEMPT_EXTRA_SECONDS } from '@/server/attemptTimeLimit';
import { requireSessionAccess, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { canUnlock, deriveLiveStatus, LIVE_STATUS_ORDER } from '@/server/liveStatus';
import { prisma } from '@/server/prisma';
import { attemptResult } from '@/server/scoring';
import { computeSessionFlags } from '@/server/suspicionData';

export type MonitorStudent = {
  userId: string;
  name: string | null;
  email: string | null;
  attemptId: string | null;
  liveStatus: LiveStatus;
  answeredCount: number;
  assignedCount: number;
  failedCount: number;
  lockedUntil: string | null;
  cooldownUntil: string | null;
  timeRemaining: number | null;
  extraSeconds: number;
  lastSeenAt: string | null;
  attemptStartedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  /** Điểm thang 10 */
  grade: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  canUnlock: boolean;
  flags: SuspicionFlag[];
};

/**
 * Bảng giám sát phiên thi cho giáo viên (poll mỗi 3 s từ trang `dashboard/sessions/[id]/monitor`).
 * Gồm cả sinh viên trong lớp chưa vào phiên (`not_joined`).
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
        startedAt: true,
        settings: true,
        classroomId: true,
        classroom: { select: { name: true } },
        quiz: { select: { title: true } },
        _count: { select: { questionSnapshots: true } },
      },
    });
    if (!session) {
      return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }

    const [attempts, answered, members, flagsByAttempt] = await Promise.all([
      prisma.attempt.findMany({
        where: { sessionId },
        select: {
          id: true,
          userId: true,
          status: true,
          attemptStartedAt: true,
          submittedAt: true,
          score: true,
          correctCount: true,
          totalQuestions: true,
          failedCount: true,
          lockedUntil: true,
          cooldownUntil: true,
          nextDueAt: true,
          lastSeenAt: true,
          extraSeconds: true,
          user: { select: { name: true, email: true } },
          _count: { select: { attemptQuestions: true } },
        },
      }),
      // Số câu đã chọn ít nhất 1 phương án, theo bài làm (1 truy vấn cho cả phiên)
      prisma.$queryRaw<Array<{ attemptId: string; count: bigint }>>`
        SELECT a."attemptId", COUNT(*) AS count
        FROM "Answer" a
        JOIN "Attempt" t ON t.id = a."attemptId"
        WHERE t."sessionId" = ${sessionId}
          AND jsonb_typeof(a.selected) = 'array'
          AND jsonb_array_length(a.selected) > 0
        GROUP BY a."attemptId"
      `,
      prisma.classMembership.findMany({
        where: { classroomId: session.classroomId, status: 'active', roleInClass: 'student' },
        select: { userId: true, user: { select: { name: true, email: true } } },
      }),
      computeSessionFlags(sessionId),
    ]);

    const answeredByAttempt = new Map(answered.map(r => [r.attemptId, Number(r.count)]));
    const now = new Date();
    const totalQuestions = session._count.questionSnapshots;

    const students: MonitorStudent[] = attempts.map((a) => {
      const attemptEndTime = calculateAttemptEndTime({
        attemptStartedAt: a.attemptStartedAt,
        extraSeconds: a.extraSeconds,
        quizSession: { startedAt: session.startedAt, settings: session.settings },
      });
      return {
        userId: a.userId,
        name: a.user.name,
        email: a.user.email,
        attemptId: a.id,
        liveStatus: deriveLiveStatus({ ...a, attemptEndTime }, session.status, now),
        answeredCount: answeredByAttempt.get(a.id) ?? 0,
        // Bài cũ không có AttemptQuestion → làm toàn bộ câu của session
        assignedCount: a._count.attemptQuestions || totalQuestions,
        failedCount: a.failedCount,
        lockedUntil: a.lockedUntil?.toISOString() ?? null,
        cooldownUntil: a.cooldownUntil?.toISOString() ?? null,
        timeRemaining: attemptEndTime ? Math.max(0, Math.floor((attemptEndTime.getTime() - now.getTime()) / 1000)) : null,
        extraSeconds: a.extraSeconds,
        lastSeenAt: a.lastSeenAt?.toISOString() ?? null,
        attemptStartedAt: a.attemptStartedAt?.toISOString() ?? null,
        submittedAt: a.submittedAt?.toISOString() ?? null,
        score: a.score,
        ...attemptResult(a),
        canUnlock: canUnlock(a, now),
        flags: flagsByAttempt.get(a.id) ?? [],
      };
    });

    const joined = new Set(attempts.map(a => a.userId));
    for (const m of members) {
      if (joined.has(m.userId)) {
        continue;
      }
      students.push({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        attemptId: null,
        liveStatus: 'not_joined',
        answeredCount: 0,
        assignedCount: 0,
        failedCount: 0,
        lockedUntil: null,
        cooldownUntil: null,
        timeRemaining: null,
        extraSeconds: 0,
        lastSeenAt: null,
        attemptStartedAt: null,
        submittedAt: null,
        score: null,
        grade: null,
        correctCount: null,
        totalQuestions: null,
        canUnlock: false,
        flags: [],
      });
    }

    // Cần chú ý trước (bị khoá, mất kết nối…), cùng trạng thái thì theo tên
    students.sort((x, y) =>
      LIVE_STATUS_ORDER.indexOf(x.liveStatus) - LIVE_STATUS_ORDER.indexOf(y.liveStatus)
      || (x.name ?? x.email ?? '').localeCompare(y.name ?? y.email ?? ''));

    const summary = Object.fromEntries(LIVE_STATUS_ORDER.map(s => [s, 0])) as Record<LiveStatus, number>;
    for (const st of students) {
      summary[st.liveStatus] += 1;
    }
    const flaggedCount = students.filter(st => st.flags.length > 0).length;

    const settings = session.settings as { sessionName?: string } | null;
    return NextResponse.json({
      serverTime: now.toISOString(),
      session: {
        id: session.id,
        status: session.status,
        title: settings?.sessionName || session.quiz.title,
        classroomName: session.classroom.name,
        hasTimeLimit: getEffectiveDurationSeconds(session.settings) !== null,
        maxExtraSeconds: MAX_ATTEMPT_EXTRA_SECONDS,
      },
      summary,
      flaggedCount,
      students,
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
