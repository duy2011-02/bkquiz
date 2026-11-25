import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import s from '@/components/chalk/chalk.module.css';
import { AppConfig } from '@/utils/AppConfig';
import { cn } from '@/utils/cn';

type ISignUpPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: ISignUpPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'SignUp',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function SignUpPage(props: ISignUpPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'SignUp',
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

          {/* Sign up uses the same Google flow as sign in */}
          <GoogleSignInButton />

          <div className={s.rule} />

          <p className={cn(s.modalText, 'text-center')}>
            {t('already_have_account')}
            {' '}
            <Link href={`/${locale}/sign-in`} className={cn(s.yellow, 'underline underline-offset-4')}>
              {t('sign_in_link')}
            </Link>
          </p>

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
