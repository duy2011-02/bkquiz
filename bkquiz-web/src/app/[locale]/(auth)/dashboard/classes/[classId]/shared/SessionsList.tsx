'use client';

import type { Session } from '../types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

type SessionsListProps = {
  sessions: Session[];
  isStudent: boolean;
  onCreateSession?: () => void;
};

function formatDuration(seconds: number | null | undefined, t: ReturnType<typeof useTranslations<'Classes.detail'>>): string {
  if (!seconds) {
    return t('unlimited');
  }
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return t('minutes_short', { count: Math.floor(seconds / 60) });
}

function formatDateShort(dateString: string, locale: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function SessionsList(props: SessionsListProps) {
  const { sessions, isStudent, onCreateSession } = props;
  const t = useTranslations('Classes.detail');
  const locale = useLocale();

  if (sessions.length === 0) {
    return (
      <div className="py-8 text-center text-base text-chalk-dim">
        {t('no_sessions_yet')}
        {onCreateSession && (
          <div className="mt-2">
            <Button
              variant="primary"
              size="sm"
              className=""
              onClick={onCreateSession}
            >
              {t('create_first_session')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {onCreateSession && sessions.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-medium text-chalk">
            {t('sessions_count', { count: sessions.length })}
          </div>
          <Button
            variant="primary"
            size="sm"
            className=""
            onClick={onCreateSession}
          >
            {t('create_session_plus')}
          </Button>
        </div>
      )}
      {sessions.map((s, idx) => {
        if (isStudent) {
          // Determine link: if ended and has attempt, go to review; otherwise go to session lobby
          const linkHref = (s.status === 'ended' && s.attempt)
            ? `/attempt/${s.attempt.id}`
            : `/session/${s.id}`;

          return (
            <Link key={s.id} href={linkHref}>
              <div
                className={`rounded-md border bg-white/2 transition-all duration-200   ${
                  s.status === 'active'
                    ? 'border-chalk-blue/50 bg-chalk-blue/5 hover:border-chalk-blue/70'
                    : s.status === 'ended' && s.attempt
                      ? 'border-chalk-yellow/50 bg-chalk-yellow/5 hover:border-chalk-yellow/70'
                      : 'border-chalk-blue/30 hover:border-chalk-blue/50'
                }`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-medium text-chalk">
                      {s.sessionName || s.quiz.title}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <div className="text-sm text-chalk-dim">
                        {s.status === 'active' && t('session_in_progress')}
                        {s.status === 'ended' && s.attempt && t('review_attempt')}
                        {s.status === 'ended' && !s.attempt && t('session_ended')}
                        {s.status === 'lobby' && t('session_waiting')}
                        {s.durationSeconds && (
                          <>
                            {' '}
                            ·
                            {' '}
                            ⏱️
                            {' '}
                            {
                              formatDuration(s.durationSeconds, t)
                            }
                          </>
                        )}
                      </div>
                      {((s.startedAt || s.scheduledStartAt) || s.endedAt) && (
                        <div className="text-sm text-chalk-dim">
                          {(s.startedAt || s.scheduledStartAt) && (
                            <>
                              {s.status === 'lobby' ? t('starts_at') : t('started_at')}
                              {' '}
                              {formatDateShort(s.startedAt || s.scheduledStartAt!, locale)}
                            </>
                          )}
                          {s.endedAt && s.status === 'ended' && (
                            <>
                              {(s.startedAt || s.scheduledStartAt) && ' · '}
                              {t('ended_at')}
                              {' '}
                              {formatDateShort(s.endedAt, locale)}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Score display for ended sessions with attempt - centered */}
                  {s.status === 'ended' && s.attempt && s.attempt.score !== null && (
                    <div className="flex items-center gap-2 rounded-hand border border-chalk-yellow/30 bg-chalk-yellow/10 px-4 py-2">
                      <div className="text-base font-medium text-chalk-dim">
                        {t('score')}
                      </div>
                      <div className="text-2xl font-bold text-chalk-yellow tabular-nums">
                        {s.attempt.score.toFixed(1)}
                      </div>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge
                      variant={s.status === 'active' ? 'success' : (s.status === 'ended' ? 'neutral' : 'info')}
                      className="text-sm"
                    >
                      {t(`status_${s.status}`)}
                    </Badge>
                    <span className="text-sm text-chalk-dim">→</span>
                  </div>
                </div>
              </div>
            </Link>
          );
        }

        // Teacher view
        return (
          <div
            key={s.id}
            className="rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <Link href={`/dashboard/sessions/${s.id}/teacher`} className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto_auto] items-center gap-4 md:grid-cols-[2fr_auto_120px_100px]">
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-chalk">
                    {s.sessionName || s.quiz.title}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div className="text-sm text-chalk-dim">
                      👥
                      {' '}
                      {t('attempts_count', { count: s.attemptCount })}
                      {s.durationSeconds && (
                        <>
                          {' '}
                          ·
                          {' '}
                          ⏱️
                          {' '}
                          {
                            formatDuration(s.durationSeconds, t)
                          }
                        </>
                      )}
                    </div>
                    {((s.startedAt || s.scheduledStartAt) || s.endedAt) && (
                      <div className="text-sm text-chalk-dim">
                        {(s.startedAt || s.scheduledStartAt) && (
                          <>
                            {s.status === 'lobby' ? t('starts_at') : t('started_at')}
                            {' '}
                            {formatDateShort(s.startedAt || s.scheduledStartAt!, locale)}
                          </>
                        )}
                        {s.endedAt && s.status === 'ended' && (
                          <>
                            {(s.startedAt || s.scheduledStartAt) && ' · '}
                            {t('ended_at')}
                            {' '}
                            {formatDateShort(s.endedAt, locale)}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Badge
                  variant={s.status === 'active' ? 'success' : (s.status === 'ended' ? 'neutral' : 'info')}
                  className="text-sm"
                >
                  {t(`status_${s.status}`)}
                </Badge>
                <div className="text-sm text-chalk-dim">
                  {s.status === 'lobby' || s.status === 'ended' ? '' : <span className="font-mono">-</span>}
                </div>
                <div className="text-sm text-chalk-dim">
                  <span>-</span>
                </div>
              </Link>
              <div className="flex items-center gap-2">
                {(s.status === 'lobby' || s.status === 'ended') && (
                  <Link
                    href={`/dashboard/sessions/${s.id}/questions`}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <Button variant="ghost" size="sm" className="">
                      {t('view_questions')}
                    </Button>
                  </Link>
                )}
                <Link href={`/dashboard/sessions/${s.id}/teacher`}>
                  <span className="text-sm text-chalk-dim">→</span>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
      {isStudent && sessions.length > 0 && (
        <div className="mt-4 border-t border-chalk-faint pt-4">
          <Link href="/dashboard/sessions" className={cn(s.btn, s.btnSm, 'w-full')}>{t('view_all_my_sessions')}</Link>
        </div>
      )}
    </div>
  );
}
