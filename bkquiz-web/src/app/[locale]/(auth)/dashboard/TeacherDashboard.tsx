import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/server/prisma';
import { cn } from '@/utils/cn';

type TeacherDashboardProps = {
  userId: string;
  classes: Array<{ id: string; name: string; classCode: string }>;
  quizCount: number;
  poolCount: number;
  activeSessionCount: number;
  locale: string;
};

export async function TeacherDashboard(props: TeacherDashboardProps) {
  const { userId, classes, quizCount, activeSessionCount, locale } = props;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'Dashboard.teacher',
  });
  const tClasses = await getTranslations({ locale, namespace: 'Classes' });
  const tQuestionBank = await getTranslations({ locale, namespace: 'QuestionBank' });
  const tSessions = await getTranslations({ locale, namespace: 'Sessions' });

  // Fetch active sessions for widget
  const activeSessions = await prisma.quizSession.findMany({
    where: {
      status: 'active',
      quiz: { createdByTeacherId: userId },
    },
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      startedAt: true,
      quiz: {
        select: {
          id: true,
          title: true,
        },
      },
      _count: {
        select: {
          attempts: true,
        },
      },
    },
  });

  // Fetch quiz status overview
  const [draftQuizzes, publishedQuizzes, quizzesWithoutRules] = await Promise.all([
    prisma.quiz.count({
      where: {
        createdByTeacherId: userId,
        status: 'draft',
      },
    }),
    prisma.quiz.count({
      where: {
        createdByTeacherId: userId,
        status: 'published',
      },
    }),
    prisma.quiz.count({
      where: {
        createdByTeacherId: userId,
        rules: { none: {} },
      },
    }),
  ]);

  const recentClasses = classes.slice(0, 5);

  function formatDate(date: Date | null) {
    if (!date) {
      return '—';
    }
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  const kpis = [
    { href: '/dashboard/classes', label: t('classes_label'), value: classes.length, tag: <Badge variant="neutral">{t('tag_active')}</Badge>, desc: t('classes_description') },
    { href: '/dashboard/quizzes', label: t('quizzes_label'), value: quizCount, tag: <Badge variant="info">{t('tag_total')}</Badge>, desc: t('quizzes_description') },
    {
      href: '/dashboard/sessions',
      label: t('active_sessions_label'),
      value: activeSessionCount,
      tag: (
        <Badge variant={activeSessionCount > 0 ? 'success' : 'neutral'}>
          {activeSessionCount > 0 ? t('tag_running') : t('tag_idle')}
        </Badge>
      ),
      desc: t('active_sessions_description'),
    },
  ];

  const sectionTitle = cn(s.chalk, 'text-xl');

  return (
    <div className="flex flex-col gap-6">
      {/* Header written on the board */}
      <header className={s.header}>
        <div className="min-w-0">
          <p className={s.dim}>{t('header_subtitle')}</p>
          <h1 className={cn(s.title, s.chalk)}>{t('header_title')}</h1>
          <p className={cn(s.meta, s.dim, 'mt-1')}>{t('header_description')}</p>
        </div>
        <div className={s.actionsGroup}>
          <Link href="/dashboard/classes/" className={cn(s.btn, s.btnPrimary)}>{t('manage_classes')}</Link>
          <Link href="/dashboard/quizzes/" className={s.btn}>{t('manage_quizzes')}</Link>
          <Link href="/dashboard/question-bank/" className={s.btn}>{t('question_bank')}</Link>
        </div>
      </header>

      <div className={s.rule} />

      {/* Quick actions */}
      <section className="flex flex-wrap items-center gap-3">
        <span className={s.dim}>{t('quick_actions')}</span>
        <Link href="/dashboard/classes" className={cn(s.btn, s.solidBtn)}>{t('create_class')}</Link>
        <Link href="/dashboard/quizzes" className={cn(s.btn, s.btnPrimary)}>{t('create_quiz')}</Link>
        <Link href="/dashboard/question-bank" className={s.btn}>{t('import_pool')}</Link>
      </section>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        {kpis.map(k => (
          <Link key={k.href} href={k.href} className="block">
            <Card interactive className="h-full p-5">
              <div className={s.dim}>{k.label}</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className={cn(s.num, s.chalk, 'text-5xl leading-none font-bold')}>{k.value}</span>
                {k.tag}
              </div>
              <p className={cn(s.dim, 'mt-2')}>{k.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent classes */}
        <section className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className={sectionTitle}>{t('recent_classes_title')}</h2>
              <p className={s.dim}>{t('recent_classes_description')}</p>
            </div>
            <Link href="/dashboard/classes" className={cn(s.btn, s.btnSm)}>{t('view_all')}</Link>
          </div>
          {recentClasses.length === 0
            ? (
                <Card variant="note" className={cn(s.dim, 'flex flex-col items-start gap-3')}>
                  <span>{t('no_classes_yet')}</span>
                  <Link href="/dashboard/classes" className={cn(s.btn, s.btnPrimary)}>{t('create_first_class')}</Link>
                </Card>
              )
            : (
                <ul className="flex flex-col gap-2">
                  {recentClasses.map(c => (
                    <li key={c.id}>
                      <Link href={`/dashboard/classes/${c.id}`} className="block">
                        <Card interactive className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <div className={cn(s.chalk, 'truncate text-lg')}>{c.name}</div>
                            <div className={cn(s.dim, 'font-mono text-sm')}>{c.classCode}</div>
                          </div>
                          <span className={s.dim} aria-hidden="true">→</span>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
        </section>

        {/* Active sessions */}
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>{t('active_sessions_widget_title')}</h2>
          {activeSessions.length === 0
            ? (
                <Card variant="note" className={s.dim}>{t('no_sessions_running')}</Card>
              )
            : (
                <ul className="flex flex-col gap-2">
                  {activeSessions.map(session => (
                    <li key={session.id}>
                      <Link href={`/dashboard/sessions/${session.id}/teacher`} className="block">
                        <Card interactive className="px-4 py-3">
                          <div className={cn(s.chalk, 'truncate text-lg')}>{session.quiz.title}</div>
                          <div className={cn(s.dim, 'flex items-center justify-between gap-2 text-sm')}>
                            <span className={s.green}>
                              {session._count.attempts}
                              {' '}
                              {t('students')}
                            </span>
                            <span>{formatDate(session.startedAt)}</span>
                          </div>
                        </Card>
                      </Link>
                    </li>
                  ))}
                  {activeSessionCount > activeSessions.length && (
                    <li>
                      <Link href="/dashboard/sessions" className={cn(s.btn, 'w-full')}>
                        {t('view_all_sessions', { count: activeSessionCount })}
                      </Link>
                    </li>
                  )}
                </ul>
              )}
        </section>
      </div>

      {/* Quiz status overview */}
      {(draftQuizzes > 0 || publishedQuizzes > 0 || quizzesWithoutRules > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>{t('quiz_status_title')}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="px-4 py-3">
              <div className={s.dim}>{t('draft')}</div>
              <div className={cn(s.num, s.chalk, 'text-4xl font-bold')}>{draftQuizzes}</div>
            </Card>
            <Card className="px-4 py-3">
              <div className={s.dim}>{t('published')}</div>
              <div className={cn(s.num, s.green, 'text-4xl font-bold')}>{publishedQuizzes}</div>
            </Card>
            {quizzesWithoutRules > 0 && (
              <Card variant="note" className={cn(s.yellow, 'px-4 py-3')}>
                <div>{t('no_rules')}</div>
                <div className={cn(s.num, 'text-4xl font-bold')}>{quizzesWithoutRules}</div>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Getting started */}
      <details className={cn(s.note, s.dim, 'group')}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 hover:text-chalk">
          <span>{t('getting_started')}</span>
          <span className="transition-transform group-open:rotate-180" aria-hidden="true">▾</span>
        </summary>
        <ol className={cn(s.modalText, 'mt-2 flex list-decimal flex-col gap-1 pl-6')}>
          <li>
            {t('getting_started_step1')}
            {' '}
            <Link href="/dashboard/classes" className={cn(s.yellow, 'underline underline-offset-4')}>
              {tClasses('my_classes')}
            </Link>
            .
          </li>
          <li>
            {t('getting_started_step2')}
            {' '}
            <span className={s.chalk}>{t('question_pool')}</span>
            {' '}
            {t('in')}
            {' '}
            <Link href="/dashboard/question-bank" className={cn(s.yellow, 'underline underline-offset-4')}>
              {tQuestionBank('title')}
            </Link>
            .
          </li>
          <li>
            {t('getting_started_step3')}
            {' '}
            <span className={s.chalk}>{t('quiz')}</span>
            {' '}
            {t('for_each_class_and_configure')}
            {' '}
            <span className="font-mono">{t('rules')}</span>
            {' '}
            {t('by_tag_pool')}
          </li>
          <li>
            {t('getting_started_step4')}
            {' '}
            <Link href="/dashboard/sessions" className={cn(s.yellow, 'underline underline-offset-4')}>
              {tSessions('title')}
            </Link>
            {' '}
            {t('to')}
            {' '}
            <span className={s.chalk}>{t('start_session')}</span>
            {' '}
            {t('and_display')}
            {' '}
            <span className="font-mono">{t('Teacher_Screen')}</span>
            {' '}
            {t('for_students')}
          </li>
        </ol>
      </details>
    </div>
  );
}
