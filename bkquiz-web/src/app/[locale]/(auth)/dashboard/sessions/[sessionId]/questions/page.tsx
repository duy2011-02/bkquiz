import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { canTeachSession, requireUser } from '@/server/authz';
import { QuestionsView } from './QuestionsView';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'SessionQuestions' });
  return { title: `${t('title')} - BKquiz` };
}

export default async function QuestionsPage(props: {
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
      <QuestionsView sessionId={sessionId} userId={userId} />
    </div>
  );
}
