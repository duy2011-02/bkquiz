'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { ChalkRoom } from '@/components/chalk/ChalkRoom';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { getI18nPath } from '@/utils/Helpers';

type SessionStatus = {
  id: string;
  status: 'lobby' | 'active' | 'ended';
  totpStepSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  sessionName?: string | null;
  attemptId?: string | null; // null if not joined
  quiz: {
    id: string;
    title: string;
    createdBy: {
      id: string;
      name: string;
    };
  };
  classroom: {
    id: string;
    name: string;
    classCode: string;
  };
};

function formatDuration(startTime: string, locale: string): string {
  const start = new Date(startTime).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - start) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return locale === 'vi' ? `${minutes} phút` : `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  return locale === 'vi'
    ? `${hours} giờ ${minutes % 60} phút`
    : `${hours} hours ${minutes % 60} minutes`;
}

export function Lobby(props: { sessionId: string }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('SessionLobby');
  const [data, setData] = useState<SessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    const res = await fetch(`/api/sessions/${props.sessionId}/status`, { method: 'GET' });
    const json = await res.json() as SessionStatus & { error?: string };
    if (!res.ok) {
      setError(json.error ?? 'SESSION_NOT_FOUND');
      return;
    }
    setData(json);
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/join`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        let json: { attemptId?: string; error?: string };
        try {
          json = JSON.parse(text);
        } catch {
          setError(`JOIN_FAILED: ${res.status} ${res.statusText}`);
          return;
        }
        setError(json.error ?? 'JOIN_FAILED');
        return;
      }
      const text = await res.text();
      if (!text) {
        setError('JOIN_FAILED: Empty response');
        return;
      }
      let json: { attemptId?: string; error?: string };
      try {
        json = JSON.parse(text);
      } catch (err) {
        setError('JOIN_FAILED: Invalid JSON response');
        console.error('Failed to parse response:', text, err);
        return;
      }
      if (!json.attemptId) {
        setError(json.error ?? 'JOIN_FAILED');
        return;
      }
      // Reload status to get updated attemptId
      await load();
      // If session is active, redirect to attempt page
      // Otherwise, stay in lobby (student has joined, waiting for teacher to start)
      if (data?.status === 'active') {
        router.push(getI18nPath(`/attempt/${json.attemptId}`, locale));
      }
      // If still in lobby, stay here (will show "Đã tham gia" state)
    } catch (err) {
      setError(`JOIN_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error joining session:', err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // Poll every 3 seconds to check for status changes
    const id = window.setInterval(() => {
      void load();
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  // Auto-redirect to attempt page if session becomes active and student has joined
  useEffect(() => {
    if (data?.status === 'active' && data?.attemptId) {
      router.push(getI18nPath(`/attempt/${data.attemptId}`, locale));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.status, data?.attemptId]);

  const waitDuration = useMemo(() => {
    if (!data || data.status !== 'lobby') {
      return null;
    }
    return formatDuration(data.createdAt, locale);
  }, [data, locale]);

  const backLink = (
    <Link href={getI18nPath('/dashboard', locale)} className={cn(s.btn, s.ledgeBtn)}>
      {`← ${t('breadcrumb_dashboard')}`}
    </Link>
  );

  if (error) {
    return (
      <ChalkRoom lockViewport ledge={backLink}>
        <h1 className={cn(s.title, s.script, s.chalk)}>{t('cannot_access_session')}</h1>
        <div className={cn(s.note, s.pink, 'self-start')} role="alert">{error}</div>
      </ChalkRoom>
    );
  }

  if (!data) {
    return (
      <ChalkRoom lockViewport ledge={backLink}>
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-sm" />
        <Skeleton className="mx-auto mt-10 h-40 w-full max-w-xl" />
      </ChalkRoom>
    );
  }

  const noteHeading = cn(s.script, 'text-[1.8rem] leading-tight font-bold');

  return (
    <ChalkRoom lockViewport ledge={backLink}>
      {/* Breadcrumb */}
      <nav aria-label={t('breadcrumb_label')} className={cn(s.dim, 'flex flex-wrap items-center gap-2')}>
        <Link href={getI18nPath('/dashboard', locale)} className="hover:text-chalk">
          {t('breadcrumb_dashboard')}
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={getI18nPath(`/dashboard/classes/${data.classroom.id}`, locale)} className="hover:text-chalk">
          {data.classroom.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{t('breadcrumb_session')}</span>
      </nav>

      {/* Session header */}
      <header className={s.header}>
        <div className="min-w-0 flex-1">
          <h1 className={cn(s.title, s.script, s.chalk)}>{data.sessionName || data.quiz.title}</h1>
          <div className={cn(s.meta, s.dim, 'mt-1')}>
            <span>
              {t('class')}
              {' '}
              <span className={s.chalk}>{data.classroom.name}</span>
            </span>
            <span>
              {t('class_code')}
              {' '}
              <span className={cn(s.yellow, 'font-mono')}>{data.classroom.classCode}</span>
            </span>
            <span>
              {t('teacher')}
              {' '}
              <span className={s.chalk}>{data.quiz.createdBy.name}</span>
            </span>
          </div>
        </div>
      </header>

      <div className={s.rule} />

      <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 py-6">
        {data.status === 'lobby'
          ? (
              data.attemptId
                ? (
                    // Joined: waiting for the teacher to start
                    <div className={cn(s.note, s.yellow, 'flex flex-col gap-2')} role="status">
                      <div className={noteHeading}>{t('joined_waiting')}</div>
                      <p className={s.modalText}>{t('auto_redirect_hint')}</p>
                      {waitDuration
                        ? (
                            <p className={s.dim}>
                              {t('waited')}
                              {' '}
                              <span className="font-mono">{waitDuration}</span>
                            </p>
                          )
                        : null}
                    </div>
                  )
                : (
                    // Not joined yet
                    <>
                      <div className={cn(s.note, s.blue, 'flex flex-col gap-2')}>
                        <div className={noteHeading}>{t('join_session')}</div>
                        <p className={s.modalText}>{t('join_session_hint')}</p>
                      </div>
                      <Button
                        variant="solid"
                        size="lg"
                        className="w-full"
                        onClick={() => void join()}
                        loading={busy}
                      >
                        {busy ? t('joining') : `${t('join')} →`}
                      </Button>
                    </>
                  )
            )
          : data.status === 'active'
            ? (
                <>
                  <div className={cn(s.note, s.green, 'flex flex-col gap-2')} role="status">
                    <div className={noteHeading}>{t('session_started')}</div>
                    <p className={s.modalText}>{t('click_to_start_quiz')}</p>
                    {data.startedAt
                      ? (
                          <p className={s.dim}>
                            {t('started_at')}
                            {' '}
                            <span className="font-mono">{new Date(data.startedAt).toLocaleTimeString('en-US')}</span>
                          </p>
                        )
                      : null}
                  </div>
                  <Button
                    variant="solid"
                    size="lg"
                    className="w-full"
                    onClick={() => void join()}
                    loading={busy}
                  >
                    {busy ? t('entering') : `${t('start_quiz')} →`}
                  </Button>
                </>
              )
            : (
                <>
                  <div className={cn(s.note, s.dim, 'flex flex-col gap-2')}>
                    <div className={cn(noteHeading, s.chalk)}>{t('session_ended')}</div>
                    <p className={s.modalText}>{t('ask_teacher_for_results')}</p>
                    {data.endedAt
                      ? (
                          <p>
                            {t('ended_at')}
                            {' '}
                            <span className="font-mono">{new Date(data.endedAt).toLocaleTimeString('en-US')}</span>
                          </p>
                        )
                      : null}
                  </div>
                  <Button
                    className="self-start"
                    onClick={() => router.push(getI18nPath(`/dashboard/classes/${data.classroom.id}`, locale))}
                  >
                    {t('back_to_class')}
                  </Button>
                </>
              )}
      </section>
    </ChalkRoom>
  );
}
// EOF
