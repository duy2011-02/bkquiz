import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { BaseTemplate } from '@/templates/BaseTemplate';
import { cn } from '@/utils/cn';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'RootLayout',
  });

  return (
    <BaseTemplate
      leftNav={(
        <>
          <li>
            <Link href="/" className={s.navLink}>
              {t('home_link')}
            </Link>
          </li>
          <li>
            <Link href="/dashboard/" className={s.navLink}>
              {t('dashboard_link')}
            </Link>
          </li>
        </>
      )}
      rightNav={(
        <>
          <li>
            <Link href="/sign-in/" className={cn(s.btn, s.btnPrimary)}>
              {t('sign_in_link')}
            </Link>
          </li>
          <li>
            <Link href="/sign-up/" className={s.btn}>
              {t('sign_up_link')}
            </Link>
          </li>
        </>
      )}
      ledge={<LocaleSwitcher />}
    >
      {props.children}
    </BaseTemplate>
  );
}
