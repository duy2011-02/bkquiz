import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireQuizOwnership, requireTeacher, requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { buildQuizCopy } from '@/server/quizCopy';
import { enforceRateLimit } from '@/server/rateLimit';

const DuplicateSchema = z.object({
  /** Tiêu đề bản sao (client gửi bản đã dịch, ví dụ "<tên> (bản sao)") */
  title: z.string().trim().max(400).optional(),
});

/** Nhân bản quiz: bản nháp mới của chủ quiz, chép cài đặt + luật + tag (không chép phiên / kết quả). */
export async function POST(req: Request, ctx: { params: Promise<{ quizId: string }> }) {
  try {
    const { userId, devRole } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    await requireTeacher(userId, devRole as 'teacher' | 'student' | undefined);
    const { quizId } = await ctx.params;
    const body = DuplicateSchema.parse(await req.json().catch(() => ({})));
    await requireQuizOwnership(userId, quizId);

    const source = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        title: true,
        settings: true,
        rules: {
          orderBy: { createdAt: 'asc' },
          select: { tagId: true, count: true, commonCount: true, variantCount: true, extraPercent: true, filters: true },
        },
        tags: { select: { tagId: true } },
      },
    });
    if (!source) {
      return NextResponse.json({ error: 'QUIZ_NOT_FOUND' }, { status: 404 });
    }

    // Một lệnh create lồng nhau = một transaction (quiz + luật + tag)
    const created = await prisma.quiz.create({
      data: buildQuizCopy(source, userId, body.title),
      select: { id: true, title: true, status: true },
    });

    return NextResponse.json({ ok: true, quiz: created }, { status: 201 });
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
