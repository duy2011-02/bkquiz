'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import shared from '@/components/chalk/chalk.module.css';
import { ChalkRoom } from '@/components/chalk/ChalkRoom';
import { MathRenderer } from '@/components/MathRenderer';
import { QuestionImage } from '@/components/QuestionImage';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/utils/cn';
import { deviceHeaders } from '@/utils/deviceId';
import { formatGrade, questionPointsOnTenScale } from '@/utils/formatGrade';
import { getI18nPath } from '@/utils/Helpers';
import { idbGet, idbSet } from '@/utils/idb';
import local from './chalkboard.module.css';
import { useAttemptProctoring } from './useAttemptProctoring';

// Shared chalkboard system + the parts only this page uses (question, options, navigator)
const styles = { ...shared, ...local };

type AttemptState = {
  id: string;
  status: 'active' | 'submitted' | 'locked';
  session: { id: string; status: 'lobby' | 'active' | 'ended'; quiz: { title: string }; sessionName?: string | null };
  attemptStartedAt: string | null;
  attemptEndTime: string | null;
  timeRemaining: number | null;
  isTimeUp: boolean;
  nextDueAt: string | null;
  due: boolean;
  warning: boolean;
  graceSecondsBeforeBlock: number;
  failedCount: number;
  cooldownUntil: string | null;
  lockedUntil: string | null;
  inCooldown: boolean;
  isLocked: boolean;
  score?: number | null;
  /** Điểm thang 10 */
  grade?: number | null;
  correctCount?: number | null;
  totalQuestions?: number | null;
};

type SnapshotQuestion = {
  id: string;
  type: 'mcq_single' | 'mcq_multi';
  prompt: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  order: number;
  options: Array<{ order: number; content: string; isCorrect?: boolean }>;
  studentSelected?: number[];
  questionScore?: number | null;
};

type LocalAnswer = { selected: number[]; updatedAt: number; dirty: boolean; submittedAt?: number | null };
type LocalAnswerStore = Record<string, LocalAnswer>;

const IDB_OPTS = { dbName: 'bkquiz', storeName: 'attemptAnswers' } as const;

function storageKey(attemptId: string) {
  return `bkquiz:attempt:${attemptId}:answers:v1`;
}

async function readLocalAnswers(attemptId: string): Promise<LocalAnswerStore> {
  const key = storageKey(attemptId);
  try {
    const v = await idbGet<LocalAnswerStore>(IDB_OPTS, key);
    if (v) {
      return v;
    }
  } catch {
    // fallback to localStorage below
  }
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as LocalAnswerStore;
  } catch {
    return {};
  }
}

async function writeLocalAnswers(attemptId: string, store: LocalAnswerStore) {
  const key = storageKey(attemptId);
  try {
    await idbSet(IDB_OPTS, key, store);
    return;
  } catch {
    // fallback to localStorage below
  }
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function AttemptClient(props: { attemptId: string }) {
  const t = useTranslations('Attempt');
  const locale = useLocale();
  const [state, setState] = useState<AttemptState | null>(null);
  const [questions, setQuestions] = useState<SnapshotQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(() => new Set());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [canReview, setCanReview] = useState(false);
  const [reviewWindowEnd, setReviewWindowEnd] = useState<string | null>(null); // Thời điểm hết cửa sổ xem lại
  const localAnswersRef = useRef<LocalAnswerStore>({});
  const syncTimerRef = useRef<number | null>(null);
  const prevIdxRef = useRef<number>(0);
  const prevSelectedRef = useRef<number[]>([]);
  const countdownTimerRef = useRef<number | null>(null);

  function computePending(store: LocalAnswerStore) {
    return Object.values(store).filter(a => a.dirty).length;
  }

  function computeAnsweredCount(store: LocalAnswerStore) {
    return questions.filter((q) => {
      const answer = store[q.id];
      return answer && answer.selected.length > 0;
    }).length;
  }

  async function syncDirtyAnswers() {
    if (!navigator.onLine) {
      return;
    }
    setSyncError(null);
    const store = localAnswersRef.current;
    const dirtyEntries = Object.entries(store).filter(([, a]) => a.dirty);
    if (dirtyEntries.length === 0) {
      return;
    }

    // Best-effort sequential sync to keep it simple and avoid hammering.
    for (const [sessionQuestionId, a] of dirtyEntries) {
      const ok = await fetch(`/api/attempts/${props.attemptId}/answers`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...deviceHeaders() },
        body: JSON.stringify({ sessionQuestionId, selected: a.selected }),
      }).then(r => r.ok).catch(() => false);
      if (ok) {
        store[sessionQuestionId] = { ...a, dirty: false };
        await writeLocalAnswers(props.attemptId, store);
      } else {
        setSyncError('SYNC_FAILED');
      }
    }
    localAnswersRef.current = { ...store };
    setPendingCount(computePending(localAnswersRef.current));
  }

  function scheduleSync() {
    if (!navigator.onLine) {
      return;
    }
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void syncDirtyAnswers();
    }, 500);
  }

  // Save selected answers when selected changes (but not when idx changes)
  useEffect(() => {
    const current = questions[idx];
    if (!current) {
      return;
    }
    if (!state || state.status !== 'active') {
      return;
    }

    // Don't save if we just switched questions (idx changed)
    const idxChanged = prevIdxRef.current !== idx;
    if (idxChanged) {
      prevIdxRef.current = idx;
      prevSelectedRef.current = [...selected];
      return;
    }

    // Only save if selected actually changed (user made a selection)
    // Don't overwrite if already submitted (preserve submittedAt)
    const selectedChanged = JSON.stringify(prevSelectedRef.current) !== JSON.stringify(selected);
    if (selectedChanged) {
      const existing = localAnswersRef.current[current.id];
      const isSubmitted = existing?.submittedAt != null;
      // Save locally immediately; sync best-effort when online.
      const store = localAnswersRef.current;
      store[current.id] = {
        selected,
        updatedAt: Date.now(),
        dirty: !isSubmitted, // Don't mark as dirty if already submitted (to avoid overwriting)
        submittedAt: existing?.submittedAt ?? null,
      };
      localAnswersRef.current = { ...store };
      void writeLocalAnswers(props.attemptId, localAnswersRef.current);
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setPendingCount(computePending(localAnswersRef.current));
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setAnsweredCount(computeAnsweredCount(localAnswersRef.current));
      if (!isSubmitted) {
        scheduleSync();
      }
      prevSelectedRef.current = [...selected];
    }

    return () => undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, idx, state?.status]);

  // Update prevIdxRef when idx changes (separate effect to track idx changes)
  useEffect(() => {
    prevIdxRef.current = idx;
    const current = questions[idx];
    if (current) {
      const cachedAnswer = localAnswersRef.current[current.id];
      prevSelectedRef.current = cachedAnswer?.selected ?? [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Update answeredCount when questions or localAnswersRef changes
  useEffect(() => {
    if (questions.length > 0) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setAnsweredCount(computeAnsweredCount(localAnswersRef.current));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions.length]);

  async function submitQuestion(questionId: string) {
    if (!state || state.status !== 'active' || !isOnline) {
      return;
    }
    const current = questions.find(q => q.id === questionId);
    if (!current) {
      return;
    }
    const currentSelected = localAnswersRef.current[current.id]?.selected ?? selected;
    setBusy(true);
    try {
      const res = await fetch(`/api/attempts/${props.attemptId}/answers`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...deviceHeaders() },
        body: JSON.stringify({
          sessionQuestionId: current.id,
          selected: currentSelected,
          submit: true,
        }),
      });
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        setError('SUBMIT_QUESTION_FAILED');
        return;
      }
      let json: { ok?: boolean; error?: string };
      try {
        json = JSON.parse(text);
      } catch {
        setError('SUBMIT_QUESTION_FAILED');
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'SUBMIT_QUESTION_FAILED');
        return;
      }
      // Update local state
      const store = localAnswersRef.current;
      store[current.id] = {
        selected: currentSelected,
        updatedAt: Date.now(),
        dirty: false,
        submittedAt: Date.now(),
      };
      localAnswersRef.current = { ...store };
      await writeLocalAnswers(props.attemptId, store);
      setSubmittedQuestions(prev => new Set([...prev, current.id]));
      setPendingCount(computePending(store));
      // Move on to the next question (stay on the last one)
      const currentIdx = questions.findIndex(x => x.id === current.id);
      if (currentIdx >= 0 && currentIdx < questions.length - 1) {
        setIdx(currentIdx + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setShowSubmitConfirm(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/attempts/${props.attemptId}/submit`, { method: 'POST' });
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        setError('SUBMIT_FAILED');
        return;
      }
      let json: { ok?: boolean; error?: string; retryAfterSeconds?: number; correctCount?: number; totalQuestions?: number; score?: number; grade?: number | null };
      try {
        json = JSON.parse(text);
      } catch {
        setError('SUBMIT_FAILED');
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error === 'RATE_LIMITED' ? t('rate_limited', { seconds: json.retryAfterSeconds ?? 60 }) : (json.error ?? t('submit_failed')));
        return;
      }
      setError(t('submit_success', {
        score: formatGrade(json.grade ?? 0),
        correctCount: json.correctCount ?? 0,
        totalQuestions: json.totalQuestions ?? 0,
      }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function startAttempt() {
    setError(null);
    try {
      const res = await fetch(`/api/attempts/${props.attemptId}/start`, { method: 'POST' });
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        setError('START_FAILED');
        return;
      }
      let json: { ok?: boolean; attemptStartedAt?: string; error?: string; retryAfterSeconds?: number };
      try {
        json = JSON.parse(text);
      } catch {
        setError('START_FAILED');
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error === 'RATE_LIMITED' ? t('rate_limited', { seconds: json.retryAfterSeconds ?? 60 }) : (json.error ?? 'START_FAILED'));
        return;
      }
      // Reload state để lấy time limit info
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function load() {
    const res = await fetch(`/api/attempts/${props.attemptId}/state`, { method: 'GET', headers: deviceHeaders() });
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      setError('ATTEMPT_NOT_FOUND');
      return;
    }
    let json: AttemptState & { error?: string };
    try {
      json = JSON.parse(text);
    } catch {
      setError('ATTEMPT_NOT_FOUND');
      return;
    }
    if (!res.ok) {
      setError(json.error ?? 'ATTEMPT_NOT_FOUND');
      return;
    }
    setError(null);
    setState(json);
    // Update time remaining from state
    setTimeRemaining(json.timeRemaining);
  }

  // Countdown timer effect
  useEffect(() => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (!state?.attemptEndTime || !state?.attemptStartedAt || state.isTimeUp) {
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const endTime = new Date(state.attemptEndTime!);
      const remaining = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));

      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setTimeRemaining(remaining);

      if (remaining === 0) {
        // Auto-submit when time is up
        if (state.status === 'active' && !busy) {
          void submit();
        }
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    countdownTimerRef.current = window.setInterval(updateTimer, 1000);

    return () => {
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.attemptEndTime, state?.attemptStartedAt, state?.isTimeUp, state?.status, busy]);

  async function loadQuestions() {
    const res = await fetch(`/api/attempts/${props.attemptId}/questions`, { method: 'GET' });
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      return;
    }
    let json: {
      questions?: SnapshotQuestion[];
      canReview?: boolean;
      reviewWindowEnd?: string | null; // Thời điểm hết cửa sổ xem lại
      attemptStatus?: string;
      sessionStatus?: string;
      error?: string;
    };
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    if (!res.ok) {
      return;
    }
    setQuestions(json.questions ?? []);
    setCanReview(json.canReview ?? false);
    setReviewWindowEnd(json.reviewWindowEnd ?? null);
  }

  async function loadAnswers() {
    // Start with local cache
    localAnswersRef.current = await readLocalAnswers(props.attemptId);
    setPendingCount(computePending(localAnswersRef.current));
    const current = questions[idx];
    if (current) {
      setSelected(localAnswersRef.current[current.id]?.selected ?? []);
    }

    // Then merge from server (if online)
    if (!navigator.onLine) {
      return;
    }
    const res = await fetch(`/api/attempts/${props.attemptId}/answers`, { method: 'GET' });
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      return;
    }
    let json: { answers?: Array<{ sessionQuestionId: string; selected: number[]; submittedAt?: string | Date | null; updatedAt?: string | Date }>; error?: string };
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    if (!res.ok) {
      return;
    }
    const store = { ...localAnswersRef.current };
    const submittedSet = new Set<string>();
    for (const a of (json.answers ?? [])) {
      const serverUpdatedAt = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const local = store[a.sessionQuestionId];
      const submittedAt = a.submittedAt ? new Date(a.submittedAt).getTime() : null;
      if (submittedAt) {
        submittedSet.add(a.sessionQuestionId);
      }
      if (!local || (!local.dirty && serverUpdatedAt >= local.updatedAt)) {
        store[a.sessionQuestionId] = {
          selected: a.selected,
          updatedAt: Math.max(serverUpdatedAt, local?.updatedAt ?? 0),
          dirty: false,
          submittedAt: submittedAt ?? local?.submittedAt ?? null,
        };
      }
    }
    setSubmittedQuestions(submittedSet);
    localAnswersRef.current = store;
    await writeLocalAnswers(props.attemptId, store);
    setPendingCount(computePending(store));
    setAnsweredCount(computeAnsweredCount(store));
    if (current) {
      setSelected(store[current.id]?.selected ?? []);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsOnline(navigator.onLine);
    void (async () => {
      localAnswersRef.current = await readLocalAnswers(props.attemptId);
      setPendingCount(computePending(localAnswersRef.current));
    })();

    const onOnline = () => {
      setIsOnline(true);
      void load();
      void loadQuestions();
      void loadAnswers();
      void syncDirtyAnswers();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    void load().catch(() => setIsOnline(false));
    void loadQuestions().catch(() => setIsOnline(false));
    void loadAnswers().catch(() => setIsOnline(false));
    // Auto-start attempt nếu session đã active và chưa start
    void (async () => {
      const stateRes = await fetch(`/api/attempts/${props.attemptId}/state`, { method: 'GET', headers: deviceHeaders() });
      if (stateRes.ok) {
        const text = await stateRes.text();
        if (text && text.trim().length > 0) {
          try {
            const stateJson = JSON.parse(text) as AttemptState & { error?: string };
            // Nếu session đã active nhưng chưa bắt đầu làm bài, tự động start
            if (stateJson.session.status === 'active' && !stateJson.attemptStartedAt && stateJson.status === 'active') {
              await startAttempt();
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    })();
    const id = window.setInterval(() => {
      if (!navigator.onLine) {
        return;
      }
      void load().catch(() => setIsOnline(false));
    }, 1500);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.attemptId]);

  useEffect(() => {
    const current = questions[idx];
    if (!current) {
      return;
    }
    // Load selected from cache when switching questions
    // Reset selected first to avoid stale state
    const cachedAnswer = localAnswersRef.current[current.id];
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setSelected(cachedAnswer?.selected ?? []);
    // Update submittedQuestions set based on cache
    if (cachedAnswer?.submittedAt != null) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setSubmittedQuestions((prev) => {
        if (prev.has(current.id)) {
          return prev;
        }
        return new Set([...prev, current.id]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, questions.length]);

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/attempts/${props.attemptId}/verifyToken`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const text = await res.text();
      if (!text || text.trim().length === 0) {
        setError('WRONG_TOKEN');
        return;
      }
      let json: { error?: string; ok?: boolean; retryAfterSeconds?: number };
      try {
        json = JSON.parse(text);
      } catch {
        setError('WRONG_TOKEN');
        return;
      }
      if (!res.ok || !json.ok) {
        setError(json.error === 'RATE_LIMITED' ? t('rate_limited', { seconds: json.retryAfterSeconds ?? 60 }) : (json.error ?? 'WRONG_TOKEN'));
        return;
      }
      setToken('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  // Gắn cờ nghi vấn (Task 5.4): chỉ ghi nhận khi đang làm bài trong phiên đang chạy
  useAttemptProctoring(
    props.attemptId,
    !!state && state.status !== 'submitted' && !!state.attemptStartedAt && state.session.status === 'active',
  );

  const exitButton = (
    <Link href={getI18nPath('/dashboard', locale)} className={cn(styles.btn, styles.ledgeBtn)}>
      ←
      {' '}
      {t('back_to_dashboard')}
    </Link>
  );

  if (error) {
    return (
      <ChalkRoom lockViewport ledge={exitButton}>
        <div className={styles.questionArea}>
          <h1 className={cn(styles.title, styles.chalk)}>{t('error_title')}</h1>
          <div className={cn(styles.note, styles.pink)}>{error}</div>
        </div>
      </ChalkRoom>
    );
  }

  if (!state) {
    return (
      <ChalkRoom lockViewport>
        <div className={cn(styles.title, styles.chalk)}>{t('loading')}</div>
      </ChalkRoom>
    );
  }

  const blocked = state.isLocked || (state.due && state.session.status === 'active') || (!isOnline && state.session.status === 'active' && state.nextDueAt !== null);
  const isTimeUp = state.isTimeUp || (timeRemaining !== null && timeRemaining <= 0);
  const isDisabled = isTimeUp || state.status === 'submitted' || !state.attemptStartedAt;
  const q = questions[idx] ?? null;
  const progressPct = questions.length > 0 ? Math.round(((idx + 1) / questions.length) * 100) : 0;
  const showQuestion = q !== null && (state.attemptStartedAt || state.status === 'submitted');
  const isWaitingInLobby = !state.attemptStartedAt && state.status === 'active' && state.session.status === 'lobby' && questions.length > 0;

  const getQuestionStatus = (questionId: string, questionIdx: number) => {
    if (questionIdx === idx) {
      return 'current';
    }
    return submittedQuestions.has(questionId) ? 'submitted' : 'not_submitted';
  };

  const ledge = state.status === 'submitted' || canReview
    ? exitButton
    : (
        <button
          type="button"
          className={cn(styles.btn, styles.ledgeBtn)}
          disabled={busy || blocked || state.status !== 'active' || !isOnline || pendingCount > 0 || isDisabled}
          onClick={() => setShowSubmitConfirm(true)}
        >
          {t('submit_quiz')}
        </button>
      );

  return (
    <>
      <ChalkRoom lockViewport ledge={ledge}>
        {/* Header: title, status, timer */}
        <header className={styles.header}>
          <div className="min-w-0 flex-1">
            <h1 className={cn(styles.title, styles.chalk)}>
              {state.session.sessionName || state.session.quiz.title}
            </h1>
            <div className={cn(styles.meta, styles.dim, 'mt-1')}>
              <span>
                {t('answered_label')}
                :
                {' '}
                <span className={styles.chalk}>{answeredCount}</span>
                /
                {questions.length || '-'}
              </span>
              <span className={cn(styles.tag, isOnline ? styles.green : styles.pink)}>
                {isOnline ? t('status_online') : t('status_offline')}
              </span>
              {pendingCount > 0 && (
                <span className={cn(styles.tag, styles.yellow)} title={t('pending_sync_title')}>
                  ⟳
                  {' '}
                  {pendingCount}
                </span>
              )}
              {state.warning && !blocked && <span className={cn(styles.tag, styles.yellow)}>⚠️</span>}
              {blocked && <span className={cn(styles.tag, styles.pink)}>🔒</span>}
            </div>
          </div>
          {timeRemaining !== null && (
            <div
              className={cn(
                styles.timer,
                styles.chalk,
                timeRemaining < 60 ? styles.pink : timeRemaining < 300 ? styles.yellow : null,
              )}
              aria-label={`${t('time_remaining')} ${timeRemaining}s`}
            >
              {formatTime(timeRemaining)}
            </div>
          )}
        </header>

        <div className={styles.progressTrack} aria-label={`${progressPct}%`}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>

        {syncError && (
          <div className={styles.pink}>
            {t('sync_error')}
            {' '}
            {syncError}
          </div>
        )}

        <div className={styles.main}>
          <section className={styles.questionArea}>
            {/* Lobby: waiting for teacher */}
            {isWaitingInLobby && (
              <div className={cn(styles.note, styles.yellow)}>
                <div className={cn(styles.heading)} style={{ fontSize: '1.8rem' }}>{t('waiting_for_teacher')}</div>
                <div className={cn(styles.dim, 'mt-1')}>{t('can_review_questions_hint')}</div>
              </div>
            )}

            {/* Score after submit */}
            {state.status === 'submitted' && state.grade !== null && state.grade !== undefined && (
              <div className={cn(styles.plainNote, canReview ? styles.green : styles.yellow, 'flex flex-wrap items-baseline gap-x-4 gap-y-1')}>
                <span className={cn(styles.scoreBig)}>
                  {formatGrade(state.grade)}
                  {' / 10'}
                </span>
                <span className={styles.chalk}>{canReview ? t('completed') : t('your_score')}</span>
                {state.correctCount !== null && state.correctCount !== undefined && state.totalQuestions
                  ? <span className={styles.dim}>{t('correct_count', { correct: state.correctCount, total: state.totalQuestions })}</span>
                  : null}
              </div>
            )}

            {/* Submitted but cannot review yet */}
            {state.status === 'submitted' && !canReview && (
              <div className={cn(styles.plainNote, styles.yellow)}>
                <div>{t('cannot_review_yet')}</div>
                <div className={cn(styles.dim, 'mt-1')}>
                  {state.session.status !== 'ended' && t('session_not_ended')}
                  {state.session.status === 'ended' && reviewWindowEnd && (() => {
                    const now = new Date();
                    const windowEnd = new Date(reviewWindowEnd);
                    if (now > windowEnd) {
                      return t('review_window_closed');
                    }
                    const diffMins = Math.ceil((windowEnd.getTime() - now.getTime()) / 60000);
                    return t('review_window_countdown', { minutes: diffMins });
                  })()}
                  {state.session.status === 'ended' && !reviewWindowEnd && t('review_not_allowed')}
                </div>
              </div>
            )}

            {/* Time up */}
            {isTimeUp && state.status === 'active' && !canReview && (
              <div className={cn(styles.note, styles.pink)}>{t('time_up_auto_submit')}</div>
            )}

            {showQuestion && q
              ? (
                  <>
                    <div key={q.id} className={styles.questionEnter}>
                      <div className={styles.questionLabel}>
                        <span className={cn(styles.questionNumber, styles.chalk)}>
                          {t('question')}
                          {' '}
                          {idx + 1}
                          <span className={styles.dim}>
                            /
                            {questions.length}
                          </span>
                        </span>
                        <span className={cn(styles.tag, styles.blue)}>
                          {q.type === 'mcq_single' ? t('select_one') : t('select_multiple')}
                        </span>
                        {submittedQuestions.has(q.id)
                          ? <span className={cn(styles.tag, styles.green)}>{t('submitted')}</span>
                          : !canReview && <span className={cn(styles.tag, styles.dim)}>{t('not_submitted')}</span>}
                        {canReview && q.questionScore !== null && q.questionScore !== undefined && (
                          <span className={styles.yellow}>
                            {t('score')}
                            {' '}
                            {formatGrade(questionPointsOnTenScale(q.questionScore, state.totalQuestions || questions.length))}
                            {' / '}
                            {formatGrade(questionPointsOnTenScale(1, state.totalQuestions || questions.length))}
                          </span>
                        )}
                      </div>

                      <div className={cn(styles.prompt)}>
                        <MathRenderer content={q.prompt} />
                      </div>
                      <QuestionImage url={q.imageUrl} alt={q.imageAlt} className="mb-5" />

                      <div className={styles.options}>
                        {q.options.map((o) => {
                          const optionLabel = String.fromCharCode(65 + o.order); // A, B, C, D...
                          const isSelected = canReview
                            ? (q.studentSelected?.includes(o.order) ?? false)
                            : selected.includes(o.order);
                          const isCorrect = canReview ? (o.isCorrect ?? false) : false;
                          const isCorrectAnswer = canReview && isSelected && isCorrect;
                          const isWrongAnswer = canReview && isSelected && !isCorrect;
                          const isCorrectButNotSelected = canReview && isCorrect && !isSelected;

                          return (
                            <label
                              key={o.order}
                              data-order={o.order}
                              className={cn(
                                styles.option,
                                (canReview || isDisabled) && styles.optionDisabled,
                                !canReview && isSelected && styles.optionSelected,
                                isCorrectAnswer && styles.optionCorrect,
                                isWrongAnswer && styles.optionWrong,
                                isCorrectButNotSelected && styles.optionMissed,
                              )}
                            >
                              {!canReview && (
                                <input
                                  type="checkbox"
                                  className={styles.hiddenInput}
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onChange={(e) => {
                                    if (isDisabled) {
                                      return;
                                    }
                                    if (q.type === 'mcq_single') {
                                      setSelected(e.target.checked ? [o.order] : []);
                                      return;
                                    }
                                    setSelected((prev) => {
                                      if (e.target.checked) {
                                        return [...prev, o.order];
                                      }
                                      return prev.filter(x => x !== o.order);
                                    });
                                  }}
                                />
                              )}
                              <span
                                className={cn(
                                  styles.letter,
                                  styles.chalk,
                                  isSelected && styles.letterCircled,
                                  !canReview && isSelected && styles.yellow,
                                  isCorrectAnswer && styles.green,
                                  isWrongAnswer && styles.pink,
                                  isCorrectButNotSelected && styles.green,
                                )}
                              >
                                {optionLabel}
                              </span>
                              <span
                                className={cn(
                                  styles.optionContent,
                                  isWrongAnswer && styles.wrongText,
                                )}
                              >
                                <MathRenderer content={o.content} />
                              </span>
                              {(isCorrectAnswer || isCorrectButNotSelected) && (
                                <span className={cn(styles.mark, styles.green)} title={t('correct')}>✓</span>
                              )}
                              {isWrongAnswer && <span className={cn(styles.mark, styles.pink)}>✗</span>}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.actions}>
                      <div className={styles.actionsGroup}>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => setIdx(i => Math.max(0, i - 1))}
                          disabled={idx === 0}
                        >
                          ←
                          {' '}
                          {t('previous')}
                        </button>
                        <button
                          type="button"
                          className={styles.btn}
                          onClick={() => setIdx(i => Math.min(questions.length - 1, i + 1))}
                          disabled={idx >= questions.length - 1}
                        >
                          {t('next')}
                          {' '}
                          →
                        </button>
                      </div>
                      {!canReview && (
                        <button
                          type="button"
                          className={cn(styles.btn, styles.btnPrimary)}
                          onClick={() => void submitQuestion(q.id)}
                          disabled={busy || !isOnline || state.status !== 'active' || selected.length === 0 || isDisabled}
                        >
                          {t('submit_this_question')}
                        </button>
                      )}
                      {canReview && <span className={styles.dim}>{t('review_mode')}</span>}
                    </div>
                  </>
                )
              : !isWaitingInLobby && (
                  <div className={cn(styles.note, styles.dim)}>{t('no_questions_in_session')}</div>
                )}
          </section>

          {/* Question list written on the side of the board */}
          {questions.length > 0 && (
            <aside className={styles.side}>
              <div className={cn(styles.sideTitle, styles.chalk)}>{t('question_list')}</div>
              <div className={styles.rule} />
              <div className={styles.navGrid}>
                {questions.map((question, i) => {
                  const status = getQuestionStatus(question.id, i);
                  return (
                    <button
                      key={question.id}
                      type="button"
                      onClick={() => setIdx(i)}
                      className={cn(
                        styles.navItem,
                        status === 'submitted' && styles.navAnswered,
                        status === 'current' && styles.navCurrent,
                      )}
                      aria-current={status === 'current' ? 'true' : undefined}
                      aria-label={t('question_status_aria', {
                        number: i + 1,
                        status: status === 'submitted' ? t('submitted_label') : status === 'current' ? t('current_question') : t('not_submitted'),
                      })}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className={cn(styles.legend, styles.dim)}>
                <span className={styles.yellow}>
                  <span className={cn(styles.legendSwatch, styles.legendCurrent)} aria-hidden="true">1</span>
                  {t('current_question')}
                </span>
                <span className={styles.green}>
                  <span className={cn(styles.legendSwatch, styles.legendSubmitted)} aria-hidden="true">2</span>
                  {t('submitted_label')}
                </span>
                <span>
                  <span className={styles.legendSwatch} aria-hidden="true">3</span>
                  {t('not_submitted')}
                </span>
              </div>
            </aside>
          )}
        </div>
      </ChalkRoom>

      {/* Checkpoint Modal */}
      <Modal
        open={Boolean(blocked)}
        dismissible={false}
        title={t('checkpoint_enter_token')}
        titleClassName="text-center"
        icon={(
          <div className={cn(styles.modalIcon, state.isLocked ? styles.pink : styles.yellow)} aria-hidden="true">
            🔒
          </div>
        )}
      >
        <div className={cn(styles.modalText, 'text-center')}>
          {!isOnline
            ? t('offline_please_online')
            : (state.isLocked ? t('locked_due_to_failures') : t('token_due'))}
        </div>
        <label htmlFor="checkpointToken" className="block">
          <span className={styles.inputLabel}>{t('token')}</span>
          <input
            id="checkpointToken"
            className={styles.tokenInput}
            value={token}
            onChange={e => setToken(e.target.value.replace(/\s/g, ''))}
            disabled={busy || state.inCooldown || !isOnline}
            placeholder="••••••"
            inputMode="numeric"
            maxLength={12}
            autoComplete="one-time-code"
            data-autofocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && token.trim().length > 0 && !state.inCooldown && isOnline) {
                void verify();
              }
            }}
          />
          <span className={cn(styles.inputHint, 'mt-2 block text-center')}>
            {t('enter_token_from_teacher_screen')}
          </span>
        </label>
        <button
          type="button"
          className={cn(styles.btn, styles.solidBtn, 'w-full')}
          onClick={() => void verify()}
          disabled={busy || token.trim().length === 0 || state.inCooldown || !isOnline}
        >
          {busy ? t('verifying') : t('verify')}
        </button>
        {(state.failedCount > 0 || state.inCooldown) && (
          <div className={cn(styles.pink, 'text-center')}>
            {t('wrong')}
            {' '}
            {state.failedCount}
            {state.inCooldown ? t('cooldown_30s') : null}
          </div>
        )}
      </Modal>

      {/* Submit Confirmation Modal */}
      <Modal
        open={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        dismissible={!busy}
        title={t('confirm_submit')}
      >
        <div className={styles.rule} />
        <div className={styles.row}>
          <span className={styles.dim}>{t('total_questions')}</span>
          <span className={styles.chalk}>{questions.length}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.dim}>{t('answered')}</span>
          <span className={styles.green}>{answeredCount}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.dim}>{t('not_answered')}</span>
          <span className={questions.length - answeredCount > 0 ? styles.yellow : styles.chalk}>
            {questions.length - answeredCount}
          </span>
        </div>
        {questions.length - answeredCount > 0 && (
          <div className={cn(styles.note, styles.yellow)} style={{ fontSize: '1.05rem' }}>
            {t('unanswered_warning', { count: questions.length - answeredCount })}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button type="button" className={styles.btn} onClick={() => setShowSubmitConfirm(false)}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={cn(styles.btn, styles.solidBtn)}
            onClick={() => void submit()}
            disabled={busy}
          >
            {busy ? t('submitting') : t('submit_quiz')}
          </button>
        </div>
      </Modal>
    </>
  );
}

function formatTime(seconds: number) {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
// EOF
