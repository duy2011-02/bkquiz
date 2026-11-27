import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import s from '@/components/chalk/chalk.module.css';
import { requireUser } from '@/server/authz';
import { prisma } from '@/server/prisma';
import { AppConfig } from '@/utils/AppConfig';
import { cn } from '@/utils/cn';
import { getI18nPath } from '@/utils/Helpers';
import { SignOutClient } from '../../dashboard/SignOutClient';
import { OnboardingForm } from './OnboardingForm';

type OnboardingPageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: OnboardingPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'Onboarding' });
  return { title: `${t('meta_title')} - BKquiz` };
}

/**
 * Lần đăng nhập đầu: chọn vai trò. Sinh viên dùng ngay; giáo viên gửi yêu cầu để quản trị viên duyệt.
 * Đã chọn rồi → về dashboard. Dashboard chuyển hướng về đây khi `User.onboardedAt` còn trống.
 */
export default async function OnboardingPage(props: OnboardingPageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Onboarding' });

  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch {
    redirect(getI18nPath('/sign-in', locale));
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardedAt: true, name: true } });
  if (user?.onboardedAt) {
    redirect(getI18nPath('/dashboard', locale));
  }

  return (
    <>
      <div className={s.modal}>
        <div className={s.modalBoard}>
          <div className="text-center">
            <span className={cn(s.script, s.chalk, 'text-4xl font-bold')}>{AppConfig.name}</span>
          </div>
          <div className={s.rule} />
          <h1 className={cn(s.modalTitle, s.chalk)}>{t('title', { name: user?.name ?? '' })}</h1>
          <p className={s.modalText}>{t('description')}</p>
          <OnboardingForm />
        </div>
      </div>
      <SignOutClient label={t('sign_out')} buttonVariant="ledge" />
    </>
  );
}
