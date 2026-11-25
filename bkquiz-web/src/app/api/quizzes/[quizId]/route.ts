import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireQuizOwnership, requireTeacher, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';

const UpdateQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export async function GET(_: Request, ctx: { params: Promise<{ quizId: string }> }) {
  try {
    const { userId, devRole } = await requireUser();
    await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
    const { quizId } = await ctx.params;
    await requireQuizOwnership(userId, quizId);

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        status: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: 'QUIZ_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      updatedAt: quiz.updatedAt.toISOString(),
      createdAt: quiz.createdAt.toISOString(),
    });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ quizId: string }> }) {
  try {
    const { userId, devRole } = await requireUser();
    await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
    const { quizId } = await ctx.params;
    const body = UpdateQuizSchema.parse(await req.json());
    await requireQuizOwnership(userId, quizId);

    const updated = await prisma.quiz.update({
      where: { id: quizId },
      data: { title: body.title },
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
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
 * Xoá quiz. Quiz đã dùng để tạo session thì không cho xoá (xoá sẽ kéo theo session và bài làm),
 * giáo viên nên chuyển sang trạng thái archived.
 */
export async function DELETE(_: Request, ctx: { params: Promise<{ quizId: string }> }) {
  try {
    const { userId, devRole } = await requireUser();
    await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
    const { quizId } = await ctx.params;
    await requireQuizOwnership(userId, quizId);

    const sessionCount = await prisma.quizSession.count({ where: { quizId } });
    if (sessionCount > 0) {
      return NextResponse.json({ error: 'QUIZ_HAS_SESSIONS', sessionCount }, { status: 409 });
    }

    await prisma.quiz.delete({ where: { id: quizId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    throw error;
  }
}
