'use client';

import type { ChangeEventHandler } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import s from '@/components/chalk/chalk.module.css';
import { usePathname } from '@/libs/I18nNavigation';
import { routing } from '@/libs/I18nRouting';
import { cn } from '@/utils/cn';

const localeNames: Record<string, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

/** Language picker, styled as a cream button on the wooden ledge. */
export const LocaleSwitcher = () => {
  const t = useTranslations('LocaleSwitcher');
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleChange: ChangeEventHandler<HTMLSelectElement> = (event) => {
    router.push(`/${event.target.value}${pathname}`);
    router.refresh(); // Ensure the page takes the new locale into account related to the issue #395
  };

  return (
    <select
      defaultValue={locale}
      onChange={handleChange}
      className={cn(s.btn, s.ledgeBtn)}
      aria-label={t('label')}
      title={t('label')}
    >
      {routing.locales.map(elt => (
        <option key={elt} value={elt}>
          {localeNames[elt] ?? elt.toUpperCase()}
        </option>
      ))}
    </select>
  );
};
