import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SessionsPanel } from './SessionsPanel';

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Sessions' });
  return { title: t('meta_title') };
}

export default async function SessionsPage() {
  return (
    <div className="py-5">
      <SessionsPanel />
    </div>
  );
}

