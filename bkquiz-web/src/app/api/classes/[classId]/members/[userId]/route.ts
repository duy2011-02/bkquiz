import { NextResponse } from 'next/server';
import { requireClassroomOwnership, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

/**
 * Xoá thành viên khỏi lớp.
 * - Thành viên tự rời lớp: DELETE với userId của chính mình (hoặc `me`) → status = left (có thể join lại bằng mã lớp).
 * - Chủ lớp xoá thành viên: status = left; thêm `?ban=1` để chặn (status = banned, không join lại bằng mã lớp được).
 * Membership không bị xoá hẳn để giữ lịch sử; bài làm cũ vẫn còn trong bảng điểm.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ classId: string; userId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const { classId, userId: targetParam } = await ctx.params;
    const targetUserId = targetParam === 'me' ? userId : targetParam;
    const ban = new URL(req.url).searchParams.get('ban') === '1';

    const classroom = await prisma.classroom.findUnique({
      where: { id: classId },
      select: { ownerTeacherId: true },
    });
    if (!classroom) {
      return NextResponse.json({ error: 'CLASSROOM_NOT_FOUND' }, { status: 404 });
    }
    if (targetUserId === classroom.ownerTeacherId) {
      return NextResponse.json({ error: 'CANNOT_REMOVE_OWNER' }, { status: 400 });
    }

    const isSelf = targetUserId === userId;
    if (!isSelf || ban) {
      await requireClassroomOwnership(userId, classId);
    }

    const membership = await prisma.classMembership.findUnique({
      where: { classroomId_userId: { classroomId: classId, userId: targetUserId } },
      select: { status: true },
    });
    if (!membership || membership.status !== 'active') {
      return NextResponse.json({ error: 'MEMBER_NOT_FOUND' }, { status: 404 });
    }

    await prisma.classMembership.update({
      where: { classroomId_userId: { classroomId: classId, userId: targetUserId } },
      data: { status: ban ? 'banned' : 'left' },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
