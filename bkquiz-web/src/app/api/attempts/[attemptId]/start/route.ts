import { NextResponse } from 'next/server';
import { AuthorizationError, requireAttemptAccess, requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

/**
 * API endpoint để student bắt đầu làm bài
 * Set attemptStartedAt = now() để bắt đầu tính thời gian
 */
export async function POST(_: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { userId } = await requireUser();
  const limited = await enforceRateLimit('sessionJoin', `user:${userId}`);
  if (limited) {
    return limited;
  }
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

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      attemptStartedAt: true,
      quizSession: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!attempt) {
    return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
  }

  if (attempt.status !== 'active') {
    return NextResponse.json({ error: 'ATTEMPT_ALREADY_SUBMITTED' }, { status: 400 });
  }

  if (attempt.quizSession.status !== 'active') {
    return NextResponse.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
  }

  if (attempt.attemptStartedAt) {
    // Đã bắt đầu rồi, trả về thời gian đã set
    return NextResponse.json({
      ok: true,
      attemptStartedAt: attempt.attemptStartedAt.toISOString(),
    });
  }

  // Set attemptStartedAt
  const now = new Date();
  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: { attemptStartedAt: now },
    select: { attemptStartedAt: true },
  });

  return NextResponse.json({
    ok: true,
    attemptStartedAt: updated.attemptStartedAt?.toISOString() ?? null,
  });
}
