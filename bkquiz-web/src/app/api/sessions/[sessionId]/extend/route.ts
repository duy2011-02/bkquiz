import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateSessionEndTime, MAX_EXTENSION_SECONDS } from '@/server/attemptTimeLimit';
import { requireSessionAccess, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';

const BodySchema = z.object({
  minutes: z.number().int().min(1).max(60),
});

/**
 * Gia hạn thời gian làm bài cho session đang chạy.
 * Cộng dồn vào settings.extensionSeconds; mọi attempt (kể cả đang làm) và mốc tự đóng session
 * đều tính lại theo thời lượng mới (xem src/server/attemptTimeLimit.ts).
 */
export async function POST(req: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  try {
    const { userId } = await requireUser();
    const { sessionId } = await ctx.params;
    await requireSessionAccess(userId, sessionId, 'teacher');

    const parsed = BodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'INVALID_INPUT', details: parsed.error.issues }, { status: 400 });
    }

    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: { status: true, startedAt: true, settings: true, updatedAt: true },
    });
    if (!session) {
      return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    if (session.status !== 'active' || !session.startedAt) {
      return NextResponse.json({ error: 'SESSION_NOT_ACTIVE' }, { status: 400 });
    }

    const settings = (session.settings ?? {}) as Record<string, unknown>;
    if (typeof settings.durationSeconds !== 'number' || settings.durationSeconds <= 0) {
      return NextResponse.json({ error: 'NO_TIME_LIMIT' }, { status: 400 });
    }

    const currentExtension = typeof settings.extensionSeconds === 'number' ? settings.extensionSeconds : 0;
    const nextExtension = currentExtension + parsed.data.minutes * 60;
    if (nextExtension > MAX_EXTENSION_SECONDS) {
      return NextResponse.json(
        { error: 'EXTENSION_LIMIT', extensionSeconds: currentExtension, maxExtensionSeconds: MAX_EXTENSION_SECONDS },
        { status: 400 },
      );
    }

    const nextSettings = { ...settings, extensionSeconds: nextExtension };

    // Optimistic lock theo updatedAt: tránh 2 lần gia hạn đồng thời ghi đè lẫn nhau.
    const result = await prisma.quizSession.updateMany({
      where: { id: sessionId, status: 'active', updatedAt: session.updatedAt },
      data: { settings: nextSettings as any },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'SESSION_CHANGED' }, { status: 409 });
    }

    const sessionEndTime = calculateSessionEndTime(session.startedAt, nextSettings);
    return NextResponse.json({
      ok: true,
      extensionSeconds: nextExtension,
      sessionEndTime: sessionEndTime?.toISOString() ?? null,
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
