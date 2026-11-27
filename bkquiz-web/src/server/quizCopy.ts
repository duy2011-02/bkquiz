import type { Prisma } from '@prisma/client';

/** Quiz gốc (chỉ các trường cần chép). */
export type QuizCopySource = {
  title: string;
  settings: Prisma.JsonValue;
  rules: Array<{
    tagId: string;
    count: number | null;
    commonCount: number | null;
    variantCount: number | null;
    extraPercent: number | null;
    filters: Prisma.JsonValue;
  }>;
  tags: Array<{ tagId: string }>;
};

export const QUIZ_TITLE_MAX = 200;

/**
 * Dữ liệu tạo bản sao của một quiz — hàm thuần, không truy cập database.
 * Bản sao là quiz **nháp** độc lập của `ownerId`: chép cài đặt (thời lượng, chấm điểm…), luật chọn câu và tag;
 * không chép phiên / kết quả. Tiêu đề do client gửi (đã dịch), mặc định "<tên> (copy)", cắt về tối đa 200 ký tự.
 */
export function buildQuizCopy(source: QuizCopySource, ownerId: string, title?: string): Prisma.QuizCreateInput {
  const wanted = (title ?? '').trim() || `${source.title} (copy)`;
  return {
    title: wanted.slice(0, QUIZ_TITLE_MAX),
    status: 'draft',
    settings: (source.settings ?? {}) as Prisma.InputJsonValue,
    createdBy: { connect: { id: ownerId } },
    rules: {
      create: source.rules.map(r => ({
        tag: { connect: { id: r.tagId } },
        count: r.count,
        commonCount: r.commonCount,
        variantCount: r.variantCount,
        extraPercent: r.extraPercent,
        filters: (r.filters ?? {}) as Prisma.InputJsonValue,
      })),
    },
    tags: {
      create: [...new Set(source.tags.map(t => t.tagId))].map(tagId => ({ tag: { connect: { id: tagId } } })),
    },
  };
}
