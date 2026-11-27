import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { ProfileForm } from './ProfileForm';
import { TeacherRequestCard } from './TeacherRequestCard';

type IUserProfilePageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IUserProfilePageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'UserProfile',
  });

  return {
    title: t('meta_title'),
  };
}

export default async function UserProfilePage(props: IUserProfilePageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'UserProfile' });
  const { userId } = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      roles: { where: { role: 'teacher' }, select: { role: true } },
      teacherRequest: { select: { status: true, organization: true, note: true, reviewNote: true } },
    },
  });
  const isTeacher = (user?.roles.length ?? 0) > 0;

  return (
    <div className="py-5">
      <h2 className="text-xl font-semibold text-chalk">{t('title')}</h2>
      <ProfileForm email={user?.email ?? null} name={user?.name ?? null} />
      {/* Chưa là giáo viên: gửi / theo dõi yêu cầu làm giáo viên (quản trị viên duyệt) */}
      {!isTeacher && <TeacherRequestCard request={user?.teacherRequest ?? null} />}
    </div>
  );
};
