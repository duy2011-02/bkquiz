'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { MathRenderer } from '@/components/MathRenderer';
import { QuestionImage } from '@/components/QuestionImage';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';

type Question = {
  id: string;
  order: number;
  type: 'mcq_single' | 'mcq_multi';
  prompt: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  sourceQuestionId: string;
  options: Array<{
    order: number;
    content: string;
    isCorrect: boolean;
  }>;
  tag?: {
    id: string;
    name: string;
    normalizedName: string;
  };
};

type SessionInfo = {
  id: string;
  status: 'lobby' | 'active' | 'ended';
  quiz: {
    title: string;
  };
  classroom: {
    name: string;
  };
};

type QuestionsResponse = {
  questions: Question[];
  total: number;
  sessionId: string;
};

export function QuestionsView(props: { sessionId: string; userId: string | null }) {
  const t = useTranslations('SessionQuestions');
  const tSessions = useTranslations('Sessions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQuestions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/questions`, { method: 'GET' });
      if (!res.ok) {
        const text = await res.text();
        let json: QuestionsResponse & { error?: string };
        try {
          json = JSON.parse(text);
        } catch {
          setError(`LOAD_FAILED: ${res.status} ${res.statusText}`);
          return;
        }
        setError(json.error ?? 'LOAD_FAILED');
        return;
      }
      const text = await res.text();
      if (!text) {
        setError('LOAD_FAILED: Empty response');
        return;
      }
      let json: QuestionsResponse & { error?: string };
      try {
        json = JSON.parse(text);
      } catch (err) {
        setError('LOAD_FAILED: Invalid JSON response');
        console.error('Failed to parse response:', text, err);
        return;
      }
      setQuestions(json.questions ?? []);
    } catch (err) {
      setError(`LOAD_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error loading questions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSession() {
    try {
      const res = await fetch(`/api/sessions/${props.sessionId}/status`, { method: 'GET' });
      if (!res.ok) {
        return;
      }
      const text = await res.text();
      if (!text) {
        return;
      }
      let json: SessionInfo & { error?: string };
      try {
        json = JSON.parse(text);
      } catch (err) {
        console.error('Failed to parse session response:', text, err);
        return;
      }
      setSession(json);
    } catch (err) {
      console.error('Error loading session:', err);
    }
  }

  useEffect(() => {
    void loadQuestions();
    void loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.sessionId]);

  if (loading) {
    return (
      <div className="space-y-7">
        <nav className="text-base">
          <div className="flex items-center gap-2 text-chalk-dim">
            <Skeleton className="h-4 w-20" />
            <span>·</span>
            <Skeleton className="h-4 w-24" />
            <span>·</span>
            <Skeleton className="h-4 w-20" />
          </div>
        </nav>
        <Card className="p-5 md:p-6">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </Card>
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-5 md:p-6">
              <Skeleton className="mb-4 h-6 w-32" />
              <Skeleton className="mb-2 h-4 w-full" />
              <Skeleton className="mb-4 h-4 w-3/4" />
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-7">
        <nav className="text-base">
          <div className="flex items-center gap-2 text-chalk-dim">
            <Link href="/dashboard" className="transition-colors hover:text-chalk">
              {t('breadcrumb_dashboard')}
            </Link>
            <span>·</span>
            <Link href="/dashboard/sessions" className="transition-colors hover:text-chalk">
              {t('breadcrumb_sessions')}
            </Link>
            <span>·</span>
            <span className="text-chalk">{t('breadcrumb_questions')}</span>
          </div>
        </nav>
        <Card className="p-5 md:p-6">
          <div className="rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-4 text-center text-chalk-pink">
            {error === 'SESSION_NOT_FOUND'
              ? t('session_not_found')
              : error === 'FORBIDDEN'
                ? t('forbidden')
                : t('error', { error })}
          </div>
        </Card>
      </div>
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
          <Link href="/dashboard/sessions" className="transition-colors hover:text-chalk">
            {t('breadcrumb_sessions')}
          </Link>
          <span>·</span>
          <span className="text-chalk">{t('breadcrumb_questions')}</span>
        </div>
      </nav>

      {/* Header Card */}
      <Card className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-chalk text-[1.6rem] leading-tight chalk-glow text-chalk md:text-[2rem]">
              {t('title')}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-base text-chalk-dim">
              {session?.quiz?.title && (
                <>
                  <span>{session.quiz.title}</span>
                  <span>·</span>
                </>
              )}
              {session?.classroom?.name && (
                <>
                  <span>{session.classroom.name}</span>
                  <span>·</span>
                </>
              )}
              <span>
                {t('questions_count', { count: questions.length })}
              </span>
              {session?.status && (
                <>
                  <span>·</span>
                  <Badge
                    variant={
                      session.status === 'active'
                        ? 'success'
                        : session.status === 'ended'
                          ? 'neutral'
                          : 'info'
                    }
                  >
                    {tSessions(`badge_${session.status}`)}
                  </Badge>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session?.status === 'lobby' && (
              <Link href={`/dashboard/sessions/${props.sessionId}/teacher`} className={cn(s.btn, s.btnPrimary, s.btnSm)}>{t('go_to_teacher_screen')}</Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => void loadQuestions()}>
              {t('refresh')}
            </Button>
            <Link href="/dashboard/sessions" className={cn(s.btn, s.btnSm)}>{t('back')}</Link>
          </div>
        </div>
      </Card>

      {/* Questions List */}
      <Card className="p-5 md:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-chalk">
            {t('questions_heading', { count: questions.length })}
          </h2>
        </div>

        <div className="mt-4 space-y-3">
          {questions.length === 0
            ? (
                <div className="rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center text-base text-chalk-dim">
                  {session?.status === 'lobby'
                    ? t('building_questions')
                    : t('no_questions')}
                </div>
              )
            : (
                questions.map((question, index) => (
                  <Card key={question.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Metadata */}
                        <div className="flex items-center gap-2 text-base text-chalk-dim">
                          <span className="font-mono">
                            {t('question_number', { current: index + 1, total: questions.length })}
                          </span>
                          <span>·</span>
                          <Badge variant="neutral" className="text-sm">
                            {question.type === 'mcq_single' ? t('single_choice') : t('multiple_choice')}
                          </Badge>
                          {question.tag && (
                            <>
                              <span>·</span>
                              <Badge variant="info" className="text-sm">
                                {question.tag.name}
                              </Badge>
                            </>
                          )}
                        </div>

                        {/* Prompt */}
                        <div className="mt-2 text-base text-chalk/85">
                          <MathRenderer content={question.prompt} className="font-sans" />
                          <QuestionImage url={question.imageUrl} alt={question.imageAlt} className="mt-3" />
                        </div>

                        {/* Options */}
                        <div className="mt-3 space-y-1">
                          {question.options.map((option, optIdx) => {
                            const optionLabel = String.fromCharCode(65 + optIdx); // A, B, C, D...
                            const isCorrect = option.isCorrect;
                            return (
                              <div key={`${question.id}-opt-${option.order}`} className="flex items-start gap-2 text-base">
                                <div className="w-6 shrink-0 font-mono text-chalk-dim">
                                  {optionLabel}
                                  .
                                </div>
                                <div className={isCorrect ? 'font-medium text-chalk-green' : 'text-chalk/85'}>
                                  <MathRenderer content={option.content} className="font-sans" />
                                  {isCorrect && (
                                    <Badge variant="success" className="ml-2 text-sm">
                                      {t('correct')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
        </div>
      </Card>
    </div>
  );
}
