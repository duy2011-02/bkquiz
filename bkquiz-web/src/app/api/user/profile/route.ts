import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/authz';
import { handleAuthorizationError } from '@/server/authzHelpers';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

/** Tên hiển thị: 1–80 ký tự sau khi bỏ khoảng trắng thừa (nhiều khoảng trắng liền nhau gộp làm một). */
const UpdateProfileSchema = z.object({
  name: z.string().transform(s => s.trim().replace(/\s+/g, ' ')).pipe(z.string().min(1).max(80)),
});

/**
 * Đổi tên hiển thị của chính mình. Email không đổi được (gắn với tài khoản Google).
 * Auth.js không ghi đè `User.name` ở các lần đăng nhập Google sau (chỉ đặt khi tạo user lần đầu),
 * nên tên đã đổi được giữ nguyên.
 */
export async function PATCH(req: Request) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const body = UpdateProfileSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: body.name },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    const authzResponse = handleAuthorizationError(error);
    if (authzResponse) {
      return authzResponse;
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'INVALID_NAME', details: error.issues }, { status: 400 });
    }
    throw error;
  }
}
