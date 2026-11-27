import { AuthorizationError } from '@/server/authz';
import { prisma } from '@/server/prisma';

/**
 * Quản trị viên = email nằm trong biến môi trường `ADMIN_EMAILS` (phân cách bằng dấu phẩy / khoảng trắng / chấm phẩy).
 * Quản trị viên duyệt yêu cầu làm giáo viên và thu hồi quyền giáo viên (trang /dashboard/admin).
 */
export function parseAdminEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? '')
      .split(/[\s,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@')),
  );
}

export function isAdminEmail(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  return !!email && parseAdminEmails(env).has(email.trim().toLowerCase());
}

export async function isAdminUser(userId: string): Promise<boolean> {
  if (parseAdminEmails().size === 0) {
    return false;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isAdminEmail(user?.email);
}

export async function requireAdmin(userId: string) {
  if (!(await isAdminUser(userId))) {
    throw new AuthorizationError('FORBIDDEN', 403, 'Admin only');
  }
}
