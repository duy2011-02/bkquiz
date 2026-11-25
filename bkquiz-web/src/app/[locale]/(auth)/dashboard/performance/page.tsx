import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getUserRole, requireUser } from '@/server/authz';
import { PerformancePanel } from './PerformancePanel';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Performance' });
  return { title: t('meta_title') };
}

export default async function PerformancePage() {
  const { userId, devRole } = await requireUser();
  const role = await getUserRole(userId, devRole as 'teacher' | 'student' | undefined);

  if (role !== 'student') {
    redirect('/dashboard');
  }

  return (
    <div className="py-5">
      <PerformancePanel />
    </div>
  );
}

