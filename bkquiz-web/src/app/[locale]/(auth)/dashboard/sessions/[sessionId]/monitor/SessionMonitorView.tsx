'use client';

import type { LiveStatus } from '@/server/liveStatus';
import type { SuspicionFlag } from '@/server/suspicion';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableWrap } from '@/components/ui/Table';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { formatGrade } from '@/utils/formatGrade';
import { getI18nPath } from '@/utils/Helpers';

// Giữ đồng bộ với src/server/liveStatus.ts (không import giá trị từ server vào client)
const STATUS_ORDER: LiveStatus[] = [
  'locked',
  'offline',
  'cooldown',
  'checkpoint_due',
  'time_up',
  'working',
  'not_started',
  'not_joined',
  'submitted',
];
const POLL_MS = 3000;
const EXTEND_OPTIONS_MINUTES = [5, 10, 15];

type Student = {
  userId: string;
  name: string | null;
  email: string | null;
  attemptId: string | null;
  liveStatus: LiveStatus;
  answeredCount: number;
  assignedCount: number;
  failedCount: number;
  lockedUntil: string | null;
  cooldownUntil: string | null;
  timeRemaining: number | null;
  extraSeconds: number;
  lastSeenAt: string | null;
  attemptStartedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  /** Điểm thang 10 */
  grade: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  canUnlock: boolean;
  flags: SuspicionFlag[];
};

type MonitorResponse = {
  serverTime: string;
  session: {
    id: string;
    status: 'lobby' | 'active' | 'ended';
    title: string;
    classroomName: string;
    hasTimeLimit: boolean;
    maxExtraSeconds: number;
  };
  summary: Record<LiveStatus, number>;
  flaggedCount: number;
  students: Student[];
};

type PendingAction = { kind: 'extend' | 'submit'; student: Student } | null;

function statusVariant(status: LiveStatus) {
  switch (status) {
    case 'locked':
      return 'danger' as const;
    case 'offline':
    case 'cooldown':
    case 'checkpoint_due':
    case 'time_up':
      return 'warning' as const;
    case 'working':
      return 'info' as const;
    case 'submitted':
      return 'success' as const;
    default:
      return 'neutral' as const;
  }
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function SessionMonitorView(props: { sessionId: string }) {
  const t = useTranslations('SessionMonitor');
  const locale = useLocale();
  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<LiveStatus | 'all' | 'flagged'>('all');
  const [pending, setPending] = useState<PendingAction>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/monitor`, { cache: 'no-store' });
      const json = await res.json().catch(() => null) as (MonitorResponse & { error?: string }) | null;
      if (!res.ok || !json) {
        setLoadError(json?.error ?? `LOAD_FAILED_${res.status}`);
        return;
      }
      setLoadError(null);
      setData(json);
    } catch {
      setLoadError('NETWORK_ERROR');
    } finally {
      inFlight.current = false;
    }
  }, [props.sessionId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  function actionErrorMessage(code: string | undefined, extra?: { retryAfterSeconds?: number }) {
    switch (code) {
      case 'NOT_LOCKED':
      case 'EXTENSION_LIMIT':
      case 'ATTEMPT_CHANGED':
      case 'SESSION_NOT_ACTIVE':
      case 'ATTEMPT_ALREADY_SUBMITTED':
      case 'ATTEMPT_NOT_STARTED':
      case 'NO_TIME_LIMIT':
        return t(`error_${code}`);
      case 'RATE_LIMITED':
        return t('error_RATE_LIMITED', { seconds: extra?.retryAfterSeconds ?? 60 });
      default:
        return t('error_generic', { error: code ?? '' });
    }
  }

  async function runAction(student: Student, body: { action: 'unlock' } | { action: 'submit' } | { action: 'extend'; minutes: number }) {
    if (!student.attemptId) {
      return;
    }
    setBusyId(student.attemptId);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/attempts/${student.attemptId}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null) as { error?: string; retryAfterSeconds?: number; grade?: number | null } | null;
      if (!res.ok) {
        setToast({ message: actionErrorMessage(json?.error, json ?? undefined), type: 'error' });
        return;
      }
      const name = student.name || student.email || '';
      const message = body.action === 'unlock'
        ? t('done_unlock', { name })
        : body.action === 'extend'
          ? t('done_extend', { name, minutes: body.minutes })
          : t('done_submit', { name, score: formatGrade(json?.grade ?? 0) });
      setToast({ message, type: 'success' });
      setPending(null);
      await load();
    } catch {
      setToast({ message: t('error_generic', { error: 'NETWORK_ERROR' }), type: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  const teacherScreenHref = getI18nPath(`/dashboard/sessions/${props.sessionId}/teacher`, locale);

  const breadcrumb = (
    <nav aria-label={t('breadcrumb_dashboard')} className="flex flex-wrap items-center gap-2 text-base text-chalk-dim">
      <Link href={getI18nPath('/dashboard', locale)} className="transition-colors hover:text-chalk">
        {t('breadcrumb_dashboard')}
      </Link>
      <span aria-hidden="true">/</span>
      <Link href={teacherScreenHref} className="transition-colors hover:text-chalk">
        {data?.session.title ?? t('breadcrumb_session')}
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-chalk">{t('title')}</span>
    </nav>
  );

  if (!data) {
    return (
      <div className="space-y-7">
        {breadcrumb}
        {loadError
          ? (
              <div className={cn(s.note, s.pink)} role="alert">
                {loadError === 'FORBIDDEN' ? t('forbidden') : loadError === 'SESSION_NOT_FOUND' ? t('not_found') : t('error_generic', { error: loadError })}
              </div>
            )
          : (
              <Card className="space-y-3 p-5 md:p-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </Card>
            )}
      </div>
    );
  }

  const { session, summary, students } = data;
  const serverNow = new Date(data.serverTime).getTime();
  const visible = filter === 'all'
    ? students
    : filter === 'flagged'
      ? students.filter(st => st.flags.length > 0)
      : students.filter(st => st.liveStatus === filter);
  const needAttention = summary.locked + summary.offline;

  function lastSeenText(st: Student) {
    if (!st.lastSeenAt) {
      return '-';
    }
    const seconds = Math.max(0, Math.round((serverNow - new Date(st.lastSeenAt).getTime()) / 1000));
    return seconds < 60 ? t('seconds_ago', { seconds }) : t('minutes_ago', { minutes: Math.floor(seconds / 60) });
  }

  function remainingText(st: Student) {
    if (st.liveStatus === 'submitted' || st.liveStatus === 'not_joined' || st.timeRemaining === null) {
      return '-';
    }
    return formatClock(st.timeRemaining);
  }

  const canExtend = (st: Student) =>
    session.status === 'active' && session.hasTimeLimit && !!st.attemptStartedAt && st.liveStatus !== 'submitted';
  const canSubmit = (st: Student) => !!st.attemptStartedAt && st.liveStatus !== 'submitted';

  return (
    <div className="space-y-7">
      {breadcrumb}

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[14rem] flex-1">
            <h1 className={cn(s.title, s.chalk, 'whitespace-normal')}>{t('title')}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-chalk-dim">
              <span className="text-chalk">{session.title}</span>
              <span aria-hidden="true">·</span>
              <span>{session.classroomName}</span>
              <Badge variant={session.status === 'active' ? 'success' : session.status === 'ended' ? 'neutral' : 'info'}>
                {t(`session_${session.status}`)}
              </Badge>
            </div>
            <p className="mt-2 text-base text-chalk-dim">
              {t('updated_at', { time: new Date(data.serverTime).toLocaleTimeString(locale) })}
              {loadError ? <span className="ml-2 text-chalk-pink">{t('stale', { error: loadError })}</span> : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={getI18nPath(`/dashboard/sessions/${props.sessionId}/stats`, locale)} className={cn(s.btn, s.btnSm)}>{t('open_stats')}</Link>
            <Link href={teacherScreenHref} className={cn(s.btn, s.btnSm)}>{t('back_to_screen')}</Link>
          </div>
        </div>

        {needAttention > 0
          ? (
              <div className={cn(s.note, s.yellow, 'mt-4')} role="status">
                {t('attention', { locked: summary.locked, offline: summary.offline })}
              </div>
            )
          : null}

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t('filter_label')}>
          <Button size="sm" variant={filter === 'all' ? 'primary' : 'ghost'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            {t('filter_all', { count: students.length })}
          </Button>
          {data.flaggedCount > 0
            ? (
                <Button size="sm" variant={filter === 'flagged' ? 'primary' : 'ghost'} aria-pressed={filter === 'flagged'} onClick={() => setFilter('flagged')}>
                  {t('filter_flagged')}
                  {' '}
                  <span className="font-mono">{data.flaggedCount}</span>
                </Button>
              )
            : null}
          {STATUS_ORDER.filter(st => summary[st] > 0).map(st => (
            <Button key={st} size="sm" variant={filter === st ? 'primary' : 'ghost'} aria-pressed={filter === st} onClick={() => setFilter(st)}>
              {t(`status_${st}`)}
              {' '}
              <span className="font-mono">{summary[st]}</span>
            </Button>
          ))}
        </div>
      </Card>

      <Card variant="plain" className="p-4 md:p-5">
        {visible.length === 0
          ? <div className={cn(s.note, s.dim)}>{filter === 'all' ? t('empty') : t('empty_filter')}</div>
          : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <th scope="col">{t('col_student')}</th>
                      <th scope="col">{t('col_status')}</th>
                      <th scope="col">{t('col_progress')}</th>
                      <th scope="col">{t('col_remaining')}</th>
                      <th scope="col">{t('col_token_fails')}</th>
                      <th scope="col">{t('col_last_seen')}</th>
                      <th scope="col">{t('col_flags')}</th>
                      <th scope="col">{t('col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(st => (
                      <tr key={st.userId}>
                        <td>
                          <div className="text-chalk">{st.name || st.email || st.userId}</div>
                          {st.name && st.email ? <div className="text-sm text-chalk-dim">{st.email}</div> : null}
                        </td>
                        <td>
                          <Badge variant={statusVariant(st.liveStatus)}>{t(`status_${st.liveStatus}`)}</Badge>
                          {st.liveStatus === 'submitted' && st.grade !== null
                            ? <div className="mt-1 font-mono text-sm text-chalk-dim">{t('score', { score: formatGrade(st.grade), correct: st.correctCount ?? 0, total: st.totalQuestions ?? 0 })}</div>
                            : null}
                        </td>
                        <td className="font-mono whitespace-nowrap">
                          {st.attemptId ? `${st.answeredCount}/${st.assignedCount}` : '-'}
                        </td>
                        <td className="font-mono whitespace-nowrap">
                          {remainingText(st)}
                          {st.extraSeconds > 0
                            ? <div className="text-sm text-chalk-yellow">{t('extra', { minutes: Math.round(st.extraSeconds / 60) })}</div>
                            : null}
                        </td>
                        <td className="font-mono">{st.attemptId ? st.failedCount : '-'}</td>
                        <td className="whitespace-nowrap">{lastSeenText(st)}</td>
                        <td>
                          {st.flags.length > 0
                            ? (
                                <div className="flex flex-wrap gap-1">
                                  {st.flags.map(f => (
                                    <Badge key={f.code} variant={f.severity === 'high' ? 'danger' : 'warning'} title={t(`flag_severity_${f.severity}`)}>
                                      {t(`flag_short_${f.code}`)}
                                    </Badge>
                                  ))}
                                </div>
                              )
                            : <span className="text-chalk-dim">-</span>}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            {st.canUnlock
                              ? (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    loading={busyId === st.attemptId}
                                    onClick={() => void runAction(st, { action: 'unlock' })}
                                  >
                                    {t('action_unlock')}
                                  </Button>
                                )
                              : null}
                            {canExtend(st)
                              ? (
                                  <Button size="sm" disabled={busyId === st.attemptId} onClick={() => setPending({ kind: 'extend', student: st })}>
                                    {t('action_extend')}
                                  </Button>
                                )
                              : null}
                            {canSubmit(st)
                              ? (
                                  <Button size="sm" variant="danger" disabled={busyId === st.attemptId} onClick={() => setPending({ kind: 'submit', student: st })}>
                                    {t('action_submit')}
                                  </Button>
                                )
                              : null}
                            {st.attemptId
                              ? (
                                  <Link
                                    href={getI18nPath(`/dashboard/sessions/${props.sessionId}/attempts/${st.attemptId}`, locale)}
                                    target="_blank"
                                    className={cn(s.btn, s.btnSm)}
                                  >
                                    {t('action_view')}
                                  </Link>
                                )
                              : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
      </Card>

      <Modal
        open={pending?.kind === 'extend'}
        onClose={() => setPending(null)}
        title={t('extend_title', { name: pending?.student.name || pending?.student.email || '' })}
        size="sm"
        footer={(
          <Button onClick={() => setPending(null)}>{t('cancel')}</Button>
        )}
      >
        <p className={s.modalText}>
          {t('extend_body', {
            current: Math.round((pending?.student.extraSeconds ?? 0) / 60),
            max: Math.round(session.maxExtraSeconds / 60),
          })}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXTEND_OPTIONS_MINUTES.map((m, i) => (
            <Button
              key={m}
              variant="primary"
              data-autofocus={i === 0 ? true : undefined}
              disabled={!pending || (pending.student.extraSeconds + m * 60 > session.maxExtraSeconds)}
              loading={!!pending && busyId === pending.student.attemptId}
              onClick={() => pending && void runAction(pending.student, { action: 'extend', minutes: m })}
            >
              {t('extend_minutes', { minutes: m })}
            </Button>
          ))}
        </div>
      </Modal>

      <Modal
        open={pending?.kind === 'submit'}
        onClose={() => setPending(null)}
        title={t('submit_title', { name: pending?.student.name || pending?.student.email || '' })}
        size="sm"
        footer={(
          <>
            <Button data-autofocus onClick={() => setPending(null)}>{t('cancel')}</Button>
            <Button
              variant="danger"
              loading={!!pending && busyId === pending.student.attemptId}
              onClick={() => pending && void runAction(pending.student, { action: 'submit' })}
            >
              {t('submit_confirm')}
            </Button>
          </>
        )}
      >
        <p className={s.modalText}>
          {t('submit_body', {
            answered: pending?.student.answeredCount ?? 0,
            total: pending?.student.assignedCount ?? 0,
          })}
        </p>
      </Modal>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
