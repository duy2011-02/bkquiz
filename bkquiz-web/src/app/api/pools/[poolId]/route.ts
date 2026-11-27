import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePoolOwnership, requireTeacher, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { requirePoolPermission } from '@/server/poolAuthz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

const UpdatePoolSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  visibility: z.enum(['private', 'shared']).optional(),
});

export async function GET(_: Request, ctx: { params: Promise<{ poolId: string }> }) {
  const { userId, devRole } = await requireUser();
  await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
  const { poolId } = await ctx.params;

  const { pool, permission } = await requirePoolPermission(userId, poolId, 'view');

  // Get stats
  const [questionCount, tagGroups] = await Promise.all([
    prisma.question.count({
      where: { poolId, deletedAt: null },
    }),
    prisma.questionTag.groupBy({
      by: ['tagId'],
      where: {
        question: {
          poolId,
          deletedAt: null,
        },
      },
    }),
  ]);

  return NextResponse.json({
    id: pool.id,
    name: pool.name,
    visibility: pool.visibility,
    updatedAt: pool.updatedAt,
    ownerTeacherId: pool.ownerTeacherId,
    permission,
    questionCount,
    tagCount: tagGroups.length,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ poolId: string }> }) {
  const { userId, devRole } = await requireUser();
  const limited = await enforceRateLimit('write', `user:${userId}`);
  if (limited) {
    return limited;
  }
  await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
  const { poolId } = await ctx.params;
  const body = UpdatePoolSchema.parse(await req.json());

  await requirePoolPermission(userId, poolId, 'edit');

  const updated = await prisma.questionPool.update({
    where: { id: poolId },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.visibility ? { visibility: body.visibility } : {}),
    },
    select: { id: true, name: true, visibility: true, updatedAt: true },
  });

  return NextResponse.json(updated);
}

/**
 * Xoá pool (chỉ chủ pool). Câu hỏi và chia sẻ của pool bị xoá theo.
 * Session đã tạo không bị ảnh hưởng vì đề của session là bản snapshot.
 */
export async function DELETE(_: Request, ctx: { params: Promise<{ poolId: string }> }) {
  try {
    const { userId, devRole } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
    const { poolId } = await ctx.params;
    await requirePoolOwnership(userId, poolId);

    await prisma.questionPool.delete({ where: { id: poolId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
