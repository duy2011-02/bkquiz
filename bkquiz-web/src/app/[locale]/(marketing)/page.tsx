import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

type IIndexProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IIndexProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'Index',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

const sectionTitle = cn(s.heading, s.chalk, 'text-3xl');

export default async function Index(props: IIndexProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'Index' });

  const heroFeatures = [
    {
      title: t('hero_feature_1_title'),
      desc: t.rich('hero_feature_1_desc', {
        mono: chunks => <span className="font-mono">{chunks}</span>,
      }),
    },
    { title: t('hero_feature_2_title'), desc: t('hero_feature_2_desc') },
    { title: t('hero_feature_3_title'), desc: t('hero_feature_3_desc') },
  ];

  const features = [
    { label: t('feature_teacher_label'), title: t('feature_teacher_title'), desc: t('feature_teacher_desc') },
    { label: t('feature_bank_label'), title: t('feature_bank_title'), desc: t('feature_bank_desc') },
    { label: t('feature_screen_label'), title: t('feature_screen_title'), desc: t('feature_screen_desc') },
    { label: t('feature_reports_label'), title: t('feature_reports_title'), desc: t('feature_reports_desc') },
  ];

  const useCases = [
    { title: t('use_case_1_title'), desc: t('use_case_1_desc') },
    { title: t('use_case_2_title'), desc: t('use_case_2_desc') },
    { title: t('use_case_3_title'), desc: t('use_case_3_desc') },
  ];

  const plans = [
    {
      icon: '🚀',
      title: t('self_hosted_title'),
      desc: t('self_hosted_desc'),
      points: [t('self_hosted_point_1'), t('self_hosted_point_2'), t('self_hosted_point_3')],
      cta: t('view_on_github_button'),
      href: 'https://github.com/your-org/bkquiz',
      external: true,
    },
    {
      icon: '☁️',
      title: t('cloud_title'),
      desc: t('cloud_desc'),
      points: [t('cloud_point_1'), t('cloud_point_2'), t('cloud_point_3')],
      cta: t('start_free'),
      href: '/sign-in/',
      external: false,
    },
  ];

  const community = [
    { title: '⭐ GitHub', desc: t('github_desc'), link: t('view_on_github_link'), href: 'https://github.com/trungtv/bkquiz' },
    { title: '📄 License', desc: t('license_desc'), link: t('view_license'), href: 'https://github.com/trungtv/bkquiz/blob/main/LICENSE' },
    { title: '🤝 Contributing', desc: t('contributing_desc'), link: t('contributing_guide'), href: 'https://github.com/trungtv/bkquiz/blob/main/README.md#-contributing' },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Hero: the lesson of the day, written large on the board */}
      <section className="flex flex-col gap-4 pt-4">
        <p className={s.dim}>{t('hero_eyebrow')}</p>
        <h1 className={cn(s.heading, s.chalk, 'max-w-4xl text-4xl leading-tight md:text-6xl')}>
          {t('hero_title')}
        </h1>
        <p className={cn(s.modalText, 'max-w-2xl text-xl')}>
          {t('hero_description')}
        </p>

        <ul className="grid gap-4 md:grid-cols-3">
          {heroFeatures.map(f => (
            <li key={f.title} className="flex items-start gap-3">
              <span className={cn(s.green, 'text-xl leading-none')} aria-hidden="true">✓</span>
              <div>
                <div className={cn(s.chalk, 'text-lg')}>{f.title}</div>
                <div className={s.dim}>{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/sign-in/" className={cn(s.btn, s.solidBtn)}>
            {t('cta_start_google')}
          </Link>
          <Link href="/dashboard/" className={s.btn}>
            {t('cta_demo_dashboard')}
          </Link>
          <Link
            href="https://github.com/trungtv/bkquiz"
            target="_blank"
            rel="noopener noreferrer"
            className={s.btn}
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>GitHub</span>
          </Link>
        </div>
      </section>

      <div className={s.rule} />

      {/* What it does */}
      <section className="grid gap-4 md:grid-cols-2">
        {features.map(f => (
          <Card key={f.title} className="flex flex-col gap-2 p-5">
            <span className={cn(s.tag, s.blue, 'self-start')}>{f.label}</span>
            <h2 className={cn(s.chalk, 'text-2xl')}>{f.title}</h2>
            <p className={s.modalText}>{f.desc}</p>
          </Card>
        ))}
      </section>

      {/* Who it is for */}
      <section className="flex flex-col gap-4">
        <h2 className={sectionTitle}>{t('use_cases_title')}</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {useCases.map(u => (
            <li key={u.title}>
              <div className={cn(s.yellow, 'text-lg')}>{u.title}</div>
              <div className={s.dim}>{u.desc}</div>
            </li>
          ))}
        </ul>
      </section>

      <div className={s.rule} />

      {/* Free & open source */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className={sectionTitle}>{t('free_open_source_title')}</h2>
          <p className={cn(s.dim, 'mt-1')}>{t('free_open_source_desc')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {plans.map(p => (
            <Card key={p.title} className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <div className="text-3xl" aria-hidden="true">{p.icon}</div>
                <div>
                  <h3 className={cn(s.chalk, 'text-2xl')}>{p.title}</h3>
                  <p className={s.dim}>{p.desc}</p>
                </div>
              </div>
              <ul className="flex flex-col gap-1">
                {p.points.map(point => (
                  <li key={point} className="flex items-center gap-2">
                    <span className={s.green} aria-hidden="true">✓</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                {...(p.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={cn(s.btn, s.btnPrimary, 'mt-auto w-full')}
              >
                {p.cta}
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Community */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className={sectionTitle}>{t('community_title')}</h2>
          <p className={cn(s.dim, 'mt-1')}>{t('community_desc')}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {community.map(c => (
            <Card key={c.title} className="flex flex-col gap-2 p-5">
              <h3 className={cn(s.chalk, 'text-xl')}>{c.title}</h3>
              <p className={s.dim}>{c.desc}</p>
              <Link
                href={c.href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(s.yellow, 'mt-auto underline underline-offset-4')}
              >
                {c.link}
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <div className={s.rule} />

      {/* FAQ */}
      <section className="flex flex-col gap-4 pb-4">
        <div>
          <h2 className={sectionTitle}>{t('faq_title')}</h2>
          <p className={cn(s.dim, 'mt-1')}>{t('faq_desc')}</p>
        </div>

        <div className="flex flex-col gap-3">
          {([1, 2, 3, 4, 5] as const).map(n => ({
            q: t(`faq_${n}_q`),
            a: t(`faq_${n}_a`),
          })).map(({ q, a }) => (
            <details key={q} className={cn(s.box, 'group')}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3">
                <span className={cn(s.chalk, 'text-lg')}>{q}</span>
                <span className={cn(s.yellow, 'text-xl group-open:hidden')} aria-hidden="true">+</span>
                <span className={cn(s.yellow, 'hidden text-xl group-open:inline')} aria-hidden="true">×</span>
              </summary>
              <div className={cn(s.modalText, 'px-5 pb-4')}>{a}</div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};
