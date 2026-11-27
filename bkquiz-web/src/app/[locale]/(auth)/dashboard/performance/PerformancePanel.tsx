'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatGrade } from '@/utils/formatGrade';

type PerformanceData = {
  totalAttempts: number;
  averageScore: number | null;
  highestScore: number | null;
  recentAttempts: Array<{
    id: string;
    /** Điểm thang 10 */
    grade: number | null;
    correctCount: number | null;
    totalQuestions: number | null;
    submittedAt: string | null;
    quizTitle: string;
  }>;
};

export function PerformancePanel() {
  const t = useTranslations('Performance');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPerformance() {
      try {
        const res = await fetch('/api/students/performance');
        if (!res.ok) {
          throw new Error('Failed to load performance data');
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadPerformance();
  }, []);

  function formatDate(dateStr: string | null) {
    if (!dateStr) {
      return '—';
    }
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  if (loading) {
    return (
      <div className="space-y-7">
        <Card className="p-6">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </Card>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="mb-2 h-6 w-24" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-base text-chalk-dim">{t('error')}</div>
        <div className="mt-2 text-chalk/85">
          {error}
        </div>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <Card className="border-chalk-blue/30 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-base text-chalk-blue">{t('title')}</div>
            <h1 className="mt-1 font-chalk text-[1.6rem] leading-tight chalk-glow text-chalk md:text-[2rem]">
              {t('subtitle')}
            </h1>
            <div className="mt-2 text-base text-chalk-dim">
              {t('description')}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-chalk-blue/20 p-6">
          <div className="text-base text-chalk-dim">{t('total_attempts')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-3xl font-semibold text-chalk-blue">{data.totalAttempts}</div>
            <Badge variant="info">{t('attempts')}</Badge>
          </div>
          <div className="mt-2 text-sm text-chalk-dim">
            {t('total_attempts_description')}
          </div>
        </Card>

        <Card className="border-chalk-blue/20 p-6">
          <div className="text-base text-chalk-dim">{t('average_score')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-3xl font-semibold text-chalk-blue">
              {data.averageScore !== null ? data.averageScore.toFixed(1) : '—'}
            </div>
            {data.averageScore !== null && (
              <Badge variant="info">/ 10</Badge>
            )}
          </div>
          <div className="mt-2 text-sm text-chalk-dim">
            {t('average_score_description')}
          </div>
        </Card>

        <Card className="border-chalk-blue/20 p-6">
          <div className="text-base text-chalk-dim">{t('highest_score')}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-3xl font-semibold text-chalk-blue">
              {data.highestScore !== null ? data.highestScore.toFixed(1) : '—'}
            </div>
            {data.highestScore !== null && (
              <Badge variant="success">/ 10</Badge>
            )}
          </div>
          <div className="mt-2 text-sm text-chalk-dim">
            {t('highest_score_description')}
          </div>
        </Card>
      </div>

      {/* Recent Attempts */}
      {data.recentAttempts.length > 0 && (
        <Card className="p-6">
          <div className="mb-4 text-lg font-semibold text-chalk">
            {t('recent_attempts', { count: data.recentAttempts.length })}
          </div>
          <div className="space-y-2">
            {data.recentAttempts.map(attempt => (
              <Link key={attempt.id} href={`/attempt/${attempt.id}`}>
                <div className="flex items-center justify-between gap-4 rounded-hand border border-chalk-faint bg-white/2 px-4 py-3 transition-colors hover:border-chalk-blue/50">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium text-chalk">
                      {attempt.quizTitle}
                    </div>
                    <div className="mt-1 text-sm text-chalk-dim">
                      {t('submitted_at')}
                      {' '}
                      {formatDate(attempt.submittedAt)}
                    </div>
                    {attempt.correctCount !== null && attempt.totalQuestions
                      ? (
                          <div className="mt-1 text-sm text-chalk-dim">
                            {t('correct_count', { correct: attempt.correctCount, total: attempt.totalQuestions })}
                          </div>
                        )
                      : null}
                  </div>
                  <div className="flex items-center gap-3">
                    {attempt.grade !== null
                      ? (
                          <Badge
                            variant={attempt.grade >= 8 ? 'success' : (attempt.grade >= 5 ? 'info' : 'neutral')}
                            className="text-sm"
                          >
                            {formatGrade(attempt.grade)}
                            {' '}
                            / 10
                          </Badge>
                        )
                      : (
                          <Badge variant="neutral" className="text-sm">
                            {t('no_score')}
                          </Badge>
                        )}
                    <span className="text-sm text-chalk-dim">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {data.totalAttempts === 0 && (
        <Card className="p-6">
          <div className="rounded-hand border border-dashed border-chalk-blue/30 px-4 py-8 text-center">
            <div className="text-base text-chalk-dim">
              {t('no_attempts')}
            </div>
            <div className="mt-2 text-sm text-chalk-dim">
              {t('join_sessions_hint')}
            </div>
            <div className="mt-4">
              <Link href="/dashboard/sessions">
                <button
                  type="button"
                  className="rounded-md bg-chalk-blue/20 px-4 py-2 text-base font-medium text-chalk-blue transition-colors hover:bg-chalk-blue/30"
                >
                  {t('view_sessions')}
                </button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
