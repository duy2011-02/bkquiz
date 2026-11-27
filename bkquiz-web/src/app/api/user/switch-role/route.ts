import { NextResponse } from 'next/server';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { enforceRateLimit } from '@/server/rateLimit';

/**
 * Chuyển giữa các vai trò hệ thống mà user đã có (giáo viên đã được duyệt thì có cả 2).
 * Lưu role được chọn vào cookie để ưu tiên khi getUserRole()
 */
export async function POST(req: Request) {
  try {
    const { userId } = await requireUser();
    const limited = await enforceRateLimit('write', `user:${userId}`);
    if (limited) {
      return limited;
    }
    const body = await req.json();
    const selectedRole = body.role === 'student' ? 'student' : 'teacher';

    // Check if user has this role, nếu chưa có thì tự động tạo (self-service)
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: { role: true },
    });

    // Chỉ chuyển sang vai trò đã được cấp (Đợt 7). Vai trò giáo viên do quản trị viên duyệt (/dashboard/admin);
    // trước đây route này tự tạo UserRole teacher nên ai cũng tự thành giáo viên được.
    // Chế độ dev: 2 tài khoản dev riêng cho giáo viên / sinh viên, chỉ đổi cookie.
    const hasRole = userRoles.some(r => r.role === selectedRole);
    if (!hasRole && process.env.DEV_BYPASS_AUTH !== '1') {
      return NextResponse.json({ error: 'ROLE_NOT_GRANTED' }, { status: 403 });
    }

    // Set cookie với role được chọn
    const res = NextResponse.json({ success: true, role: selectedRole });
    res.cookies.set('bkquiz_selected_role', selectedRole, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    // Trong dev mode, cũng cần update bkquiz_dev_role để switch role hoạt động
    if (process.env.DEV_BYPASS_AUTH === '1') {
      res.cookies.set('bkquiz_dev_role', selectedRole, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return res;
  } catch (error) {
    console.error('Error switching role:', error);
    return NextResponse.json({ error: 'SWITCH_FAILED' }, { status: 500 });
  }
}

/**
 * GET endpoint để lấy role hiện tại được chọn
 */
export async function GET() {
  try {
    const { userId } = await requireUser();
    
    // Get available roles
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: { role: true },
    });

    const availableRoles = userRoles.map(r => r.role);
    
    // Get selected role from cookie (if any)
    // Note: We can't read httpOnly cookies in server action, so we'll check in getUserRole()
    
    return NextResponse.json({
      availableRoles,
      hasTeacher: availableRoles.includes('teacher'),
      hasStudent: availableRoles.includes('student'),
    });
  } catch (error) {
    return NextResponse.json({ error: 'GET_FAILED' }, { status: 500 });
  }
}
