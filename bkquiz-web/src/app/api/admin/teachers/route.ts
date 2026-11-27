import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';

/** Những người đang có vai trò giáo viên (quản trị viên), kèm đơn vị trong yêu cầu đã duyệt và số lớp / quiz. */
export async function GET() {
  try {
    const { userId } = await requireUser();
    await requireAdmin(userId);
    const rows = await prisma.userRole.findMany({
      where: { role: 'teacher' },
      take: 500,
      select: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            teacherRequest: { select: { organization: true, reviewedAt: true } },
            _count: { select: { ownedClassrooms: true, quizzes: true } },
          },
        },
      },
    });
    const teachers = rows
      .map(r => ({
        id: r.user.id,
        name: r.user.name,
        email: r.user.email,
        organization: r.user.teacherRequest?.organization ?? null,
        approvedAt: r.user.teacherRequest?.reviewedAt ?? null,
        classCount: r.user._count.ownedClassrooms,
        quizCount: r.user._count.quizzes,
      }))
      .sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''));
    return NextResponse.json({ teachers });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
