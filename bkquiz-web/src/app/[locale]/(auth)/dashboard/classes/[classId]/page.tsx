import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { StudentClassDetail } from './StudentClassDetail';
import { TeacherClassDetail } from './TeacherClassDetail';

export async function generateMetadata(props: {
  params: Promise<{ locale: string; classId: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Classes.detail' });
  return { title: `${t('meta_title')} - BKquiz` };
}

export default async function ClassDetailPage(props: {
  params: Promise<{ locale: string; classId: string }>;
}) {
  const { locale, classId } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Classes' });
  const { userId } = await requireUser();

  // Verify user has access to this classroom
  const membership = await prisma.classMembership.findUnique({
    where: { classroomId_userId: { classroomId: classId, userId } },
    select: { status: true, roleInClass: true },
  });

  if (!membership || membership.status !== 'active') {
    return (
      <div className="py-5">
        <div className="rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-4 text-center text-chalk-pink">
          {t('no_access')}
        </div>
      </div>
    );
  }

  // Giao diện theo vai trò trong lớp: chủ lớp dùng giao diện giáo viên, thành viên còn lại là sinh viên
  if (membership.roleInClass === 'teacher') {
    return (
      <div className="py-5">
        <TeacherClassDetail classId={classId} />
      </div>
    );
  }

  return (
    <div className="py-5">
      <StudentClassDetail classId={classId} />
    </div>
  );
}
