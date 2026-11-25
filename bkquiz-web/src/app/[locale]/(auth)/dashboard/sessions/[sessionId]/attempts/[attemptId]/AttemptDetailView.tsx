'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { MathRenderer } from '@/components/MathRenderer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { getI18nPath } from '@/utils/Helpers';

type AttemptStatus = 'active' | 'submitted' | 'locked';
type CheckpointType = 'scheduled' | 'verify_ok' | 'verify_fail' | 'locked';

type DetailQuestion = {
  sessionQuestionId: string;
  order: number;
  type: 'mcq_single' | 'mcq_multi';
  prompt: string;
  options: Array<{ order: number; content: string; isCorrect: boolean; selected: boolean }>;
  answered: boolean;
  isFullyCorrect: boolean;
  score: number | null;
};

type AttemptDetailResponse = {
  attempt: {
    id: string;
    status: AttemptStatus;
    score: number | null;
    maxScore: number;
    attemptStartedAt: string | null;
    submittedAt: string | null;
    failedCount: number;
    lockedUntil: string | null;
  };
  user: { id: string; name: string | null; email: string | null };
  session: { id: string; status: 'lobby' | 'active' | 'ended'; title: string; classroomName: string };
  scoring: { mode: 'all_or_nothing' | 'partial' | 'penalty' };
  questions: DetailQuestion[];
  checkpoints: Array<{ type: CheckpointType; ok: boolean | null; enteredToken: string | null; dueAt: string | null; createdAt: string }>;
};

type Filter = 'all' | 'wrong' | 'unanswered';

function formatElapsed(from: string | null, to: string | null): string | null {
  if (!from || !to) {
    return null;
  }
  const diff = Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function attemptStatusVariant(status: AttemptStatus) {
  if (status === 'submitted') {
    return 'success' as const;
  }
  if (status === 'locked') {
    return 'danger' as const;
  }
  return 'info' as const;
}

function checkpointVariant(type: CheckpointType) {
  if (type === 'verify_ok') {
    return 'success' as const;
  }
  if (type === 'verify_fail') {
    return 'warning' as const;
  }
  if (type === 'locked') {
    return 'danger' as const;
  }
  return 'neutral' as const;
}

export function AttemptDetailView(props: { sessionId: string; attemptId: string }) {
  const t = useTranslations('AttemptDetail');
  const locale = useLocale();
  const [data, setData] = useState<AttemptDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/attempts/${props.attemptId}`, { method: 'GET' });
      const json = await res.json().catch(() => null) as (AttemptDetailResponse & { error?: string }) | null;
      if (!res.ok || !json) {
        setError(json?.error ?? `LOAD_FAILED_${res.status}`);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId, props.attemptId]);

  const teacherScreenHref = getI18nPath(`/dashboard/sessions/${props.sessionId}/teacher`, locale);
  const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : '-');
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale);

  const breadcrumb = (
    <nav className="text-base">
      <div className="flex flex-wrap items-center gap-2 text-chalk-dim">
        <Link href={getI18nPath('/dashboard', locale)} className="transition-colors hover:text-chalk">
          {t('breadcrumb_dashboard')}
        </Link>
        <span>·</span>
        <Link href={teacherScreenHref} className="transition-colors hover:text-chalk">
          {data?.session.title ?? t('breadcrumb_session')}
        </Link>
        <span>·</span>
        <span className="text-chalk">{t('title')}</span>
      </div>
    </nav>
  );

  if (loading && !data) {
    return (
      <div className="space-y-7">
        <Skeleton className="h-4 w-64" />
        <Card className="p-5 md:p-6">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </Card>
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-5 md:p-6">
            <Skeleton className="mb-3 h-5 w-32" />
            <Skeleton className="mb-2 h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-7">
        {breadcrumb}
        <Card className="p-5 md:p-6">
          <div className="rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-4 text-center text-chalk-pink">
            {error === 'ATTEMPT_NOT_FOUND' || error === 'SESSION_NOT_FOUND'
              ? t('not_found')
              : error === 'FORBIDDEN'
                ? t('forbidden')
                : t('error', { error: error ?? '' })}
          </div>
        </Card>
      </div>
    );
  }

  const { attempt, user, session, questions, checkpoints, scoring } = data;
  const isSubmitted = attempt.status === 'submitted';
  const fullyCorrectCount = questions.filter(q => q.isFullyCorrect).length;
  const unansweredCount = questions.filter(q => !q.answered).length;
  const wrongCount = questions.filter(q => q.answered && !q.isFullyCorrect).length;
  const failedCheckpoints = checkpoints.filter(c => c.type === 'verify_fail').length;
  const elapsed = formatElapsed(attempt.attemptStartedAt, attempt.submittedAt);

  const visibleQuestions = questions.filter((q) => {
    if (filter === 'wrong') {
      return q.answered && !q.isFullyCorrect;
    }
    if (filter === 'unanswered') {
      return !q.answered;
    }
    return true;
  });

  const filters: Array<{ key: Filter; label: string; count: number }> = [
    { key: 'all', label: t('filter_all'), count: questions.length },
    { key: 'wrong', label: t('filter_wrong'), count: wrongCount },
    { key: 'unanswered', label: t('filter_unanswered'), count: unansweredCount },
  ];

  return (
    <div className="space-y-7">
      {breadcrumb}

      {/* Thông tin sinh viên + tổng quan */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-script text-2xl leading-tight font-bold chalk-glow text-chalk md:text-[1.85rem]">
              {user.name || user.email || user.id}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-chalk-dim">
              {user.email && user.name ? <span>{user.email}</span> : null}
              {user.email && user.name ? <span>·</span> : null}
              <span>{session.title}</span>
              <span>·</span>
              <span>{session.classroomName}</span>
              <span>·</span>
              <Badge variant={attemptStatusVariant(attempt.status)}>{t(`status_${attempt.status}`)}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              {t('refresh')}
            </Button>
            <Link href={teacherScreenHref} className={cn(s.btn, s.btnSm)}>{t('back')}</Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-hand border border-chalk-faint p-3">
            <div className="text-sm text-chalk-dim">{t('score')}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-chalk">
              {isSubmitted && attempt.score !== null ? `${attempt.score} / ${attempt.maxScore}` : '-'}
            </div>
            <div className="mt-1 text-sm text-chalk-dim">{t(`scoring_${scoring.mode}`)}</div>
          </div>
          <div className="rounded-hand border border-chalk-faint p-3">
            <div className="text-sm text-chalk-dim">{t('fully_correct')}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-chalk">
              {fullyCorrectCount}
              {' / '}
              {questions.length}
            </div>
            <div className="mt-1 text-sm text-chalk-dim">{t('unanswered_count', { count: unansweredCount })}</div>
          </div>
          <div className="rounded-hand border border-chalk-faint p-3">
            <div className="text-sm text-chalk-dim">{t('time_taken')}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-chalk">{elapsed ?? '-'}</div>
            <div className="mt-1 text-sm text-chalk-dim">
              {t('started_at', { time: formatDateTime(attempt.attemptStartedAt) })}
              <br />
              {t('submitted_at', { time: formatDateTime(attempt.submittedAt) })}
            </div>
          </div>
          <div className="rounded-hand border border-chalk-faint p-3">
            <div className="text-sm text-chalk-dim">{t('token_failures')}</div>
            <div className="mt-1 font-mono text-xl font-semibold text-chalk">{failedCheckpoints}</div>
            <div className="mt-1 text-sm text-chalk-dim">
              {attempt.lockedUntil
                ? t('locked_until', { time: formatDateTime(attempt.lockedUntil) })
                : t('checkpoint_count', { count: checkpoints.length })}
            </div>
          </div>
        </div>

        {!isSubmitted
          ? (
              <div className="mt-4 rounded-hand border border-chalk-yellow/40 bg-chalk-yellow/10 p-3 text-base text-chalk-yellow">
                {t('not_submitted_note')}
              </div>
            )
          : null}
      </Card>

      {/* Danh sách câu */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-chalk">{t('questions_heading')}</h2>
          <div className="flex flex-wrap gap-2">
            {filters.map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'primary' : 'ghost'}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
                {' '}
                (
                {f.count}
                )
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm text-chalk-dim">
          <span className="text-chalk-green">{t('legend_correct_selected')}</span>
          <span className="text-chalk-pink">{t('legend_wrong_selected')}</span>
          <span className="text-chalk-green">{t('legend_missed')}</span>
        </div>

        <div className="mt-4 space-y-3">
          {visibleQuestions.length === 0
            ? (
                <div className="rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center text-base text-chalk-dim">
                  {t('no_questions_in_filter')}
                </div>
              )
            : visibleQuestions.map((q) => {
                const statusBadge = !q.answered
                  ? <Badge variant="neutral">{t('q_unanswered')}</Badge>
                  : q.isFullyCorrect
                    ? <Badge variant="success">{t('q_correct')}</Badge>
                    : <Badge variant="danger">{t('q_wrong')}</Badge>;
                return (
                  <Card key={q.sessionQuestionId} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-base text-chalk-dim">
                        <span className="font-mono">{t('question_number', { current: q.order, total: questions.length })}</span>
                        <span>·</span>
                        <Badge variant="neutral" className="text-sm">
                          {q.type === 'mcq_single' ? t('single_choice') : t('multiple_choice')}
                        </Badge>
                        {statusBadge}
                      </div>
                      <div className="shrink-0 font-mono text-base text-chalk">
                        {q.score !== null ? t('question_score', { score: q.score }) : '-'}
                      </div>
                    </div>

                    <div className="mt-2 text-base text-chalk/85">
                      <MathRenderer content={q.prompt} className="font-sans" />
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {q.options.map((o, idx) => {
                        const label = String.fromCharCode(65 + idx);
                        let cls = 'border-chalk-dim text-chalk/85';
                        let mark = '';
                        if (o.selected && o.isCorrect) {
                          cls = 'border-chalk-green/60 bg-chalk-green/10 text-chalk-green';
                          mark = '✓';
                        } else if (o.selected && !o.isCorrect) {
                          cls = 'border-chalk-pink/60 bg-chalk-pink/10 text-chalk-pink';
                          mark = '✗';
                        } else if (!o.selected && o.isCorrect) {
                          cls = 'border-dashed border-chalk-green/60 text-chalk-green';
                        }
                        return (
                          <div
                            key={`${q.sessionQuestionId}-${o.order}`}
                            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-base ${cls}`}
                          >
                            <span className="w-5 shrink-0 font-mono">
                              {label}
                              .
                            </span>
                            <div className="min-w-0 flex-1">
                              <MathRenderer content={o.content} className="font-sans" />
                            </div>
                            <span className="w-4 shrink-0 text-right font-semibold">{mark}</span>
                            {o.isCorrect
                              ? <span className="shrink-0 text-sm">{t('correct_answer')}</span>
                              : null}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
        </div>
      </Card>

      {/* Nhật ký checkpoint */}
      <Card className="p-5 md:p-6">
        <h2 className="text-lg font-semibold text-chalk">{t('checkpoints_heading')}</h2>
        {checkpoints.length === 0
          ? <div className="mt-3 text-base text-chalk-dim">{t('no_checkpoints')}</div>
          : (
              <ol className="mt-3 space-y-2 border-l border-chalk-faint pl-4">
                {checkpoints.map((c, i) => (
                  <li key={`${c.createdAt}-${i}`} className="flex flex-wrap items-center gap-2 text-base">
                    <span className="font-mono text-chalk-dim">{formatTime(c.createdAt)}</span>
                    <Badge variant={checkpointVariant(c.type)}>{t(`checkpoint_${c.type}`)}</Badge>
                    {c.enteredToken
                      ? (
                          <span className="text-chalk-dim">
                            {t('entered_token')}
                            {' '}
                            <span className="font-mono text-chalk/85">{c.enteredToken}</span>
                          </span>
                        )
                      : null}
                    {c.dueAt && c.type === 'scheduled'
                      ? <span className="text-chalk-dim">{t('due_at', { time: formatTime(c.dueAt) })}</span>
                      : null}
                  </li>
                ))}
              </ol>
            )}
      </Card>
    </div>
  );
}
