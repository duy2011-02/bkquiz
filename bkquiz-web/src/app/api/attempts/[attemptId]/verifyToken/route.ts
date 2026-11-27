import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireAttemptAccess, requireUser } from '@/server/authz';
import { applyFailedVerify, isAttemptLocked, isInCooldown, nextCheckpointDueAt } from '@/server/checkpointPolicy';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { verifyTotp } from '@/server/totp';

const VerifySchema = z.object({
  token: z.string().trim().min(4).max(12),
});

export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { userId } = await requireUser();
  const limited = await enforceRateLimit('verifyToken', `user:${userId}`);
  if (limited) {
    return limited;
  }
  const { attemptId } = await ctx.params;
  const body = VerifySchema.parse(await req.json());

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
      failedCount: true,
      cooldownUntil: true,
      lockedUntil: true,
      quizSession: { select: { id: true, status: true, totpSecret: true, totpStepSeconds: true } },
    },
  });
  if (!attempt) {
    return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
  }
  if (attempt.quizSession.status !== 'active') {
    return NextResponse.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
  }

  const now = new Date();
  const inCooldown = isInCooldown(attempt.cooldownUntil, now);
  const isLocked = isAttemptLocked(attempt.lockedUntil, attempt.status, now);
  if (isLocked) {
    return NextResponse.json({ error: 'ATTEMPT_LOCKED', lockedUntil: attempt.lockedUntil }, { status: 403 });
  }
  if (inCooldown) {
    return NextResponse.json({ error: 'COOLDOWN', cooldownUntil: attempt.cooldownUntil }, { status: 429 });
  }

  const ok = verifyTotp({
    secret: attempt.quizSession.totpSecret,
    stepSeconds: attempt.quizSession.totpStepSeconds,
    token: body.token,
    window: 1,
  });

  if (ok) {
    const nextDueAt = nextCheckpointDueAt(now);
    const updated = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        status: 'active',
        failedCount: 0,
        cooldownUntil: null,
        lockedUntil: null,
        nextDueAt,
        lastVerifiedAt: new Date(),
      },
      select: { id: true, nextDueAt: true, status: true },
    });
    await prisma.checkpointLog.create({
      data: {
        attemptId,
        type: 'verify_ok',
        ok: true,
        enteredToken: body.token,
        dueAt: nextDueAt,
      },
    }).catch(() => null);
    return NextResponse.json({ ok: true, ...updated });
  }

  // 3 lần sai → chờ 30 s; 6 lần sai → khoá 5 phút (src/server/checkpointPolicy.ts)
  const { failedCount, cooldownUntil, lockedUntil } = applyFailedVerify(attempt.failedCount, now);

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: {
      failedCount,
      cooldownUntil,
      lockedUntil,
      status: lockedUntil ? 'locked' : attempt.status,
    },
    select: { id: true, failedCount: true, cooldownUntil: true, lockedUntil: true, status: true },
  });

  await prisma.checkpointLog.create({
    data: {
      attemptId,
      type: lockedUntil ? 'locked' : 'verify_fail',
      ok: false,
      enteredToken: body.token,
    },
  }).catch(() => null);

  return NextResponse.json({ ok: false, ...updated }, { status: 400 });
}
// EOF
