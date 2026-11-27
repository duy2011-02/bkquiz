import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { canTeachSession, requireUser } from '@/server/authz';
import { SessionMonitorView } from './SessionMonitorView';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SessionMonitor' });
  return { title: `${t('title')} - BKquiz` };
}

/**
 * Trang giám sát phiên thi — mở trên máy giáo viên (không chiếu lên lớp):
 * trạng thái từng sinh viên và các thao tác mở khoá / gia hạn riêng / thu bài.
 */
export default async function SessionMonitorPage(props: {
  params: Promise<{ sessionId: string }>;
}) {
  const { userId } = await requireUser();
  // Chủ lớp hoặc chủ quiz của phiên (kiểm tra theo quyền trên phiên, không theo vai trò hệ thống)
  if (!(await canTeachSession(userId, (await props.params).sessionId))) {
    redirect('/dashboard');
  }

  const { sessionId } = await props.params;
  return (
    <div className="py-5">
      <SessionMonitorView sessionId={sessionId} />
    </div>
  );
}
