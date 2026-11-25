'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';

type Session = {
  id: string;
  status: 'lobby' | 'active' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  quiz: {
    id: string;
    title: string;
  };
  attempt?: {
    id: string;
    status: string;
    submittedAt: string | null;
    score: number | null;
    createdAt: string;
  };
  attemptCount?: number;
  sessionName?: string | null;
  durationSeconds?: number | null;
  scheduledStartAt?: string | null;
  classroom?: {
    id: string;
    name: string;
    classCode: string;
  } | null;
};

export function SessionsPanel() {
  const t = useTranslations('Sessions');
  const locale = useLocale();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch('/api/sessions');
        if (!res.ok) {
          throw new Error('Failed to load sessions');
        }
        const data = await res.json();
        setSessions(data.sessions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  function formatDateShort(dateStr: string | null) {
    if (!dateStr) {
      return '—';
    }
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  function formatDuration(seconds: number | null | undefined): string {
    if (!seconds) {
      return '';
    }
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${Math.floor(seconds / 60)} ${t('minutes')}`;
  }

  const activeSessions = sessions.filter(s => s.status === 'active');
  const pastSessions = sessions.filter(s => s.status === 'ended');
  const lobbySessions = sessions.filter(s => s.status === 'lobby');

  // Group past sessions by classroom
  const pastSessionsByClass = useMemo(() => {
    const grouped = new Map<string | null, Session[]>();
    for (const session of pastSessions) {
      const classId = session.classroom?.id || null;
      if (!grouped.has(classId)) {
        grouped.set(classId, []);
      }
      grouped.get(classId)!.push(session);
    }
    return grouped;
  }, [pastSessions]);

  if (loading) {
    return (
      <div className="space-y-7">
        <Card className="p-6">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </Card>
        <Card className="p-6">
          <Skeleton className="mb-4 h-6 w-32" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-base text-chalk-dim">{t('error')}</div>
        <div className="mt-2 text-chalk/85">{error}</div>
      </Card>
    );
  }

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <nav className="text-base">
        <div className="flex items-center gap-2 text-chalk-dim">
          <Link href="/dashboard" className="transition-colors hover:text-chalk">
            {t('breadcrumb_dashboard')}
          </Link>
          <span>·</span>
          <span className="text-chalk">{t('title')}</span>
        </div>
      </nav>

      {/* Header */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-base text-chalk-dim">{t('bkquiz_sessions')}</div>
            <h1 className="mt-1 font-script text-2xl leading-tight font-bold chalk-glow text-chalk md:text-[1.85rem]">
              {t('title')}
            </h1>
            <div className="mt-2 text-base text-chalk-dim">
              {t('view_and_manage_description')}
            </div>
          </div>
        </div>
      </Card>

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <Card className="p-5 md:p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">
            {t('ongoing', { count: activeSessions.length })}
          </div>
          <div className="space-y-3">
            {activeSessions.map((session, idx) => (
              <Link key={session.id} href={session.attempt ? `/attempt/${session.attempt.id}` : `/session/${session.id}`}>
                <div
                  className="cursor-pointer rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-medium text-chalk">
                        {session.sessionName || session.quiz.title}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="text-sm text-chalk-dim">
                          {session.status === 'active' && t('status_active')}
                          {session.durationSeconds && (
                            <>
                              {' '}
                              ·
                              {' '}
                              ⏱️
                              {' '}
                              {formatDuration(session.durationSeconds)}
                            </>
                          )}
                        </div>
                        {((session.startedAt || session.scheduledStartAt) || session.endedAt) && (
                          <div className="text-sm text-chalk-dim">
                            {(session.startedAt || session.scheduledStartAt) && (
                              <>
                                {session.status === 'lobby' ? t('start_time') : t('started')}
                                {' '}
                                {formatDateShort(session.startedAt || session.scheduledStartAt!)}
                              </>
                            )}
                            {session.endedAt && session.status === 'ended' && (
                              <>
                                {(session.startedAt || session.scheduledStartAt) && ' · '}
                                {t('end_time')}
                                {' '}
                                {formatDateShort(session.endedAt)}
                              </>
                            )}
                          </div>
                        )}
                        {session.classroom && (
                          <div className="text-sm text-chalk-dim">
                            📚
                            {' '}
                            {session.classroom.name}
                            {' '}
                            (
                            {session.classroom.classCode}
                            )
                          </div>
                        )}
                        {session.attempt && (
                          <div className="text-sm text-chalk-dim">
                            Attempt:
                            {' '}
                            {session.attempt.status}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge
                        variant={session.status === 'active' ? 'success' : (session.status === 'ended' ? 'neutral' : 'info')}
                        className="text-sm"
                      >
                        {session.status}
                      </Badge>
                      <span className="text-sm text-chalk-dim">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Lobby Sessions */}
      {lobbySessions.length > 0 && (
        <Card className="p-5 md:p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">
            {t('waiting_to_start', { count: lobbySessions.length })}
          </div>
          <div className="space-y-3">
            {lobbySessions.map((session, idx) => (
              <Link key={session.id} href={`/session/${session.id}`}>
                <div
                  className="cursor-pointer rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  <div className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-medium text-chalk">
                        {session.sessionName || session.quiz.title}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <div className="text-sm text-chalk-dim">
                          {session.status === 'lobby' && t('status_lobby')}
                          {session.durationSeconds && (
                            <>
                              {' '}
                              ·
                              {' '}
                              ⏱️
                              {' '}
                              {formatDuration(session.durationSeconds)}
                            </>
                          )}
                        </div>
                        {((session.startedAt || session.scheduledStartAt) || session.endedAt) && (
                          <div className="text-sm text-chalk-dim">
                            {(session.startedAt || session.scheduledStartAt) && (
                              <>
                                {session.status === 'lobby' ? t('start_time') : t('started')}
                                {' '}
                                {formatDateShort(session.startedAt || session.scheduledStartAt!)}
                              </>
                            )}
                            {session.endedAt && session.status === 'ended' && (
                              <>
                                {(session.startedAt || session.scheduledStartAt) && ' · '}
                                {t('end_time')}
                                {' '}
                                {formatDateShort(session.endedAt)}
                              </>
                            )}
                          </div>
                        )}
                        {session.classroom && (
                          <div className="text-sm text-chalk-dim">
                            📚
                            {' '}
                            {session.classroom.name}
                            {' '}
                            (
                            {session.classroom.classCode}
                            )
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge
                        variant={session.status === 'active' ? 'success' : (session.status === 'ended' ? 'neutral' : 'info')}
                        className="text-sm"
                      >
                        {session.status}
                      </Badge>
                      <span className="text-sm text-chalk-dim">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Past Sessions - Grouped by Class */}
      {pastSessions.length > 0 && (
        <Card className="p-5 md:p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">
            {t('ended', { count: pastSessions.length })}
          </div>
          <div className="space-y-6">
            {Array.from(pastSessionsByClass.entries()).map(([classId, classSessions], groupIdx) => {
              const classroom = classSessions[0]?.classroom;
              return (
                <div key={classId || 'no-class'} className="space-y-3">
                  {/* Class Header */}
                  {classroom
                    ? (
                        <div className="flex items-center gap-2 border-b border-chalk-faint pb-2">
                          <Link
                            href={`/dashboard/classes/${classroom.id}`}
                            className="cursor-pointer text-base font-semibold text-chalk transition-colors hover:text-chalk-yellow"
                          >
                            📚
                            {' '}
                            {classroom.name}
                          </Link>
                          <Badge variant="neutral" className="text-sm">
                            {classSessions.length}
                            {' '}
                            {classSessions.length > 1 ? t('sessions') : t('session')}
                          </Badge>
                        </div>
                      )
                    : (
                        <div className="flex items-center gap-2 border-b border-chalk-faint pb-2">
                          <span className="text-base font-semibold text-chalk-dim">
                            {t('other')}
                          </span>
                          <Badge variant="neutral" className="text-sm">
                            {classSessions.length}
                            {' '}
                            {classSessions.length > 1 ? t('sessions') : t('session')}
                          </Badge>
                        </div>
                      )}
                  {/* Sessions in this class */}
                  <div className="space-y-3 pl-4">
                    {classSessions.map((session, idx) => (
                      <Link
                        key={session.id}
                        href={session.attempt ? `/attempt/${session.attempt.id}` : `/session/${session.id}`}
                      >
                        <div
                          className="cursor-pointer rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
                          style={{ animationDelay: `${(groupIdx * 100) + (idx * 30)}ms` }}
                        >
                          <div className="flex items-center justify-between gap-4 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-base font-medium text-chalk">
                                {session.sessionName || session.quiz.title}
                              </div>
                              <div className="mt-1 space-y-0.5">
                                <div className="text-sm text-chalk-dim">
                                  {session.status === 'ended' && t('status_ended')}
                                  {session.durationSeconds && (
                                    <>
                                      {' '}
                                      ·
                                      {' '}
                                      ⏱️
                                      {' '}
                                      {formatDuration(session.durationSeconds)}
                                    </>
                                  )}
                                </div>
                                {((session.startedAt || session.scheduledStartAt) || session.endedAt) && (
                                  <div className="text-sm text-chalk-dim">
                                    {(session.startedAt || session.scheduledStartAt) && (
                                      <>
                                        {t('started')}
                                        {' '}
                                        {formatDateShort(session.startedAt || session.scheduledStartAt!)}
                                      </>
                                    )}
                                    {session.endedAt && session.status === 'ended' && (
                                      <>
                                        {(session.startedAt || session.scheduledStartAt) && ' · '}
                                        {t('end_time')}
                                        {' '}
                                        {formatDateShort(session.endedAt)}
                                      </>
                                    )}
                                  </div>
                                )}
                                {session.classroom && (
                                  <div className="text-sm text-chalk-dim">
                                    📚
                                    {' '}
                                    {session.classroom.name}
                                    {' '}
                                    (
                                    {session.classroom.classCode}
                                    )
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Score display for ended sessions with attempt - centered */}
                            {session.attempt && session.attempt.score !== null && (
                              <div className="flex items-center gap-2 rounded-hand border border-chalk-yellow/30 bg-chalk-yellow/10 px-4 py-2">
                                <div className="text-base font-medium text-chalk-dim">
                                  {t('score')}
                                </div>
                                <div className="text-2xl font-bold text-chalk-yellow tabular-nums">
                                  {session.attempt.score.toFixed(1)}
                                </div>
                              </div>
                            )}
                            <div className="flex shrink-0 items-center gap-3">
                              <Badge
                                variant={session.status === 'active' ? 'success' : (session.status === 'ended' ? 'neutral' : 'info')}
                                className="text-sm"
                              >
                                {session.status}
                              </Badge>
                              <span className="text-sm text-chalk-dim">→</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {sessions.length === 0 && (
        <Card className="p-5 md:p-6">
          <div className="rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center">
            <div className="text-base text-chalk-dim">
              {t('no_sessions')}
            </div>
            <div className="mt-2 text-sm text-chalk-dim">
              {t('join_class_hint')}
            </div>
            <div className="mt-4">
              <Link href="/dashboard/classes" className={cn(s.btn, s.btnPrimary, s.btnSm)}>{t('join_class')}</Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
