import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireAttemptAccess, requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { parseDeviceId } from '@/server/suspicion';
import { recordAttemptDevice } from '@/server/suspicionData';

const MAX_AWAY_MS = 3 * 60 * 60 * 1000;

const EventsSchema = z.object({
  events: z.array(z.object({
    type: z.enum(['tab_hidden', 'window_blur', 'copy', 'paste']),
    at: z.string().datetime(),
    durationMs: z.number().int().min(0).max(MAX_AWAY_MS).optional(),
  })).min(1).max(50),
});

/**
 * Nhận một lô sự kiện hành vi từ trang làm bài (rời tab, chuyển cửa sổ, copy/paste).
 * Chỉ ghi nhận để gợi ý cho giáo viên; không ảnh hưởng tới bài làm. Không nhận nội dung copy/paste.
 */
export async function POST(req: Request, ctx: { params: Promise<{ attemptId: string }> }) {
  const { userId } = await requireUser();
  const limited = await enforceRateLimit('proctorEvents', `user:${userId}`);
  if (limited) {
    return limited;
  }
  const { attemptId } = await ctx.params;

  try {
    await requireAttemptAccess(userId, attemptId);
  } catch (err) {
    const code = err instanceof AuthorizationError ? err.code : 'FORBIDDEN';
    return NextResponse.json({ error: code === 'ATTEMPT_NOT_FOUND' ? code : 'FORBIDDEN' }, { status: code === 'ATTEMPT_NOT_FOUND' ? 404 : 403 });
  }

  const parsed = EventsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT', details: parsed.error.issues }, { status: 400 });
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true, attemptStartedAt: true, deviceId: true },
  });
  if (!attempt) {
    return NextResponse.json({ error: 'ATTEMPT_NOT_FOUND' }, { status: 404 });
  }
  // Bài đã nộp: client bỏ hàng đợi (sự kiện sau khi nộp không có ý nghĩa)
  if (attempt.status === 'submitted' || !attempt.attemptStartedAt) {
    return NextResponse.json({ error: 'ATTEMPT_NOT_ACTIVE' }, { status: 409 });
  }

  const now = new Date();
  const from = attempt.attemptStartedAt.getTime();
  // Kẹp thời điểm phía client vào [lúc bắt đầu làm bài, bây giờ] (đồng hồ máy sinh viên có thể lệch)
  const clamp = (iso: string) => new Date(Math.min(now.getTime(), Math.max(from, new Date(iso).getTime())));

  const { count } = await prisma.attemptEvent.createMany({
    data: parsed.data.events.map(e => ({
      attemptId,
      type: e.type,
      at: clamp(e.at),
      durationMs: e.type === 'tab_hidden' || e.type === 'window_blur' ? (e.durationMs ?? 0) : null,
    })),
  });

  await recordAttemptDevice(attempt, parseDeviceId(req.headers.get('x-bkquiz-device')), now);

  return NextResponse.json({ ok: true, accepted: count });
}
