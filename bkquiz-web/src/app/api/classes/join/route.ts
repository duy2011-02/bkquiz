import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit, getClientIp } from '@/server/rateLimit';

const JoinClassSchema = z.object({
  classCode: z.string().trim().min(4).max(32),
});

export async function POST(req: Request) {
  const { userId } = await requireUser();
  const limited = await enforceRateLimit('classJoin', `user:${userId}`, ['classJoinIp', `ip:${getClientIp(req)}`]);
  if (limited) {
    return limited;
  }
  const body = JoinClassSchema.parse(await req.json());

  const classroom = await prisma.classroom.findUnique({
    where: { classCode: body.classCode.toUpperCase() },
    select: { id: true, name: true, classCode: true, archivedAt: true },
  });

  if (!classroom) {
    return NextResponse.json({ error: 'CLASS_NOT_FOUND' }, { status: 404 });
  }
  if (classroom.archivedAt) {
    return NextResponse.json({ error: 'CLASS_ARCHIVED' }, { status: 409 });
  }

  // Thành viên bị chủ lớp chặn không tự join lại được (chủ lớp có thể thêm lại bằng email)
  const existing = await prisma.classMembership.findUnique({
    where: { classroomId_userId: { classroomId: classroom.id, userId } },
    select: { status: true },
  });
  if (existing?.status === 'banned') {
    return NextResponse.json({ error: 'CLASS_BANNED' }, { status: 403 });
  }

  await prisma.classMembership.upsert({
    where: {
      classroomId_userId: { classroomId: classroom.id, userId },
    },
    update: {
      status: 'active',
    },
    create: {
      classroomId: classroom.id,
      userId,
      roleInClass: 'student',
      status: 'active',
    },
  });

  return NextResponse.json({ id: classroom.id, name: classroom.name, classCode: classroom.classCode });
}
