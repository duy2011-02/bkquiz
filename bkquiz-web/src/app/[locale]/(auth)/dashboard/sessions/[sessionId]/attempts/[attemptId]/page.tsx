import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getUserRole, requireUser } from '@/server/authz';
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
  const { userId, devRole } = await requireUser();
  const role = await getUserRole(userId, devRole as 'teacher' | 'student' | undefined);

  if (role !== 'teacher') {
    redirect('/dashboard');
  }

  const { sessionId, attemptId } = await props.params;
  return (
    <div className="py-5">
      <AttemptDetailView sessionId={sessionId} attemptId={attemptId} />
    </div>
  );
}
