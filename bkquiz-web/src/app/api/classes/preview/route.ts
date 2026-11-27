import { NextResponse } from 'next/server';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit, getClientIp } from '@/server/rateLimit';
import { maskEmail } from '@/utils/maskEmail';

/**
 * Xem trước lớp trước khi tham gia bằng mã / QR (chỉ gọi từ dashboard → người dùng đã đăng nhập).
 * Không trả email đầy đủ của giáo viên: chỉ tên, và email đã che bớt để dự phòng khi giáo viên chưa có tên.
 */
export async function GET(req: Request) {
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const limited = await enforceRateLimit('classJoin', `user:${userId}`, ['classJoinIp', `ip:${getClientIp(req)}`]);
  if (limited) {
    return limited;
  }
  const { searchParams } = new URL(req.url);
  const classCode = searchParams.get('classCode');

  if (!classCode || classCode.trim().length < 4) {
    return NextResponse.json({ error: 'INVALID_CLASS_CODE' }, { status: 400 });
  }

  const classroom = await prisma.classroom.findUnique({
    where: { classCode: classCode.toUpperCase().trim() },
    select: {
      id: true,
      name: true,
      classCode: true,
      createdAt: true,
      archivedAt: true,
      ownerTeacher: {
        select: {
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          memberships: true,
        },
      },
    },
  });

  if (!classroom) {
    return NextResponse.json({ error: 'CLASS_NOT_FOUND' }, { status: 404 });
  }
  if (classroom.archivedAt) {
    return NextResponse.json({ error: 'CLASS_ARCHIVED' }, { status: 409 });
  }

  return NextResponse.json({
    id: classroom.id,
    name: classroom.name,
    classCode: classroom.classCode,
    createdAt: classroom.createdAt,
    ownerTeacher: {
      name: classroom.ownerTeacher.name,
      email: maskEmail(classroom.ownerTeacher.email),
    },
    memberCount: classroom._count.memberships,
  });
}
