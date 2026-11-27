import { nanoid } from 'nanoid';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/authz';
import { requirePoolPermission } from '@/server/poolAuthz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';
import { IMAGE_ALT_MAX, isAllowedImageUrl } from '@/utils/questionImage';
import { normalizeTagName } from '@/utils/tags';

type QuestionTagRow = { tag: { name: string; normalizedName: string } };
type QuestionOptionRow = { order: number; content: string; isCorrect: boolean };
type QuestionListRow = {
  id: string;
  type: 'mcq_single' | 'mcq_multi';
  prompt: string;
  imageUrl: string | null;
  imageAlt: string | null;
  createdAt: Date;
  options: QuestionOptionRow[];
  tags: QuestionTagRow[];
};

const CreateQuestionSchema = z.object({
  type: z.enum(['mcq_single', 'mcq_multi']),
  prompt: z.string().trim().min(1),
  options: z.array(z.object({
    content: z.string().trim().min(1),
    isCorrect: z.boolean().optional(),
  })).min(2).max(12),
  tags: z.array(z.string().trim().min(1)).max(20).optional(),
  /** Ảnh minh hoạ (URL từ `uploads/question-image` hoặc URL http(s) công khai); có ảnh thì bắt buộc mô tả */
  imageUrl: z.string().trim().refine(isAllowedImageUrl, 'INVALID_IMAGE_URL').optional(),
  imageAlt: z.string().trim().max(IMAGE_ALT_MAX).optional(),
}).refine(b => !b.imageUrl || !!b.imageAlt, { message: 'IMAGE_ALT_REQUIRED', path: ['imageAlt'] });

export async function GET(_: Request, ctx: { params: Promise<{ poolId: string }> }) {
  const { userId } = await requireUser();
  const { poolId } = await ctx.params;

  await requirePoolPermission(userId, poolId, 'view');

  const questions = await prisma.question.findMany({
    where: { poolId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      prompt: true,
      imageUrl: true,
      imageAlt: true,
      createdAt: true,
      options: { where: { deletedAt: null }, orderBy: { order: 'asc' }, select: { order: true, content: true, isCorrect: true } },
      tags: { select: { tag: { select: { name: true, normalizedName: true } } } },
    },
  });

  const typedQuestions = questions as unknown as QuestionListRow[];

  return NextResponse.json({
    questions: typedQuestions.map(q => ({
      ...q,
      tags: q.tags.map(t => t.tag),
    })),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ poolId: string }> }) {
  const { userId } = await requireUser();
  const limited = await enforceRateLimit('write', `user:${userId}`);
  if (limited) {
    return limited;
  }
  const { poolId } = await ctx.params;
  const parsed = CreateQuestionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Trước đây parse() ném lỗi ra ngoài → 500; dữ liệu sai (kể cả ảnh thiếu mô tả / URL không hợp lệ) phải là 400
    return NextResponse.json({ error: 'INVALID_INPUT', details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  await requirePoolPermission(userId, poolId, 'edit');

  const correctCount = body.options.filter(o => !!o.isCorrect).length;
  if (body.type === 'mcq_single' && correctCount !== 1) {
    return NextResponse.json({ error: 'MCQ_SINGLE_NEEDS_EXACTLY_ONE_CORRECT' }, { status: 400 });
  }
  if (body.type === 'mcq_multi' && correctCount < 1) {
    return NextResponse.json({ error: 'MCQ_MULTI_NEEDS_AT_LEAST_ONE_CORRECT' }, { status: 400 });
  }

  const q = await prisma.question.create({
    data: {
      id: nanoid(),
      poolId,
      type: body.type,
      prompt: body.prompt,
      imageUrl: body.imageUrl ?? null,
      imageAlt: body.imageUrl ? body.imageAlt : null,
      createdByTeacherId: userId,
      updatedAt: new Date(),
      options: {
        create: body.options.map((o, idx) => ({
          id: nanoid(),
          content: o.content,
          isCorrect: !!o.isCorrect,
          order: idx,
          updatedAt: new Date(),
        })),
      },
    },
    select: { id: true },
  });

  const tags = (body.tags ?? []).map(t => t.trim()).filter(Boolean);
  for (const name of tags) {
    const normalizedName = normalizeTagName(name);

    const tag = await prisma.tag.upsert({
      where: { normalizedName },
      update: { name },
      create: { name, normalizedName },
      select: { id: true },
    });

    await prisma.questionTag.create({
      data: { questionId: q.id, tagId: tag.id },
    }).catch(() => null);
  }

  return NextResponse.json({ id: q.id });
}
