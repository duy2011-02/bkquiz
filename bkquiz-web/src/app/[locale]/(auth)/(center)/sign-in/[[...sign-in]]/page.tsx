import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { AppConfig } from '@/utils/AppConfig';
import { cn } from '@/utils/cn';
import { SignInClient } from './SignInClient';

type ISignInPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: ISignInPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'SignIn',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SignInPage(props: ISignInPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'SignIn',
  });

  return (
    <>
      <div className={s.modal}>
        <div className={s.modalBoard}>
          <div className="text-center">
            <Link href={`/${locale}/`} className={cn(s.script, s.chalk, 'text-4xl font-bold')}>
              {AppConfig.name}
            </Link>
            <p className={cn(s.dim, 'mt-1')}>{t('tagline')}</p>
          </div>

          <div className={s.rule} />

          <h1 className={cn(s.modalTitle, s.chalk)}>{t('title')}</h1>
          <p className={s.modalText}>{t('description')}</p>

          <SignInClient />

          <div className={s.rule} />

          <p className={cn(s.inputHint, 'text-center')}>
            {t('terms_text')}
            {' '}
            <Link href={`/${locale}/terms`} className={cn(s.yellow, 'underline underline-offset-4')}>
              {t('terms_link')}
            </Link>
            {' '}
            {t('and')}
            {' '}
            <Link href={`/${locale}/privacy`} className={cn(s.yellow, 'underline underline-offset-4')}>
              {t('privacy_link')}
            </Link>
            .
          </p>
        </div>
      </div>

      <Link href={`/${locale}/`} className={cn(s.btn, s.ledgeBtn)}>
        {t('back_to_home')}
      </Link>
    </>
  );
}
