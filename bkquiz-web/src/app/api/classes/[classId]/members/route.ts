import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireClassroomOwnership, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';

const AddMemberSchema = z.object({
  email: z.string().trim().email(),
});

export async function GET(_: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { userId } = await requireUser();
  const { classId } = await ctx.params;

  // Check user has access to this classroom
  const membership = await prisma.classMembership.findUnique({
    where: { classroomId_userId: { classroomId: classId, userId } },
    select: { status: true },
  });

  if (!membership || membership.status !== 'active') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const members = await prisma.classMembership.findMany({
    where: { classroomId: classId, status: 'active' },
    orderBy: [
      { roleInClass: 'asc' }, // teacher, ta, student
      { joinedAt: 'asc' },
    ],
    select: {
      userId: true,
      roleInClass: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({
    members: members.map(m => ({
      userId: m.userId,
      user: m.user,
      roleInClass: m.roleInClass,
      joinedAt: m.joinedAt,
    })),
  });
}

/**
 * Chủ lớp thêm thành viên bằng email.
 * Người được thêm phải đã đăng nhập BKquiz ít nhất 1 lần (đã có tài khoản).
 * Thêm lại người đã rời lớp hoặc bị chặn sẽ kích hoạt lại tư cách thành viên.
 */
export async function POST(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  try {
    const { userId } = await requireUser();
    const { classId } = await ctx.params;
    const body = AddMemberSchema.parse(await req.json());
    await requireClassroomOwnership(userId, classId);

    const user = await prisma.user.findFirst({
      where: { email: { equals: body.email, mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const existing = await prisma.classMembership.findUnique({
      where: { classroomId_userId: { classroomId: classId, userId: user.id } },
      select: { status: true },
    });
    if (existing?.status === 'active') {
      return NextResponse.json({ error: 'ALREADY_MEMBER' }, { status: 409 });
    }

    if (existing) {
      await prisma.classMembership.update({
        where: { classroomId_userId: { classroomId: classId, userId: user.id } },
        data: { status: 'active' },
      });
    } else {
      await prisma.classMembership.create({
        data: { classroomId: classId, userId: user.id, roleInClass: 'student', status: 'active' },
      });
    }

    return NextResponse.json({ ok: true, user });
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
