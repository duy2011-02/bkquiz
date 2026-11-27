import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { ChalkRoom } from '@/components/chalk/ChalkRoom';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { isAdminUser } from '@/server/admin';
import { getUserAvailableRoles, getUserRole, requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { getI18nPath } from '@/utils/Helpers';
import { RoleSwitcher } from './RoleSwitcher';
import { Sidebar } from './Sidebar';
import { SignOutButton } from './SignOutButton';

export default async function DashboardLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'DashboardLayout',
  });

  const { userId, devRole } = await requireUser();
  // Gọi song song để tránh race condition
  const [role, availableRoles, user, isAdmin] = await Promise.all([
    getUserRole(userId, devRole as 'teacher' | 'student' | undefined),
    getUserAvailableRoles(userId).catch(() => {
      // Fallback: nếu có lỗi, trả về empty array
      return [] as ('teacher' | 'student')[];
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { onboardedAt: true } }),
    isAdminUser(userId),
  ]);

  // Lần đăng nhập đầu: chọn vai trò trước (giáo viên phải được quản trị viên duyệt)
  if (!user?.onboardedAt) {
    redirect(getI18nPath('/onboarding', locale));
  }
  const pendingTeacherRequests = isAdmin ? await prisma.teacherRequest.count({ where: { status: 'pending' } }) : 0;

  // Ô chọn vai trò chỉ hiện khi tài khoản có cả 2 vai trò (giáo viên đã được duyệt).
  // Chế độ dev (DEV_BYPASS_AUTH=1): luôn hiện để chuyển giữa 2 tài khoản dev giáo viên / sinh viên.
  const switchableRoles: ('teacher' | 'student')[] = process.env.DEV_BYPASS_AUTH === '1' ? ['teacher', 'student'] : (availableRoles ?? []);

  // Account controls sit on the wooden ledge under the board, like the attempt page's exit button
  const ledge = (
    <>
      <LocaleSwitcher />
      {switchableRoles.length > 1 && (
        <RoleSwitcher
          currentRole={role}
          roles={switchableRoles}
          label={t('role_label')}
          teacherLabel={t('teacher_role')}
          studentLabel={t('student_role')}
        />
      )}
      <SignOutButton label={t('sign_out')} />
    </>
  );

  return (
    <ChalkRoom ledge={ledge}>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
        <Sidebar
          role={role}
          availableRoles={availableRoles}
          dashboardLink={t('dashboard_link')}
          classesLink={t('classes_link')}
          quizzesLink={t('quizzes_link')}
          questionBankLink={t('question_bank_link')}
          userProfileLink={t('user_profile_link')}
          teacherRole={t('teacher_role')}
          studentRole={t('student_role')}
          mySessions={t('my_sessions')}
          userProfile={t('user_profile')}
          collapseSidebar={t('collapse_sidebar')}
          expandSidebar={t('expand_sidebar')}
          signOutLabel={t('sign_out')}
          isAdmin={isAdmin}
          adminLink={pendingTeacherRequests > 0 ? t('admin_link_pending', { count: pendingTeacherRequests }) : t('admin_link')}
        />

        <main className="min-w-0 flex-1">{props.children}</main>
      </div>
    </ChalkRoom>
  );
}
