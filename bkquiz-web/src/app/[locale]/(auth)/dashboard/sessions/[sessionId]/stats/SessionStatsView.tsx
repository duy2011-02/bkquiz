'use client';

import type { QuestionLabel, SessionStats } from '@/server/questionStats';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { MathRenderer } from '@/components/MathRenderer';
import { QuestionImage } from '@/components/QuestionImage';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { FieldLabel, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableWrap } from '@/components/ui/Table';
import { cn } from '@/utils/cn';
import { formatGrade } from '@/utils/formatGrade';
import { getI18nPath } from '@/utils/Helpers';

type StatsResponse = SessionStats & {
  session: {
    id: string;
    status: 'lobby' | 'active' | 'ended';
    title: string;
    classroomName: string;
    joined: number;
    scoringMode: 'all_or_nothing' | 'partial' | 'penalty';
  };
};

type SortKey = 'order' | 'hardest' | 'discrimination';

const LABEL_VARIANT: Record<QuestionLabel, 'danger' | 'success' | 'warning'> = {
  hard: 'danger',
  easy: 'success',
  review: 'warning',
};

const pct = (x: number | null) => (x === null ? '-' : `${Math.round(x * 100)}%`);
const letter = (order: number) => String.fromCharCode(65 + order);

export function SessionStatsView(props: { sessionId: string }) {
  const t = useTranslations('SessionStats');
  const locale = useLocale();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('order');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/sessions/${props.sessionId}/report/questionStats`, { cache: 'no-store' });
        const json = await res.json().catch(() => null) as (StatsResponse & { error?: string }) | null;
        if (cancelled) {
          return;
        }
        if (!res.ok || !json) {
          setError(json?.error ?? `LOAD_FAILED_${res.status}`);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) {
          setError('NETWORK_ERROR');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.sessionId]);

  const screenHref = getI18nPath(`/dashboard/sessions/${props.sessionId}/teacher`, locale);
  const monitorHref = getI18nPath(`/dashboard/sessions/${props.sessionId}/monitor`, locale);

  const breadcrumb = (
    <nav aria-label={t('breadcrumb_dashboard')} className="flex flex-wrap items-center gap-2 text-base text-chalk-dim">
      <Link href={getI18nPath('/dashboard', locale)} className="transition-colors hover:text-chalk">{t('breadcrumb_dashboard')}</Link>
      <span aria-hidden="true">/</span>
      <Link href={screenHref} className="transition-colors hover:text-chalk">{data?.session.title ?? t('breadcrumb_session')}</Link>
      <span aria-hidden="true">/</span>
      <span className="text-chalk">{t('title')}</span>
    </nav>
  );

  if (!data) {
    return (
      <div className="space-y-7">
        {breadcrumb}
        {error
          ? (
              <div className={cn(s.note, s.pink)} role="alert">
                {error === 'FORBIDDEN' ? t('forbidden') : error === 'SESSION_NOT_FOUND' ? t('not_found') : t('error', { error })}
              </div>
            )
          : (
              <Card className="space-y-3 p-5 md:p-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-40 w-full" />
              </Card>
            )}
      </div>
    );
  }

  const { session, summary, histogram, questions } = data;
  const maxBin = Math.max(1, ...histogram.map(b => b.count));
  // % điểm đạt được → thang 10 (cùng cách hiển thị với các trang khác)
  const fmtTen = (x: number | null) => (x === null ? '-' : `${formatGrade(x / 10)}/10`);

  const sorted = [...questions].sort((a, b) => {
    if (sort === 'hardest') {
      return (a.correctRate ?? 2) - (b.correctRate ?? 2) || a.order - b.order;
    }
    if (sort === 'discrimination') {
      return (a.discrimination ?? 2) - (b.discrimination ?? 2) || a.order - b.order;
    }
    return a.order - b.order;
  });

  const kpis = [
    { label: t('kpi_submitted'), value: String(summary.submitted), sub: t('kpi_joined', { joined: session.joined }) },
    { label: t('kpi_mean'), value: fmtTen(summary.meanPercent), sub: t(`scoring_${session.scoringMode}`) },
    { label: t('kpi_median'), value: fmtTen(summary.medianPercent), sub: null },
    {
      label: t('kpi_range'),
      value: summary.minPercent === null ? '-' : `${formatGrade(summary.minPercent / 10)} – ${fmtTen(summary.maxPercent)}`,
      sub: null,
    },
  ];

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
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={monitorHref} className={cn(s.btn, s.btnSm)}>{t('open_monitor')}</Link>
            <Link href={screenHref} className={cn(s.btn, s.btnSm)}>{t('back_to_screen')}</Link>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map(k => (
            <div key={k.label} className="rounded-hand border-2 border-chalk-faint p-3">
              <dt className="text-base text-chalk-dim">{k.label}</dt>
              <dd className="mt-1 text-3xl leading-tight font-bold tabular-nums chalk-glow text-chalk">{k.value}</dd>
              {k.sub ? <dd className="mt-1 text-sm text-chalk-dim">{k.sub}</dd> : null}
            </div>
          ))}
        </dl>

        {session.status !== 'ended'
          ? <div className={cn(s.note, s.yellow, 'mt-4')} role="status">{t('not_ended_note')}</div>
          : null}
      </Card>

      {summary.submitted === 0
        ? <div className={cn(s.note, s.dim)}>{t('empty')}</div>
        : (
            <>
              {/* Phân bố điểm: 1 chuỗi → 1 màu (chalk-blue), không cần chú giải; số liệu đầy đủ ở bảng bên dưới */}
              <Card className="p-5 md:p-6">
                <h2 className="text-lg font-semibold text-chalk">{t('histogram_heading')}</h2>
                <p className="mt-1 text-base text-chalk-dim">{t('histogram_hint')}</p>
                <ul className="mt-5 flex h-44 items-end gap-[2px] border-b-2 border-chalk-dim" aria-label={t('histogram_heading')}>
                  {histogram.map(b => (
                    <li
                      key={b.from}
                      className="group relative flex h-full flex-1 flex-col items-center justify-end"
                      title={t('bin_tooltip', { from: b.from, to: b.to, count: b.count })}
                    >
                      {b.count > 0
                        ? <span className="mb-1 font-mono text-sm text-chalk-dim" aria-hidden="true">{b.count}</span>
                        : null}
                      <span
                        className="w-full rounded-t-[4px] bg-chalk-blue transition-opacity group-hover:opacity-80"
                        style={{ height: `${(b.count / maxBin) * 85}%` }}
                        aria-hidden="true"
                      />
                      <span className="sr-only">{t('bin_tooltip', { from: b.from, to: b.to, count: b.count })}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-1 flex gap-[2px] font-mono text-xs text-chalk-dim" aria-hidden="true">
                  {histogram.map(b => (
                    <span key={b.from} className="flex-1 text-center">{b.from}</span>
                  ))}
                </div>

                <details className="mt-4">
                  <summary className="cursor-pointer text-base text-chalk-dim hover:text-chalk">{t('show_table')}</summary>
                  <TableWrap className="mt-2">
                    <Table>
                      <thead>
                        <tr>
                          <th scope="col">{t('col_range')}</th>
                          <th scope="col">{t('col_count')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {histogram.map(b => (
                          <tr key={b.from}>
                            <td className="font-mono">{b.to === 100 ? `${b.from}–100%` : `${b.from}–<${b.to}%`}</td>
                            <td className="font-mono">{b.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                </details>
              </Card>

              <Card className="p-5 md:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-lg font-semibold text-chalk">{t('questions_heading', { count: questions.length })}</h2>
                  <div className="w-full sm:w-64">
                    <FieldLabel htmlFor="stats-sort">{t('sort_label')}</FieldLabel>
                    <Select id="stats-sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}>
                      <option value="order">{t('sort_order')}</option>
                      <option value="hardest">{t('sort_hardest')}</option>
                      <option value="discrimination">{t('sort_discrimination')}</option>
                    </Select>
                  </div>
                </div>
                <p className="mt-2 text-base text-chalk-dim">{t('metrics_note')}</p>

                <ol className="mt-4 space-y-3">
                  {sorted.map(q => (
                    <li key={q.id}>
                      <details className={cn(s.box, 'p-4')}>
                        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-chalk-dim">{t('question_n', { n: q.order + 1 })}</span>
                          <span className="min-w-[10rem] flex-1 truncate font-sans text-chalk/85">{q.prompt}</span>
                          <span className="text-base text-chalk-dim">
                            {t('correct_short')}
                            {' '}
                            <span className="font-mono text-chalk">{pct(q.correctRate)}</span>
                          </span>
                          <span className="text-base text-chalk-dim">
                            {t('discrimination_short')}
                            {' '}
                            <span className="font-mono text-chalk">{q.discrimination === null ? '-' : q.discrimination.toFixed(2)}</span>
                          </span>
                          {q.labels.map(l => (
                            <Badge key={l} variant={LABEL_VARIANT[l]}>{t(`label_${l}`)}</Badge>
                          ))}
                        </summary>

                        <div className="mt-4 space-y-4">
                          <MathRenderer content={q.prompt} className="font-sans text-chalk" />
                          <QuestionImage url={q.imageUrl} alt={q.imageAlt} size="sm" />
                          <p className="text-base text-chalk-dim">
                            {t('question_meta', {
                              n: q.n,
                              avg: pct(q.avgScore),
                              unanswered: pct(q.unansweredRate),
                            })}
                          </p>
                          <ul className="space-y-2">
                            {q.options.map((o) => {
                              const isTopDistractor = q.topDistractor === o.order;
                              return (
                                <li key={o.order} className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,3fr)]">
                                  <span className={cn('font-mono', o.isCorrect ? 'text-chalk-green' : 'text-chalk-dim')}>
                                    {letter(o.order)}
                                    .
                                  </span>
                                  <div className="min-w-0">
                                    <MathRenderer content={o.content} className="font-sans text-chalk/85" />
                                    {o.isCorrect || isTopDistractor
                                      ? (
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {o.isCorrect ? <Badge variant="success">{t('correct_answer')}</Badge> : null}
                                            {isTopDistractor ? <Badge variant="warning">{t('top_distractor')}</Badge> : null}
                                          </div>
                                        )
                                      : null}
                                  </div>
                                  <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                                    <div className="h-3 flex-1 overflow-hidden rounded-[3px] bg-white/10" aria-hidden="true">
                                      <div
                                        className={cn('h-full rounded-r-[4px]', o.isCorrect ? 'bg-chalk-green' : isTopDistractor ? 'bg-chalk-yellow' : 'bg-chalk-dim')}
                                        style={{ width: `${(o.rate ?? 0) * 100}%` }}
                                      />
                                    </div>
                                    <span className="w-24 shrink-0 text-right font-mono text-sm text-chalk">
                                      {o.count}
                                      {' '}
                                      <span className="text-chalk-dim">
                                        (
                                        {pct(o.rate)}
                                        )
                                      </span>
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </details>
                    </li>
                  ))}
                </ol>
              </Card>
            </>
          )}
    </div>
  );
}
