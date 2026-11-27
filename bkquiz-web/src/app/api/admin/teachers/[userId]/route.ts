import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

/**
 * Thu hồi quyền giáo viên (xoá UserRole teacher). Lớp / quiz / bộ câu hỏi cũ vẫn thuộc người đó,
 * nhưng không tạo được lớp / quiz / bộ câu hỏi mới (`requireTeacher`). Không thu hồi được chính mình.
 */
export async function DELETE(_: Request, ctx: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    await requireAdmin(userId);
    const { userId: targetId } = await ctx.params;
    if (targetId === userId) {
      return NextResponse.json({ error: 'CANNOT_REVOKE_SELF' }, { status: 400 });
    }
    const removed = await prisma.userRole.deleteMany({ where: { userId: targetId, role: 'teacher' } });
    if (removed.count === 0) {
      return NextResponse.json({ error: 'NOT_A_TEACHER' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
