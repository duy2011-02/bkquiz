import { NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';

const STATUSES = ['pending', 'approved', 'rejected'] as const;

/** Danh sách yêu cầu làm giáo viên (quản trị viên). `?status=pending|approved|rejected` (mặc định pending). */
export async function GET(req: Request) {
  try {
    const { userId } = await requireUser();
    await requireAdmin(userId);
    const raw = new URL(req.url).searchParams.get('status');
    const status = STATUSES.find(s => s === raw) ?? 'pending';

    const [requests, counts] = await Promise.all([
      prisma.teacherRequest.findMany({
        where: { status },
        orderBy: status === 'pending' ? { updatedAt: 'asc' } : { reviewedAt: 'desc' },
        take: 200,
        select: {
          id: true,
          organization: true,
          note: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          reviewedAt: true,
          reviewNote: true,
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.teacherRequest.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    return NextResponse.json({
      status,
      requests,
      counts: Object.fromEntries(STATUSES.map(s => [s, counts.find(c => c.status === s)?._count._all ?? 0])),
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
