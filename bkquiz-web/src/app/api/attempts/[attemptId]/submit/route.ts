import { NextResponse } from 'next/server';
import { requireAttemptAccess, requireUser } from '@/server/authz';
import { submitAttempt } from '@/server/submitAttempt';

export const runtime = 'nodejs';
export const maxDuration = 10; // Vercel Hobby limit: 10 seconds

export async function POST(_: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { userId } = await requireUser();
  const { attemptId } = await ctx.params;

  try {
    await requireAttemptAccess(userId, attemptId);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (error === 'ATTEMPT_NOT_FOUND') {
      return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Chấm điểm nằm trong src/server/submitAttempt.ts + src/server/scoring.ts (có unit test)
  const result = await submitAttempt(attemptId, { by: 'student' });
  if (!result.ok) {
    return NextResponse.json(
      result.error === 'TIME_LIMIT_EXCEEDED'
        ? { error: result.error, timeRemaining: result.timeRemaining }
        : { error: result.error },
      { status: result.status },
    );
  }

  const { mode, partialMethod, rounding } = result.scoring;
  return NextResponse.json({
    ok: true,
    totalQuestions: result.totalQuestions,
    correctCount: result.correctCount,
    scoring: { mode, partialMethod: mode === 'partial' ? partialMethod : undefined, rounding },
    ...result.attempt,
  });
}
// EOF
