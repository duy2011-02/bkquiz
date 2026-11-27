import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { isAdminUser } from '@/server/admin';
import { requireUser } from '@/server/authz';
import { getI18nPath } from '@/utils/Helpers';
import { AdminView } from './AdminView';

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Admin' });
  return { title: `${t('title')} - BKquiz` };
}

/** Trang Quản trị (chỉ email trong ADMIN_EMAILS): duyệt yêu cầu làm giáo viên, thu hồi quyền giáo viên. */
export default async function AdminPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const { userId } = await requireUser();
  if (!(await isAdminUser(userId))) {
    redirect(getI18nPath('/dashboard', locale));
  }
  return (
    <div className="py-5">
      <AdminView currentUserId={userId} />
    </div>
  );
}
