import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireClassroomOwnership, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

const UpdateClassSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  /** Lưu trữ / bỏ lưu trữ lớp (chỉ chủ lớp) */
  archived: z.boolean().optional(),
}).refine(b => b.name !== undefined || b.archived !== undefined, { message: 'name or archived is required' });

export async function GET(_: Request, ctx: { params: Promise<{ classId: string }> }) {
  const { userId } = await requireUser();
  const { classId } = await ctx.params;

  const membership = await prisma.classMembership.findUnique({
    where: { classroomId_userId: { classroomId: classId, userId } },
    select: {
      roleInClass: true,
      status: true,
      joinedAt: true,
      classroom: {
        select: {
          id: true,
          name: true,
          classCode: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
          ownerTeacherId: true,
          ownerTeacher: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              memberships: { where: { status: 'active' } },
            },
          },
        },
      },
    },
  });

  if (!membership || membership.status !== 'active') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  return NextResponse.json({
    id: membership.classroom.id,
    name: membership.classroom.name,
    classCode: membership.classroom.classCode,
    createdAt: membership.classroom.createdAt,
    updatedAt: membership.classroom.updatedAt,
    archivedAt: membership.classroom.archivedAt,
    ownerTeacherId: membership.classroom.ownerTeacherId,
    ownerTeacher: membership.classroom.ownerTeacher,
    memberCount: membership.classroom._count.memberships,
    userRole: membership.roleInClass,
    joinedAt: membership.joinedAt,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ classId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const { classId } = await ctx.params;
    const body = UpdateClassSchema.parse(await req.json());
    await requireClassroomOwnership(userId, classId);

    if (body.archived === true) {
      // Giống xoá lớp: không lưu trữ khi đang có phiên chạy
      const active = await prisma.quizSession.count({ where: { classroomId: classId, status: 'active' } });
      if (active > 0) {
        return NextResponse.json({ error: 'CLASS_HAS_ACTIVE_SESSION' }, { status: 409 });
      }
    }

    const updated = await prisma.classroom.update({
      where: { id: classId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.archived !== undefined ? { archivedAt: body.archived ? new Date() : null } : {}),
      },
      select: { id: true, name: true, updatedAt: true, archivedAt: true },
    });

    return NextResponse.json(updated);
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

/**
 * Xoá lớp: xoá luôn session, bài làm và thành viên của lớp (cascade).
 * Không cho xoá khi lớp đang có session chạy.
 */
export async function DELETE(_: Request, ctx: { params: Promise<{ classId: string }> }) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const { classId } = await ctx.params;
    await requireClassroomOwnership(userId, classId);

    const activeSessions = await prisma.quizSession.count({
      where: { classroomId: classId, status: 'active' },
    });
    if (activeSessions > 0) {
      return NextResponse.json({ error: 'CLASS_HAS_ACTIVE_SESSION' }, { status: 409 });
    }

    await prisma.classroom.delete({ where: { id: classId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
