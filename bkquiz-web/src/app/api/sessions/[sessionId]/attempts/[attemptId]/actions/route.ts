import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateAttemptEndTime, getEffectiveDurationSeconds, MAX_ATTEMPT_EXTRA_SECONDS } from '@/server/attemptTimeLimit';
import { requireSessionAccess, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { nextCheckpointDueAt } from '@/server/checkpointPolicy';
import { canUnlock } from '@/server/liveStatus';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { submitAttempt } from '@/server/submitAttempt';

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('unlock') }),
  z.object({ action: z.literal('extend'), minutes: z.number().int().min(1).max(30) }),
  z.object({ action: z.literal('submit') }),
]);

function fail(error: string, status = 400, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Giáo viên xử lý sự cố cho một sinh viên trong phiên thi (trang giám sát):
 * - `unlock`: xoá khoá / thời gian chờ sau nhiều lần nhập sai token, đặt mốc checkpoint mới.
 * - `extend { minutes }`: gia hạn riêng cho bài này (tổng tối đa MAX_ATTEMPT_EXTRA_SECONDS).
 * - `submit`: thu bài (chấm như khi sinh viên tự nộp).
 * Mỗi thao tác ghi một dòng `CheckpointLog` (`teacher_*`) → hiện trong trang chi tiết bài làm.
 */
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string; attemptId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const { sessionId, attemptId } = await ctx.params;
    await requireSessionAccess(userId, sessionId, 'teacher');

    const parsed = ActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail('INVALID_INPUT', 400, { details: parsed.error.issues });
    }
    const body = parsed.data;

    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        sessionId: true,
        status: true,
        failedCount: true,
        lockedUntil: true,
        cooldownUntil: true,
        attemptStartedAt: true,
        extraSeconds: true,
        quizSession: { select: { status: true, startedAt: true, settings: true } },
      },
    });
    // Attempt của session khác → 404 (không lộ là attempt có tồn tại)
    if (!attempt || attempt.sessionId !== sessionId) {
      return fail('ATTEMPT_NOT_FOUND', 404);
    }
    if (attempt.status === 'submitted') {
      return fail('ATTEMPT_ALREADY_SUBMITTED');
    }
    const now = new Date();

    if (body.action === 'unlock') {
      if (attempt.quizSession.status !== 'active') {
        return fail('SESSION_NOT_ACTIVE');
      }
      if (!canUnlock(attempt, now)) {
        return fail('NOT_LOCKED');
      }
      const nextDueAt = nextCheckpointDueAt(now);
      // Điều kiện theo giá trị vừa đọc: nếu sinh viên vừa nhập token (đổi failedCount/status) thì không ghi đè
      const result = await prisma.attempt.updateMany({
        where: { id: attemptId, status: attempt.status, failedCount: attempt.failedCount },
        data: { status: 'active', failedCount: 0, cooldownUntil: null, lockedUntil: null, nextDueAt },
      });
      if (result.count === 0) {
        return fail('ATTEMPT_CHANGED', 409);
      }
      await prisma.checkpointLog.create({
        data: { attemptId, type: 'teacher_unlock', ok: true, dueAt: nextDueAt },
      }).catch(() => null);
      return NextResponse.json({ ok: true, action: 'unlock', nextDueAt: nextDueAt.toISOString() });
    }

    if (body.action === 'extend') {
      if (attempt.quizSession.status !== 'active') {
        return fail('SESSION_NOT_ACTIVE');
      }
      if (getEffectiveDurationSeconds(attempt.quizSession.settings) === null) {
        return fail('NO_TIME_LIMIT');
      }
      if (!attempt.attemptStartedAt) {
        return fail('ATTEMPT_NOT_STARTED');
      }
      const nextExtra = attempt.extraSeconds + body.minutes * 60;
      if (nextExtra > MAX_ATTEMPT_EXTRA_SECONDS) {
        return fail('EXTENSION_LIMIT', 400, { extraSeconds: attempt.extraSeconds, maxExtraSeconds: MAX_ATTEMPT_EXTRA_SECONDS });
      }
      const result = await prisma.attempt.updateMany({
        where: { id: attemptId, extraSeconds: attempt.extraSeconds, status: { not: 'submitted' } },
        data: { extraSeconds: nextExtra },
      });
      if (result.count === 0) {
        return fail('ATTEMPT_CHANGED', 409);
      }
      const attemptEndTime = calculateAttemptEndTime({ ...attempt, extraSeconds: nextExtra });
      await prisma.checkpointLog.create({
        // dueAt = giờ kết thúc mới của bài
        data: { attemptId, type: 'teacher_extend', ok: true, dueAt: attemptEndTime },
      }).catch(() => null);
      return NextResponse.json({
        ok: true,
        action: 'extend',
        extraSeconds: nextExtra,
        attemptEndTime: attemptEndTime?.toISOString() ?? null,
      });
    }

    // submit
    if (!attempt.attemptStartedAt) {
      return fail('ATTEMPT_NOT_STARTED');
    }
    const result = await submitAttempt(attemptId, { by: 'teacher' });
    if (!result.ok) {
      return fail(result.error, result.status);
    }
    await prisma.checkpointLog.create({
      data: { attemptId, type: 'teacher_submit', ok: true },
    }).catch(() => null);
    return NextResponse.json({
      ok: true,
      action: 'submit',
      score: result.attempt.score,
      grade: result.grade,
      totalQuestions: result.totalQuestions,
      correctCount: result.correctCount,
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
