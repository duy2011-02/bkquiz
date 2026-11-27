'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'react-qr-code';
import cs from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableWrap } from '@/components/ui/Table';
import { cn } from '@/utils/cn';
import { formatGrade } from '@/utils/formatGrade';
import { getI18nPath } from '@/utils/Helpers';

type TeacherTokenResponse = {
  sessionId: string;
  joinUrl: string;
  token: string;
  expiresInSeconds: number;
  stepSeconds: number;
};

type SessionStatusResponse = {
  id: string;
  status: 'lobby' | 'active' | 'ended';
  startedAt: string | null;
  endedAt: string | null;
  totpStepSeconds: number;
  attemptCount: number;
  quiz: {
    title: string;
  };
  classroom: {
    id: string;
    name: string;
    classCode: string;
  };
  sessionName?: string | null;
  durationSeconds?: number | null;
  extensionSeconds?: number;
  sessionEndTime?: string | null;
};

const EXTEND_OPTIONS_MINUTES = [5, 10, 15] as const;

type TokenLogRow = {
  id: string;
  type: 'scheduled' | 'verify_ok' | 'verify_fail' | 'locked';
  ok: boolean | null;
  createdAt: string;
  dueAt: string | null;
  enteredToken: string | null;
  attemptId: string;
  user: { id: string; email: string | null; name: string | null };
};

type ScoreRow = {
  id: string;
  status: 'active' | 'submitted' | 'locked';
  score: number | null;
  /** Điểm thang 10 */
  grade?: number | null;
  correctCount?: number | null;
  totalQuestions?: number | null;
  submittedAt: string | null;
  user: { id: string; email: string | null; name: string | null };
  /** Có cờ nghi vấn (Task 5.4) — màn chiếu chỉ hiện ⚑, lý do xem ở trang Theo dõi */
  flagged?: boolean;
};

function formatDuration(startedAt: string | null, notStartedLabel: string): string {
  if (!startedAt) {
    return notStartedLabel;
  }
  const start = new Date(startedAt);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.length > 50 ? `${url.slice(0, 47)}...` : url;
  }
}

export function TeacherScreen(props: { sessionId: string; userId: string | null }) {
  const locale = useLocale();
  const t = useTranslations('TeacherScreen');
  const tSessions = useTranslations('Sessions');
  const [data, setData] = useState<TeacherTokenResponse | null>(null);
  const [session, setSession] = useState<SessionStatusResponse | null>(null);
  const [logs, setLogs] = useState<TokenLogRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [joinedStudents, setJoinedStudents] = useState<Array<{
    attemptId: string;
    userId: string;
    name: string;
    email: string | null;
    status: string;
    joinedAt: string;
  }>>([]);
  const [snapshotInfo, setSnapshotInfo] = useState<null | {
    alreadyBuilt: boolean;
    totalPicked: number;
    perRule: Array<{ tagId: string; tagNormalizedName: string; requested: number; picked: number }>;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [extending, setExtending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const router = useRouter();

  const lastFetchedAt = useRef<number>(0);
  const hasRefetchedForExpiry = useRef<boolean>(false);

  async function fetchStatus() {
    const res = await fetch(`/api/sessions/${props.sessionId}/status`, { method: 'GET' });
    const json = await res.json() as Partial<SessionStatusResponse> & { error?: string };
    if (!res.ok) {
      setError(json.error ?? 'SESSION_NOT_FOUND');
      return;
    }
    const newStatus = (json as SessionStatusResponse).status;
    const prevStatus = session?.status;

    setSession(json as SessionStatusResponse);

    // Nếu session vừa chuyển từ lobby → active (auto-start), hoặc status là active mà chưa có token
    // thì fetch token ngay lập tức
    if (newStatus === 'active' && (prevStatus === 'lobby' || !data)) {
      void fetchToken();
    }

    // Trigger auto-start/auto-end endpoint (cho dev mode)
    // Server sẽ tự kiểm tra và start/end sessions nếu cần
    // - Lobby: check scheduledStartAt và start nếu đã quá giờ
    // - Active: check durationSeconds + bufferMinutes và end nếu đã hết giờ
    if (newStatus === 'lobby' || newStatus === 'active') {
      // Trigger auto-management endpoint (không cần await, để chạy background)
      // Server sẽ tự check và chỉ start/end nếu đã đến thời điểm
      void fetch('/api/sessions/auto', { method: 'POST' }).catch((err) => {
        console.error('Failed to trigger auto-management:', err);
      });
    }
  }

  async function fetchLogs() {
    const res = await fetch(`/api/sessions/${props.sessionId}/report/tokenLog`, { method: 'GET' });
    const json = await res.json() as { logs?: TokenLogRow[]; error?: string };
    if (!res.ok) {
      return;
    }
    setLogs(json.logs ?? []);
  }

  async function fetchScoreboard() {
    const res = await fetch(`/api/sessions/${props.sessionId}/report/scoreboard`, { method: 'GET' });
    const json = await res.json() as { attempts?: ScoreRow[]; error?: string };
    if (!res.ok) {
      return;
    }
    setScores(json.attempts ?? []);
  }

  async function fetchJoinedStudents() {
    // Chỉ fetch khi session ở lobby hoặc active
    if (session?.status === 'ended') {
      return;
    }
    const res = await fetch(`/api/sessions/${props.sessionId}/joinedStudents`, { method: 'GET' });
    const json = await res.json() as { students?: Array<{
      attemptId: string;
      userId: string;
      name: string;
      email: string | null;
      status: string;
      joinedAt: string;
    }>; error?: string; };
    if (!res.ok) {
      return;
    }
    setJoinedStudents(json.students ?? []);
  }

  async function fetchToken() {
    // Không fetch token nếu session đã ended (check từ state hiện tại)
    // Lưu ý: Khi được gọi từ fetchStatus() sau auto-start, session state có thể chưa update
    // nhưng API sẽ trả về lỗi nếu session đã ended, nên vẫn an toàn
    if (session?.status === 'ended') {
      return;
    }
    setError(null);
    const res = await fetch(`/api/sessions/${props.sessionId}/teacherToken`, { method: 'GET' });
    const json = await res.json() as Partial<TeacherTokenResponse> & { error?: string };
    if (!res.ok) {
      // Nếu session đã ended, không set error (đây là expected behavior)
      if (json.error !== 'SESSION_ENDED') {
        setError(json.error ?? 'FORBIDDEN');
      }
      return;
    }
    setData(json as TeacherTokenResponse);
    lastFetchedAt.current = Date.now();
    hasRefetchedForExpiry.current = false;
  }

  useEffect(() => {
    void fetchStatus();
    void fetchLogs();
    void fetchScoreboard();
    void fetchJoinedStudents();
    void fetchToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  // Fetch token khi session status thay đổi từ ended sang active/lobby
  useEffect(() => {
    if (session?.status !== 'ended') {
      void fetchToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchStatus(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchLogs(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchScoreboard(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  // Poll joined students every 3 seconds when session is lobby or active
  useEffect(() => {
    if (session?.status === 'ended') {
      return; // Don't poll if session ended
    }
    // Fetch immediately, then poll every 3 seconds
    void fetchJoinedStudents();
    const id = window.setInterval(() => void fetchJoinedStudents(), 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId, session?.status]);

  async function startSession() {
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/start`, { method: 'POST' });
      if (!res.ok) {
        const text = await res.text();
        let json: { error?: string; snapshot?: any };
        try {
          json = JSON.parse(text);
        } catch {
          setError(`START_FAILED: ${res.status} ${res.statusText}`);
          return;
        }
        setError(json.error ?? 'START_FAILED');
        return;
      }
      const text = await res.text();
      if (!text) {
        setError('START_FAILED: Empty response');
        return;
      }
      let json: { error?: string; snapshot?: any };
      try {
        json = JSON.parse(text);
      } catch (err) {
        setError(`START_FAILED: Invalid JSON response`);
        console.error('Failed to parse response:', text, err);
        return;
      }
      if (json.snapshot) {
        setSnapshotInfo(json.snapshot);
      }
      await fetchStatus();
      await fetchLogs();
      await fetchScoreboard();
    } catch (err) {
      setError(`START_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error starting session:', err);
    }
  }

  async function endSession() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('confirm_end'))) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/sessions/${props.sessionId}/end`, { method: 'POST' });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setError(json.error ?? 'END_FAILED');
      return;
    }
    await fetchStatus();
  }

  async function extendSession(minutes: number) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('confirm_extend', { minutes }))) {
      return;
    }
    setError(null);
    setExtending(true);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/extend`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error === 'EXTENSION_LIMIT' ? t('extend_limit') : (json.error ?? 'EXTEND_FAILED'));
        return;
      }
      await fetchStatus();
    } finally {
      setExtending(false);
    }
  }

  async function deleteSession() {
    if (!session || session.status === 'active') {
      return;
    }
    // Session lobby: xác nhận đơn giản. Session ended: đã bắt gõ lại tên ở Danger Zone.
    // eslint-disable-next-line no-alert
    if (session.status === 'lobby' && !window.confirm(t('confirm_cancel_session'))) {
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}`, { method: 'DELETE' });
      const json = await res.json() as { error?: string; classroomId?: string };
      if (!res.ok) {
        setError(json.error === 'SESSION_ACTIVE' ? t('delete_session_active') : (json.error ?? 'DELETE_FAILED'));
        return;
      }
      router.push(getI18nPath(`/dashboard/classes/${json.classroomId ?? session.classroom.id}`, locale));
    } finally {
      setDeleting(false);
    }
  }

  // Local countdown tick (no extra server calls).
  useEffect(() => {
    // Không chạy countdown nếu session đã ended
    if (session?.status === 'ended') {
      setSecondsLeft(null);
      return;
    }
    const id = window.setInterval(() => {
      if (!data) {
        setSecondsLeft(null);
        return;
      }
      const elapsed = (Date.now() - lastFetchedAt.current) / 1000;
      const left = Math.max(0, Math.ceil(data.expiresInSeconds - elapsed));
      setSecondsLeft(left);

      // Auto-refetch token when it expires (only once per expiry)
      if (left <= 0 && !hasRefetchedForExpiry.current && session?.status !== 'ended') {
        hasRefetchedForExpiry.current = true;
        void fetchToken();
      }
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, session?.status]);

  const progressPercent = data && secondsLeft !== null
    ? Math.max(0, Math.min(100, (secondsLeft / data.stepSeconds) * 100))
    : 0;

  return (
    <div className={cn(cs.room, 'fixed inset-0 z-modal block overflow-y-auto')}>
      <div className={cn(cs.frame, 'mx-auto min-h-full')}>
        <div className={cs.board}>
          <div className="relative z-[1] flex-1">
            {/* Session info written at the top of the board: breadcrumb + controls, then the session line */}
            <div className="flex flex-col gap-3 border-b-2 border-dashed border-chalk-faint px-4 py-3 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <nav aria-label={t('breadcrumb_dashboard')} className="flex flex-wrap items-center gap-1 text-base text-chalk-dim">
                  <Link href={getI18nPath('/dashboard', locale)} className="hover:text-chalk">
                    {t('breadcrumb_dashboard')}
                  </Link>
                  <span aria-hidden="true">/</span>
                  <Link href={getI18nPath('/dashboard/classes', locale)} className="hover:text-chalk">
                    {t('breadcrumb_classes')}
                  </Link>
                  {session?.classroom && (
                    <>
                      <span aria-hidden="true">/</span>
                      <Link href={getI18nPath(`/dashboard/classes/${session.classroom.id}`, locale)} className="hover:text-chalk">
                        {session.classroom.name}
                      </Link>
                    </>
                  )}
                  <span aria-hidden="true">/</span>
                  <span>{session ? (session.sessionName || session.quiz.title) : t('session')}</span>
                </nav>

                <div className="flex flex-wrap items-center gap-2">
                  {session?.status === 'lobby'
                    ? (
                        <>
                          <Button size="sm" variant="danger" disabled={deleting} onClick={() => void deleteSession()}>
                            {t('cancel_session')}
                          </Button>
                          <Button size="lg" variant="solid" onClick={() => void startSession()}>
                            {t('start_session')}
                          </Button>
                        </>
                      )
                    : null}
                  {session?.status === 'active' && session.durationSeconds
                    ? (
                        <div className="flex flex-wrap items-center gap-1" title={t('extend_hint')}>
                          {EXTEND_OPTIONS_MINUTES.map(m => (
                            <Button key={m} size="sm" disabled={extending} onClick={() => void extendSession(m)}>
                              {t('extend_minutes', { minutes: m })}
                            </Button>
                          ))}
                        </div>
                      )
                    : null}
                  {session?.status === 'active'
                    ? (
                        <Button size="lg" variant="danger" onClick={() => void endSession()}>
                          {t('end_session')}
                        </Button>
                      )
                    : null}
                  {/* Trang giám sát mở ở tab riêng trên máy giáo viên — không hiện tên sinh viên lên màn chiếu */}
                  <Link
                    href={getI18nPath(`/dashboard/sessions/${props.sessionId}/monitor`, locale)}
                    target="_blank"
                    className={cn(cs.btn, cs.btnSm)}
                  >
                    {t('open_monitor')}
                  </Link>
                  <Link
                    href={getI18nPath(`/dashboard/sessions/${props.sessionId}/stats`, locale)}
                    target="_blank"
                    className={cn(cs.btn, cs.btnSm)}
                  >
                    {t('open_stats')}
                  </Link>
                  {session?.status !== 'ended'
                    ? (
                        <Button size="sm" onClick={() => void fetchToken()}>
                          {t('refresh_token')}
                        </Button>
                      )
                    : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-lg">
                <h1 className={cn(cs.title, cs.chalk, 'whitespace-normal')}>
                  {session?.sessionName || session?.quiz?.title || t('loading')}
                </h1>
                <span className="text-chalk-dim">{session?.classroom?.name ?? '...'}</span>
                <Badge variant={session?.status === 'active' ? 'success' : session?.status === 'ended' ? 'neutral' : 'info'}>
                  {tSessions(`badge_${session?.status ?? 'loading'}`)}
                </Badge>
                {session?.status === 'lobby' && (
                  <span className="text-chalk-dim">
                    {t.rich('students_joined_inline', {
                      count: joinedStudents.length,
                      strong: chunks => <span className="text-chalk">{chunks}</span>,
                    })}
                  </span>
                )}
                {session?.startedAt
                  ? (
                      <span className="font-mono text-chalk-dim">
                        {formatDuration(session.startedAt, t('not_started'))}
                      </span>
                    )
                  : null}
                {session?.status === 'active' && session.sessionEndTime
                  ? (
                      <span className="text-chalk-dim">
                        {t('ends_at', {
                          time: new Date(session.sessionEndTime).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
                        })}
                        {session.extensionSeconds
                          ? (
                              <span className="ml-1 text-chalk-yellow">
                                {t('extended_by', { minutes: Math.round(session.extensionSeconds / 60) })}
                              </span>
                            )
                          : null}
                      </span>
                    )
                  : null}
                {error
                  ? (
                      <span className="text-chalk-pink" role="alert">{error}</span>
                    )
                  : null}
              </div>
            </div>

            {/* Main Content - Full-screen QR + Token hoặc Ended Summary */}
            <div className="flex min-h-screen items-center justify-center px-3 py-10 md:px-6 md:py-20">
              {session?.status === 'lobby'
                ? (
              /* Lobby - QR Code + Joined Students List */
                    <div className="grid w-full max-w-7xl gap-8 lg:grid-cols-2">
                      {/* QR Code Section - Left */}
                      <div className="flex flex-col items-center justify-center">
                        <div className="mb-4 text-base font-medium text-chalk-dim">{t('qr_for_students')}</div>
                        <div className="flex items-center justify-center">
                          {data?.joinUrl
                            ? (
                                <div className="w-full max-w-[min(60vh,480px)] rounded-[10px] border-4 border-wood bg-paper p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] md:p-6">
                                  <QRCode value={data.joinUrl} size={480} style={{ width: '100%', height: 'auto' }} />
                                </div>
                              )
                            : (
                                <div className="w-full max-w-[min(60vh,480px)]">
                                  <Skeleton className="mx-auto aspect-square w-full" />
                                  <div className="mt-3 text-center text-base text-chalk-dim">{t('loading_qr')}</div>
                                </div>
                              )}
                        </div>
                        <div className="mt-6 max-w-md text-center">
                          <div className="rounded-hand border border-chalk-faint bg-white/5 p-3 font-mono text-sm break-all text-chalk-dim">
                            {data?.joinUrl ? shortenUrl(data.joinUrl) : '...'}
                          </div>
                          <div className="mt-2 text-sm text-chalk-dim">
                            {t('scan_qr_hint')}
                          </div>
                        </div>
                      </div>

                      {/* Joined Students List - Right */}
                      <div className="flex flex-col">
                        <Card className="border-chalk-faint bg-white/5 p-6">
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <div className="text-lg font-semibold text-chalk">
                                {t('joined_students')}
                              </div>
                              <div className="mt-1 text-base text-chalk-dim">
                                {t('students_count', { count: joinedStudents.length })}
                              </div>
                            </div>
                          </div>

                          {joinedStudents.length === 0
                            ? (
                                <div className="py-8 text-center text-base text-chalk-dim">
                                  {t('no_students_joined')}
                                </div>
                              )
                            : (
                                <div className="max-h-[600px] space-y-2 overflow-y-auto">
                                  {joinedStudents.map((student, idx) => {
                                    // Get initials for avatar
                                    const initials = student.name
                                      .split(' ')
                                      .map(n => n[0])
                                      .join('')
                                      .toUpperCase()
                                      .slice(0, 2);
                                    const joinedTime = new Date(student.joinedAt).toLocaleTimeString(locale, {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    });
                                    return (
                                      <div
                                        key={student.attemptId}
                                        className="flex items-center gap-3 rounded-hand border border-chalk-faint bg-white/5 px-3 py-2 transition-all duration-200 hover:bg-white/5"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                      >
                                        {/* Avatar */}
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chalk-yellow/20 text-base font-semibold text-chalk-yellow">
                                          {initials}
                                        </div>
                                        {/* Student Info */}
                                        <div className="min-w-0 flex-1">
                                          <div className="truncate text-base font-medium text-chalk">
                                            {student.name}
                                          </div>
                                          {student.email && (
                                            <div className="truncate text-sm text-chalk-dim">
                                              {student.email}
                                            </div>
                                          )}
                                        </div>
                                        {/* Joined Time */}
                                        <div className="shrink-0 font-mono text-sm text-chalk-dim">
                                          {joinedTime}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                        </Card>
                      </div>
                    </div>
                  )
                : session?.status === 'ended'
                  ? (
                /* Session Ended - Summary View */
                      <div className="w-full max-w-4xl space-y-6">
                        {/* Banner đỏ */}
                        <Card className="border-chalk-pink/40 bg-chalk-pink/20 p-6">
                          <div className="flex items-center gap-3">
                            <svg
                              className="h-6 w-6 text-chalk-pink"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                              />
                            </svg>
                            <div>
                              <div className="text-lg font-semibold text-chalk-pink">{t('session_ended')}</div>
                              <div className="mt-1 text-base text-chalk-pink">
                                {session.endedAt
                                  ? t('ended_at', { time: new Date(session.endedAt).toLocaleString(locale) })
                                  : t('session_was_ended')}
                              </div>
                            </div>
                          </div>
                        </Card>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <Card className="border-chalk-faint bg-white/5 p-6">
                            <div className="mb-2 text-base text-chalk-dim">{t('total_attempts')}</div>
                            <div className="text-3xl font-bold text-chalk">{scores.length}</div>
                          </Card>
                          <Card className="border-chalk-faint bg-white/5 p-6">
                            <div className="mb-2 text-base text-chalk-dim">{t('submitted')}</div>
                            <div className="text-3xl font-bold text-chalk">
                              {scores.filter(s => s.status === 'submitted').length}
                            </div>
                          </Card>
                          <Card className="border-chalk-faint bg-white/5 p-6">
                            <div className="mb-2 text-base text-chalk-dim">{t('duration')}</div>
                            <div className="font-mono text-3xl font-bold text-chalk">
                              {session.startedAt && session.endedAt
                                ? (() => {
                                    const start = new Date(session.startedAt);
                                    const end = new Date(session.endedAt);
                                    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
                                    const minutes = Math.floor(diff / 60);
                                    const seconds = diff % 60;
                                    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                                  })()
                                : '-'}
                            </div>
                          </Card>
                        </div>

                        {/* Quick Actions */}
                        <Card className="border-chalk-faint bg-white/5 p-6">
                          <div className="mb-4 text-base font-semibold text-chalk">{t('view_detailed_report')}</div>
                          <div className="flex flex-wrap gap-3">
                            <Button
                              variant="primary"
                              onClick={() => setShowScoreboard(true)}
                              className="px-6 py-3"
                            >
                              {t('view_scoreboard')}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => setShowLogs(true)}
                              className="border-chalk-faint px-6 py-3 text-chalk/85 hover:bg-white/5"
                            >
                              {t('view_token_log')}
                            </Button>
                            <a
                              href={`/api/sessions/${props.sessionId}/report/scoreboard?format=csv`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-hand border border-chalk-faint px-6 py-3 text-base text-chalk/85 transition-colors hover:bg-white/5"
                            >
                              {t('download_scoreboard_csv')}
                            </a>
                            <a
                              href={`/api/sessions/${props.sessionId}/report/tokenLog?format=csv`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center rounded-hand border border-chalk-faint px-6 py-3 text-base text-chalk/85 transition-colors hover:bg-white/5"
                            >
                              {t('download_token_log_csv')}
                            </a>
                          </div>
                        </Card>

                        {/* Danger Zone - Xoá session (mất toàn bộ bài làm) */}
                        {(() => {
                          const confirmName = session.sessionName || session.quiz.title;
                          return (
                            <Card className="border-chalk-pink/30 bg-chalk-pink/5 p-6">
                              <div className="text-base font-semibold text-chalk-pink">{t('danger_zone')}</div>
                              <div className="mt-2 text-base text-chalk/85">{t('delete_session_title')}</div>
                              <p className="mt-1 text-sm text-chalk-dim">
                                {t('delete_session_warning', { attempts: scores.length })}
                              </p>
                              <label className="mt-3 block text-sm text-chalk-dim" htmlFor="deleteSessionConfirmName">
                                {t.rich('delete_session_confirm_label', {
                                  name: confirmName,
                                  strong: chunks => <span className="font-semibold text-chalk">{chunks}</span>,
                                })}
                              </label>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <input
                                  id="deleteSessionConfirmName"
                                  value={deleteConfirmName}
                                  onChange={e => setDeleteConfirmName(e.target.value)}
                                  autoComplete="off"
                                  className="min-w-64 flex-1 rounded-hand border border-chalk-faint bg-board-dark/60 px-3 py-2 text-base text-chalk placeholder:text-chalk-dim focus:border-chalk-pink focus:outline-none"
                                  placeholder={confirmName}
                                />
                                <Button
                                  variant="danger"
                                  disabled={deleting || deleteConfirmName.trim() !== confirmName.trim()}
                                  onClick={() => void deleteSession()}
                                >
                                  {t('delete_session_button')}
                                </Button>
                              </div>
                            </Card>
                          );
                        })()}
                      </div>
                    )
                  : (
                /* Active/Lobby - QR + Token View */
                      <div className="grid w-full max-w-7xl gap-8 lg:grid-cols-2">
                        {/* QR Code Section */}
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-4 text-base font-medium text-chalk-dim">{t('qr_for_students')}</div>
                          <div className="flex items-center justify-center">
                            {data?.joinUrl
                              ? (
                                  <div className="w-full max-w-[min(60vh,480px)] rounded-[10px] border-4 border-wood bg-paper p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] md:p-6">
                                    <QRCode value={data.joinUrl} size={480} style={{ width: '100%', height: 'auto' }} />
                                  </div>
                                )
                              : (
                                  <div className="w-full max-w-[min(60vh,480px)]">
                                    <Skeleton className="mx-auto aspect-square w-full" />
                                    <div className="mt-3 text-center text-base text-chalk-dim">{t('loading_qr')}</div>
                                  </div>
                                )}
                          </div>
                          <div className="mt-6 max-w-md text-center">
                            <div className="rounded-hand border border-chalk-faint bg-white/5 p-3 font-mono text-sm break-all text-chalk-dim">
                              {data?.joinUrl ? shortenUrl(data.joinUrl) : '...'}
                            </div>
                            <div className="mt-2 text-sm text-chalk-dim">
                              {t('scan_qr_hint')}
                            </div>
                          </div>
                        </div>

                        {/* Token Section */}
                        <div className="flex flex-col items-center justify-center">
                          <div className="mb-4 text-base font-medium text-chalk-dim">{t('token_totp')}</div>
                          <div className="w-full text-center">
                            <div className="mb-6 font-mono text-[clamp(3.5rem,7vw,9rem)] leading-none font-bold chalk-glow tracking-[0.3em] text-chalk-yellow" aria-live="polite">
                              {data?.token ?? '------'}
                            </div>

                            {/* Progress Bar */}
                            <div className="mx-auto mb-4 w-full max-w-md">
                              <div className={cn(cs.progressTrack, 'h-2')}>
                                <div
                                  className={cs.progressFill}
                                  style={{ width: `${progressPercent}%` }}
                                />
                              </div>
                            </div>

                            <div className={cn(cs.timer, cs.chalk, 'mb-3 font-mono text-[2rem]')}>
                              {secondsLeft === null
                                ? '...'
                                : `${secondsLeft}s`}
                            </div>
                            <div className="text-sm text-chalk-dim">
                              {t('token_changes_in', {
                                seconds: secondsLeft === null ? '...' : `${secondsLeft}s`,
                                step: data?.stepSeconds ?? 45,
                              })}
                            </div>
                          </div>
                          <div className="mt-8 max-w-md text-center">
                            <div className="rounded-hand border border-chalk-faint bg-white/5 p-3 text-sm text-chalk-dim">
                              {t('projector_hint')}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
            </div>

            {/* Collapsible Sections */}
            <div className="border-t border-chalk-faint bg-board-dark/60">
              <div className="mx-auto max-w-7xl space-y-4 px-6 py-4">
                {/* Snapshot Info */}
                {snapshotInfo && snapshotInfo.perRule.length > 0
                  ? (
                      <Card className="border-chalk-faint bg-white/5 p-4">
                        <div className="mb-2 text-base font-semibold text-chalk">{t('snapshot_summary')}</div>
                        <div className="mb-2 text-sm text-chalk-dim">
                          {t('total_picked')}
                          {' '}
                          <span className="font-mono text-chalk/85">{snapshotInfo.totalPicked}</span>
                          {snapshotInfo.alreadyBuilt ? t('already_built') : ''}
                        </div>
                        <div className="space-y-1">
                          {snapshotInfo.perRule.filter(r => r.picked < r.requested).length === 0
                            ? (
                                <div className="text-sm text-chalk-green">{t('enough_questions')}</div>
                              )
                            : snapshotInfo.perRule.filter(r => r.picked < r.requested).map(r => (
                                <div key={r.tagId} className="text-sm text-chalk-yellow">
                                  {t.rich('tag_shortage', {
                                    tag: r.tagNormalizedName,
                                    requested: r.requested,
                                    picked: r.picked,
                                    missing: r.requested - r.picked,
                                    mono: chunks => <span className="font-mono">{chunks}</span>,
                                  })}
                                </div>
                              ))}
                        </div>
                      </Card>
                    )
                  : null}

                {/* Token Log - Collapsible */}
                <Card className="border-chalk-faint bg-white/5">
                  <div className="flex w-full items-center justify-between p-4">
                    <button
                      type="button"
                      onClick={() => setShowLogs(!showLogs)}
                      className="-m-2 flex flex-1 items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="text-base font-semibold text-chalk">
                        {t('token_log')}
                        {' '}
                        <span className="text-sm font-normal text-chalk-dim">
                          {t('entries_count', { count: logs.length })}
                        </span>
                      </div>
                      <svg
                        className={`h-5 w-5 text-chalk-dim transition-transform ${showLogs ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="ml-4 flex items-center gap-2">
                      <a
                        className="rounded-hand border border-chalk-faint px-3 py-1.5 text-sm text-chalk/85 transition-colors hover:bg-white/5"
                        href={`/api/sessions/${props.sessionId}/report/tokenLog?format=csv`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('download_csv')}
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void fetchLogs()}
                        className="border-chalk-faint text-chalk/85 hover:bg-white/5"
                      >
                        {t('refresh')}
                      </Button>
                    </div>
                  </div>
                  {showLogs
                    ? (
                        <div className="px-4 pb-4">
                          <TableWrap className="mt-3">
                            <Table>
                              <thead>
                                <tr className="text-sm text-chalk-dim">
                                  <th className="border-b border-chalk-faint p-2">{t('col_time')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_user')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_type')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_token')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_attempt')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {logs.length === 0
                                  ? (
                                      <tr>
                                        <td className="p-2 text-sm text-chalk-dim" colSpan={5}>{t('no_logs')}</td>
                                      </tr>
                                    )
                                  : logs.slice(0, 50).map(l => (
                                      <tr key={l.id} className="text-sm odd:bg-white/5">
                                        <td className="p-2 font-mono text-chalk/85">{new Date(l.createdAt).toLocaleTimeString(locale)}</td>
                                        <td className="p-2 text-chalk/85">
                                          {l.user.email ?? l.user.name ?? l.user.id}
                                        </td>
                                        <td className="p-2 font-mono text-chalk-dim">
                                          {l.type}
                                        </td>
                                        <td className="p-2 font-mono text-chalk/85">
                                          {l.enteredToken ?? '-'}
                                        </td>
                                        <td className="p-2 font-mono text-chalk-dim">{l.attemptId.slice(0, 8)}</td>
                                      </tr>
                                    ))}
                              </tbody>
                            </Table>
                          </TableWrap>
                        </div>
                      )
                    : null}
                </Card>

                {/* Scoreboard - Collapsible */}
                <Card className="border-chalk-faint bg-white/5">
                  <div className="flex w-full items-center justify-between p-4">
                    <button
                      type="button"
                      onClick={() => setShowScoreboard(!showScoreboard)}
                      className="-m-2 flex flex-1 items-center justify-between rounded-md p-2 text-left transition-colors hover:bg-white/5"
                    >
                      <div className="text-base font-semibold text-chalk">
                        {t('scoreboard')}
                        {' '}
                        <span className="text-sm font-normal text-chalk-dim">
                          {t('students_count_paren', { count: scores.length })}
                        </span>
                      </div>
                      <svg
                        className={`h-5 w-5 text-chalk-dim transition-transform ${showScoreboard ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="ml-4 flex items-center gap-2">
                      <a
                        className="rounded-hand border border-chalk-faint px-3 py-1.5 text-sm text-chalk/85 transition-colors hover:bg-white/5"
                        href={`/api/sessions/${props.sessionId}/report/scoreboard?format=csv`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t('download_csv')}
                      </a>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void fetchScoreboard()}
                        className="border-chalk-faint text-chalk/85 hover:bg-white/5"
                      >
                        {t('refresh')}
                      </Button>
                    </div>
                  </div>
                  {showScoreboard
                    ? (
                        <div className="px-4 pb-4">
                          <TableWrap className="mt-3">
                            <Table>
                              <thead>
                                <tr className="text-sm text-chalk-dim">
                                  <th className="border-b border-chalk-faint p-2">{t('col_user')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_status')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_score')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_submitted')}</th>
                                  <th className="border-b border-chalk-faint p-2">{t('col_attempt')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {scores.length === 0
                                  ? (
                                      <tr>
                                        <td className="p-2 text-sm text-chalk-dim" colSpan={5}>{t('no_attempts')}</td>
                                      </tr>
                                    )
                                  : scores.map(s => (
                                      <tr key={s.id} className="text-sm odd:bg-white/5">
                                        <td className="p-2 text-chalk/85">
                                          {s.user.email ?? s.user.name ?? s.user.id}
                                          {s.flagged
                                            ? (
                                                <span className="ml-2 text-chalk-yellow" title={t('flagged_mark_label')}>
                                                  <span aria-hidden="true">⚑</span>
                                                  <span className="sr-only">{t('flagged_mark_label')}</span>
                                                </span>
                                              )
                                            : null}
                                        </td>
                                        <td className="p-2 font-mono text-chalk-dim">{s.status}</td>
                                        <td className="p-2 font-mono whitespace-nowrap text-chalk/85">
                                          {s.grade !== null && s.grade !== undefined ? `${formatGrade(s.grade)}/10` : '-'}
                                          {s.correctCount !== null && s.correctCount !== undefined && s.totalQuestions
                                            ? <span className="ml-2 text-chalk-dim">{`(${s.correctCount}/${s.totalQuestions})`}</span>
                                            : null}
                                        </td>
                                        <td className="p-2 font-mono text-chalk-dim">
                                          {s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString(locale) : '-'}
                                        </td>
                                        <td className="p-2">
                                          <a
                                            href={getI18nPath(`/dashboard/sessions/${props.sessionId}/attempts/${s.id}`, locale)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-chalk-yellow underline-offset-2 hover:underline"
                                            title={s.id}
                                          >
                                            {t('view_attempt')}
                                          </a>
                                        </td>
                                      </tr>
                                    ))}
                              </tbody>
                            </Table>
                          </TableWrap>
                        </div>
                      )
                    : null}
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
