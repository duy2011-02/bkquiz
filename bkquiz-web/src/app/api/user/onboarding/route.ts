import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { OnboardingInput } from '@/server/teacherRequest';

/**
 * Chọn vai trò ở lần đăng nhập đầu (trang /onboarding).
 * - Sinh viên: dùng ngay.
 * - Giáo viên: vẫn dùng giao diện sinh viên; tạo yêu cầu `pending` để quản trị viên duyệt (/dashboard/admin).
 * Không ai tự cấp được vai trò giáo viên.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const body = OnboardingInput.parse(await req.json().catch(() => null));

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardedAt: true } });
    if (user?.onboardedAt) {
      return NextResponse.json({ error: 'ALREADY_ONBOARDED' }, { status: 409 });
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.userRole.upsert({
        where: { userId_role: { userId, role: 'student' } },
        update: {},
        create: { userId, role: 'student' },
      });
      await tx.user.update({ where: { id: userId }, data: { onboardedAt: now } });
      if (body.role === 'teacher') {
        await tx.teacherRequest.upsert({
          where: { userId },
          update: { organization: body.organization, note: body.note ?? null, status: 'pending', reviewedAt: null, reviewedById: null, reviewNote: null },
          create: { userId, organization: body.organization, note: body.note ?? null },
        });
      }
    });

    return NextResponse.json({ ok: true, role: body.role, teacherRequest: body.role === 'teacher' ? 'pending' : null });
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
