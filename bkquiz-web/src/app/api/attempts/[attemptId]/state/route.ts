import { NextResponse } from 'next/server';
import { touchAttemptLastSeen } from '@/server/attemptPresence';
import { calculateAttemptEndTime } from '@/server/attemptTimeLimit';
import { AuthorizationError, requireAttemptAccess, requireUser } from '@/server/authz';
import {
  getCheckpointPhase,
  GRACE_SECONDS_BEFORE_BLOCK,
  isAttemptLocked,
  isInCooldown,
} from '@/server/checkpointPolicy';
import { prisma } from '@/server/prisma';
import { attemptResult } from '@/server/scoring';
import { parseDeviceId } from '@/server/suspicion';
import { recordAttemptDevice } from '@/server/suspicionData';

export async function GET(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { userId } = await requireUser();
  const { attemptId } = await ctx.params;

  try {
    await requireAttemptAccess(userId, attemptId);
  } catch (err) {
    // So theo AuthorizationError.code (message là câu mô tả, không phải mã lỗi)
    const error = err instanceof AuthorizationError ? err.code : (err instanceof Error ? err.message : String(err));
    if (error === 'ATTEMPT_NOT_FOUND') {
      return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Trang giám sát: máy sinh viên vẫn kết nối (ghi tối đa 10 s/lần)
  await touchAttemptLastSeen(attemptId);

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      deviceId: true,
      score: true,
      correctCount: true,
      totalQuestions: true,
      attemptStartedAt: true,
      extraSeconds: true,
      nextDueAt: true,
      failedCount: true,
      cooldownUntil: true,
      lockedUntil: true,
      quizSession: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          settings: true,
          quiz: { select: { title: true } },
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
  }

  // Gắn cờ nghi vấn: ghi nhận thiết bị làm bài (đổi thiết bị / dùng chung thiết bị)
  await recordAttemptDevice(attempt, parseDeviceId(req.headers.get('x-bkquiz-device')));

  // Extract sessionName from settings
  const settings = attempt.quizSession.settings as { sessionName?: string } | null;
  const sessionName = settings?.sessionName || null;

  const now = new Date();
  const { warning, due } = getCheckpointPhase(attempt.nextDueAt, now);
  const inCooldown = isInCooldown(attempt.cooldownUntil, now);
  const isLocked = isAttemptLocked(attempt.lockedUntil, attempt.status, now);

  // Calculate time limit info
  const attemptEndTime = calculateAttemptEndTime(attempt);
  const timeRemaining = attemptEndTime
    ? Math.max(0, Math.floor((attemptEndTime.getTime() - now.getTime()) / 1000))
    : null;
  const isTimeUp = attemptEndTime ? now >= attemptEndTime : false;

  const a = attempt as any; // Prisma select types may not include all fields
  return NextResponse.json({
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    ...attemptResult(attempt),
    session: {
      ...a.quizSession,
      sessionName, // Add sessionName to response
    },
    attemptStartedAt: a.attemptStartedAt,
    attemptEndTime: attemptEndTime?.toISOString() ?? null,
    timeRemaining,
    isTimeUp,
    nextDueAt: attempt.nextDueAt,
    due,
    warning,
    graceSecondsBeforeBlock: GRACE_SECONDS_BEFORE_BLOCK,
    failedCount: attempt.failedCount,
    cooldownUntil: attempt.cooldownUntil,
    lockedUntil: attempt.lockedUntil,
    inCooldown,
    isLocked,
  });
}
// EOF
