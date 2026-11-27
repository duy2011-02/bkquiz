import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { canTeachSession, requireUser } from '@/server/authz';
import { AttemptDetailView } from './AttemptDetailView';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AttemptDetail' });
  return { title: `${t('title')} - BKquiz` };
}

export default async function AttemptDetailPage(props: {
  params: Promise<{ sessionId: string; attemptId: string }>;
}) {
  const { userId } = await requireUser();
  // Chủ lớp hoặc chủ quiz của phiên (kiểm tra theo quyền trên phiên, không theo vai trò hệ thống)
  if (!(await canTeachSession(userId, (await props.params).sessionId))) {
    redirect('/dashboard');
  }

  const { sessionId, attemptId } = await props.params;
  return (
    <div className="py-5">
      <AttemptDetailView sessionId={sessionId} attemptId={attemptId} />
    </div>
  );
}
