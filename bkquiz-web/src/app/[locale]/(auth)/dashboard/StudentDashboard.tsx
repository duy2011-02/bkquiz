import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { prisma } from '@/server/prisma';
import { toTenPointScale } from '@/server/scoring';
import { cn } from '@/utils/cn';

type StudentDashboardProps = {
  userId: string;
  classes: Array<{ id: string; name: string; classCode: string }>;
  myActiveSessionsCount: number;
  myAttemptsCount: number;
  locale: string;
};

export async function StudentDashboard(props: StudentDashboardProps) {
  const { userId, classes, myActiveSessionsCount, myAttemptsCount, locale } = props;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'Dashboard.student',
  });

  // Yêu cầu làm giáo viên đang chờ / bị từ chối → ghi chú trên đầu trang (Đợt 7)
  const teacherRequest = await prisma.teacherRequest.findUnique({
    where: { userId },
    select: { status: true, reviewNote: true },
  });

  // Fetch active sessions (priority display)
  const activeSessions = await prisma.attempt.findMany({
    where: {
      userId,
      status: 'active',
      quizSession: { status: 'active' },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      quizSession: {
        select: {
          id: true,
          startedAt: true,
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  // Fetch upcoming sessions (lobby status)
  const upcomingSessions = await prisma.attempt.findMany({
    where: {
      userId,
      quizSession: { status: 'lobby' },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      quizSession: {
        select: {
          id: true,
          createdAt: true,
          quiz: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  // Fetch performance summary
  const performanceData = await prisma.attempt.findMany({
    where: {
      userId,
      status: 'submitted',
      score: { not: null },
      totalQuestions: { gt: 0 },
    },
    orderBy: { submittedAt: 'desc' },
    take: 10,
    select: {
      score: true,
      totalQuestions: true,
    },
  });

  // Điểm thang 10 (mỗi bài quy đổi theo số câu của bài đó)
  const scores = performanceData.map(a => toTenPointScale(a.score!, a.totalQuestions!));
  const averageScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : null;
  const highestScore = scores.length > 0
    ? Math.max(...scores)
    : null;

  const recentClasses = classes.slice(0, 3);

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

  return (
    <div className="space-y-7">
      {/* Header */}
      <Card className="border-chalk-blue/30 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-base text-chalk-blue">{t('header_subtitle')}</div>
            <h1 className="mt-1 font-chalk text-[1.6rem] leading-tight chalk-glow text-chalk md:text-[2rem]">
              {t('header_title')}
            </h1>
            <div className="mt-2 text-base text-chalk-dim">
              {t('header_description')}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/sessions" className={cn(s.btn, s.btnPrimary)}>{t('view_my_sessions')}</Link>
          </div>
        </div>
        {teacherRequest?.status === 'pending'
          ? (
              <div className="mt-4 rounded-hand border border-chalk-yellow/40 bg-chalk-yellow/10 p-3 text-base text-chalk-yellow">
                {t('teacher_request_pending')}
              </div>
            )
          : null}
        {teacherRequest?.status === 'rejected'
          ? (
              <div className="mt-4 rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-3 text-base text-chalk-pink">
                {t('teacher_request_rejected')}
                {' '}
                <Link href="/dashboard/user-profile" className="underline underline-offset-4">{t('teacher_request_open_profile')}</Link>
              </div>
            )
          : null}
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/dashboard/classes">
          <Card interactive className="cursor-pointer border-chalk-blue/20 p-6 transition-all duration-200 hover:border-chalk-blue/40">
            <div className="text-base text-chalk-dim">{t('classes_label')}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-semibold text-chalk-blue">{classes.length}</div>
              <Badge variant="neutral">active</Badge>
            </div>
            <div className="mt-2 text-sm text-chalk-dim">
              {t('classes_description')}
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/sessions">
          <Card interactive className="cursor-pointer border-chalk-blue/20 p-6 transition-all duration-200 hover:border-chalk-blue/40">
            <div className="text-base text-chalk-dim">{t('my_active_sessions_label')}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-semibold text-chalk-blue">{myActiveSessionsCount}</div>
              <Badge variant={myActiveSessionsCount > 0 ? 'success' : 'neutral'}>
                {myActiveSessionsCount > 0 ? 'active' : 'none'}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-chalk-dim">
              {t('my_active_sessions_description')}
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/sessions">
          <Card interactive className="cursor-pointer border-chalk-blue/20 p-6 transition-all duration-200 hover:border-chalk-blue/40">
            <div className="text-base text-chalk-dim">{t('my_attempts_label')}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-3xl font-semibold text-chalk-blue">{myAttemptsCount}</div>
              <Badge variant="info">total</Badge>
            </div>
            <div className="mt-2 text-sm text-chalk-dim">
              {t('my_attempts_description')}
            </div>
          </Card>
        </Link>
      </div>

      {/* Active Sessions Priority */}
      {activeSessions.length > 0 && (
        <Card className="border-chalk-blue/30 p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">
            {t('active_sessions_title', { count: activeSessions.length })}
          </div>
          <div className="space-y-3">
            {activeSessions.map((attempt, idx) => (
              <Link key={attempt.id} href={`/attempt/${attempt.id}`}>
                <Card
                  interactive
                  className="cursor-pointer border-chalk-blue/50 bg-chalk-blue/5 p-5 transition-all duration-200 hover:border-chalk-blue/70 hover:bg-chalk-blue/10"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-semibold text-chalk">
                        {attempt.quizSession.quiz.title}
                      </div>
                      <div className="mt-1 text-sm text-chalk-dim">
                        {t('started_at')}
                        {' '}
                        {formatDate(attempt.quizSession.startedAt)}
                      </div>
                    </div>
                    <Button variant="primary" size="sm">
                      {t('continue')}
                    </Button>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* My Classes */}
        <Card className="border-chalk-blue/20 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-chalk">{t('my_classes_title')}</div>
              <div className="mt-1 text-base text-chalk-dim">
                {t('my_classes_description')}
              </div>
            </div>
            <Link href="/dashboard/classes" className={cn(s.btn, s.btnSm)}>{t('view_all')}</Link>
          </div>
          <div className="mt-4">
            {recentClasses.length === 0
              ? (
                  <div className="rounded-hand border border-dashed border-chalk-blue/30 px-4 py-8 text-center">
                    <div className="text-base text-chalk-dim">
                      {t('no_classes_yet')}
                    </div>
                    <div className="mt-2">
                      <Link href="/dashboard/classes" className={cn(s.btn, s.btnPrimary, s.btnSm)}>{t('join_class')}</Link>
                    </div>
                  </div>
                )
              : (
                  <div className="space-y-3">
                    {recentClasses.map((c, idx) => (
                      <Link key={c.id} href={`/dashboard/classes/${c.id}`}>
                        <div
                          className="flex items-center justify-between gap-4 rounded-hand border border-chalk-faint bg-white/2 px-4 py-3 transition-all duration-200 hover:border-chalk-yellow/30"
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-base font-medium text-chalk">{c.name}</div>
                            <div className="mt-1 text-sm text-chalk-dim">
                              <span className="font-mono">{c.classCode}</span>
                            </div>
                          </div>
                          <span className="text-sm text-chalk-dim">→</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
          </div>
        </Card>

        {/* Performance Summary */}
        <Card className="border-chalk-blue/30 p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">{t('performance_title')}</div>
          {averageScore !== null
            ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-chalk-dim">{t('average_score')}</div>
                    <div className="mt-1 text-3xl font-semibold text-chalk-blue">
                      {averageScore.toFixed(1)}
                    </div>
                  </div>
                  {highestScore !== null && (
                    <div>
                      <div className="text-sm text-chalk-dim">{t('highest_score')}</div>
                      <div className="mt-1 text-2xl font-semibold text-chalk-blue">
                        {highestScore.toFixed(1)}
                      </div>
                    </div>
                  )}
                  <Link href="/dashboard/performance" className={cn(s.btn, s.btnSm, 'w-full border-chalk-blue/30 text-chalk-blue hover:bg-chalk-blue/10')}>{t('view_details')}</Link>
                </div>
              )
            : (
                <div className="py-6 text-center text-base text-chalk-dim">
                  {t('no_scores_yet')}
                  <div className="mt-2">
                    <Link href="/dashboard/sessions" className={cn(s.btn, s.btnSm, 'border-chalk-blue/30 text-chalk-blue')}>{t('take_quiz_now')}</Link>
                  </div>
                </div>
              )}
        </Card>
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <Card className="border-chalk-blue/20 p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">
            {t('upcoming_sessions_title', { count: upcomingSessions.length })}
          </div>
          <div className="space-y-3">
            {upcomingSessions.map((attempt, idx) => (
              <Link key={attempt.id} href={`/session/${attempt.quizSession.id}`}>
                <div
                  className="flex items-center justify-between gap-4 rounded-hand border border-chalk-faint bg-white/2 px-4 py-3 transition-all duration-200 hover:border-chalk-yellow/30"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium text-chalk">
                      {attempt.quizSession.quiz.title}
                    </div>
                    <div className="mt-1 text-sm text-chalk-dim">
                      {t('created_at')}
                      {' '}
                      {formatDate(attempt.quizSession.createdAt)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="border-chalk-blue/30 text-chalk-blue">
                    {t('view_lobby')}
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Getting Started (Collapsible) */}
      <Card className="border-dashed border-chalk-blue/30 p-5 transition-all duration-300">
        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-medium text-chalk-blue transition-colors hover:text-chalk-blue">
            <div className="flex items-center justify-between">
              <span>{t('getting_started')}</span>
              <span className="text-chalk-blue transition-transform duration-200 group-open:rotate-180">▼</span>
            </div>
          </summary>
          <ol className="mt-3 space-y-1 text-sm text-chalk/85">
            <li>
              <span className="font-mono text-chalk-dim">1.</span>
              {' '}
              {t('getting_started_step1')}
              {' '}
              <span className="font-mono">{t('class_code')}</span>
              {' '}
              {t('in')}
              {' '}
              <Link href="/dashboard/classes" className="text-chalk-blue hover:underline">
                {t('classes_link')}
              </Link>
              .
            </li>
            <li>
              <span className="font-mono text-chalk-dim">2.</span>
              {' '}
              {t('getting_started_step2')}
              {' '}
              <span className="font-medium">{t('ongoing_sessions')}</span>
              {' '}
              {t('in')}
              {' '}
              <Link href="/dashboard/sessions" className="text-chalk-blue hover:underline">
                {t('my_sessions_link')}
              </Link>
              .
            </li>
            <li>
              <span className="font-mono text-chalk-dim">3.</span>
              {' '}
              {t('getting_started_step3')}
            </li>
            <li>
              <span className="font-mono text-chalk-dim">4.</span>
              {' '}
              {t('getting_started_step4')}
            </li>
          </ol>
        </details>
      </Card>
    </div>
  );
}
