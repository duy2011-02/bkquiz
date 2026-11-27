import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { TeacherRequestInput } from '@/server/teacherRequest';

const SELECT = {
  status: true,
  organization: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  reviewNote: true,
} as const;

async function isTeacher(userId: string) {
  return (await prisma.userRole.count({ where: { userId, role: 'teacher' } })) > 0;
}

/** Trạng thái yêu cầu làm giáo viên của chính mình (`request: null` nếu chưa gửi). */
export async function GET() {
  try {
    const { userId } = await requireUser();
    const [request, teacher] = await Promise.all([
      prisma.teacherRequest.findUnique({ where: { userId }, select: SELECT }),
      isTeacher(userId),
    ]);
    return NextResponse.json({ isTeacher: teacher, request });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}

/**
 * Gửi (gửi lại sau khi bị từ chối, hoặc sửa khi đang chờ) yêu cầu làm giáo viên — từ trang Hồ sơ.
 * Đã là giáo viên → 409 ALREADY_TEACHER.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const body = TeacherRequestInput.parse(await req.json().catch(() => null));
    if (await isTeacher(userId)) {
      return NextResponse.json({ error: 'ALREADY_TEACHER' }, { status: 409 });
    }
    const request = await prisma.teacherRequest.upsert({
      where: { userId },
      update: { organization: body.organization, note: body.note ?? null, status: 'pending', reviewedAt: null, reviewedById: null, reviewNote: null },
      create: { userId, organization: body.organization, note: body.note ?? null },
      select: SELECT,
    });
    return NextResponse.json({ ok: true, request });
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
