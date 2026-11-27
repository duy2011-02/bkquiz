import { NextResponse } from 'next/server';
import { requireSessionOwner, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

/**
 * Xoá (huỷ) session.
 * - lobby: huỷ buổi kiểm tra chưa bắt đầu.
 * - ended: xoá kèm toàn bộ bài làm, câu trả lời, snapshot đề, log checkpoint (cascade trong schema).
 * - active: không cho xoá, phải kết thúc trước (tránh sinh viên đang làm bài bị mất bài).
 */
export async function DELETE(_: Request, ctx: { params: Promise<{ sessionId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const { sessionId } = await ctx.params;
    // Huỷ / xoá phiên: chỉ chủ lớp (xem bảng quyền trong docs/security.md)
    await requireSessionOwner(userId, sessionId);

    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      select: { status: true, classroomId: true },
    });
    if (!session) {
      return NextResponse.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }

    // Điều kiện status đặt trong where để không xoá nhầm nếu session vừa được start (auto-start).
    const result = await prisma.quizSession.deleteMany({
      where: { id: sessionId, status: { in: ['lobby', 'ended'] } },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'SESSION_ACTIVE' }, { status: 409 });
    }

    return NextResponse.json({ ok: true, classroomId: session.classroomId });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
