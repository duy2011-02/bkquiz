import { z } from 'zod';

/** Nội dung yêu cầu làm giáo viên: trường / đơn vị (bắt buộc) + ghi chú cho quản trị viên. */
export const TeacherRequestInput = z.object({
  organization: z.string().transform(s => s.trim().replace(/\s+/g, ' ')).pipe(z.string().min(2).max(200)),
  note: z.string().trim().max(500).optional().transform(s => s || undefined),
});

/** Lần đăng nhập đầu: sinh viên dùng ngay; giáo viên kèm thông tin yêu cầu để quản trị viên duyệt. */
export const OnboardingInput = z.discriminatedUnion('role', [
  z.object({ role: z.literal('student') }),
  z.object({ role: z.literal('teacher') }).merge(TeacherRequestInput),
]);
