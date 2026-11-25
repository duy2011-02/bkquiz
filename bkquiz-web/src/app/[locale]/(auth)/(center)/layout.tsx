import { setRequestLocale } from 'next-intl/server';
import s from '@/components/chalk/chalk.module.css';
import { cn } from '@/utils/cn';

/** Cream classroom wall with a single small chalkboard in the middle. */
export default async function CenteredLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <div className={cn(s.room, 'flex-col items-center justify-center gap-4 py-8')}>
      {props.children}
    </div>
  );
}
