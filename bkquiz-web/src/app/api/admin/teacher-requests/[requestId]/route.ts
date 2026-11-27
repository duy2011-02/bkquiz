import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/server/admin';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

const ReviewSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reviewNote: z.string().trim().max(500).optional(),
});

/** Duyệt / từ chối yêu cầu làm giáo viên. Duyệt = thêm UserRole teacher. Chỉ xử lý yêu cầu đang `pending`. */
export async function POST(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    await requireAdmin(userId);
    const { requestId } = await ctx.params;
    const body = ReviewSchema.parse(await req.json().catch(() => null));

    const result = await prisma.$transaction(async (tx) => {
      // Điều kiện pending nằm trong where → 2 quản trị viên bấm cùng lúc thì chỉ 1 người xử lý được
      const updated = await tx.teacherRequest.updateMany({
        where: { id: requestId, status: 'pending' },
        data: {
          status: body.action === 'approve' ? 'approved' : 'rejected',
          reviewedAt: new Date(),
          reviewedById: userId,
          reviewNote: body.reviewNote || null,
        },
      });
      if (updated.count === 0) {
        return null;
      }
      const request = await tx.teacherRequest.findUnique({ where: { id: requestId }, select: { userId: true, status: true } });
      if (request && body.action === 'approve') {
        await tx.userRole.upsert({
          where: { userId_role: { userId: request.userId, role: 'teacher' } },
          update: {},
          create: { userId: request.userId, role: 'teacher' },
        });
      }
      return request;
    });

    if (!result) {
      const exists = await prisma.teacherRequest.count({ where: { id: requestId } });
      return exists
        ? NextResponse.json({ error: 'REQUEST_ALREADY_REVIEWED' }, { status: 409 })
        : NextResponse.json({ error: 'REQUEST_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status: result.status });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'INVALID_INPUT', details: error.issues }, { status: 400 });
    }
    throw error;
  }
}
