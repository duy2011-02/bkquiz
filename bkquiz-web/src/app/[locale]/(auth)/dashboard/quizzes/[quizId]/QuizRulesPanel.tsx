'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Table, TableWrap } from '@/components/ui/Table';
import { TagInput } from '@/components/ui/TagInput';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { duplicateQuiz } from '../duplicateQuiz';

type PoolLite = { id: string; name: string; visibility: 'private' | 'shared'; permission?: 'view' | 'use' | 'edit' };
type RuleRow = {
  id: string;
  count: number | null;
  commonCount: number | null;
  variantCount: number | null;
  extraPercent: number | null;
  filters: any;
  tag: { id: string; name: string; normalizedName: string };
};
type QuizRulesResponse = { rules: RuleRow[] };
type PoolsResponse = { owned: PoolLite[]; shared: PoolLite[] };
type QuizSettingsResponse = {
  durationSeconds?: number | null;
  variant?: { defaultExtraPercent: number };
  scoring?: { mode: ScoringMode; partialCreditMethod: PartialMethod; penaltyPerWrongOption: number };
};
type ScoringMode = 'all_or_nothing' | 'partial' | 'penalty';
type PartialMethod = 'edc' | 'halves';
type TagSuggestion = { id: string; name: string; normalizedName: string; questionCount: number };
const mono = (chunks: ReactNode) => <span className="font-mono">{chunks}</span>;
const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;

type QuizInfo = {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  updatedAt: string;
  createdAt: string;
};

export function QuizRulesPanel(props: { quizId: string; userId: string | null }) {
  const t = useTranslations('Quizzes.detail');
  const tQuizzes = useTranslations('Quizzes');
  const locale = useLocale();
  const router = useRouter();
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [pools, setPools] = useState<PoolLite[]>([]);
  const [preview, setPreview] = useState<null | {
    totals: { totalRequested: number; totalPoolSize: number; totalShortage: number };
    rows: Array<{
      ruleId: string;
      tag: { name: string; normalizedName: string };
      requested: number;
      poolSize: number;
      available: number;
      shortage: number;
      poolIds: string[];
    }>;
  }>(null);
  const [tag, setTag] = useState('');
  const [mode, setMode] = useState<'same' | 'variant'>('same');
  const [count, setCount] = useState(5);
  const [commonCount, setCommonCount] = useState(5);
  const [variantCount, setVariantCount] = useState(1);
  const [extraPercent, setExtraPercent] = useState(0.2);
  const [defaultExtraPercent, setDefaultExtraPercent] = useState(0.2);
  const [useDefaultExtra, setUseDefaultExtra] = useState(true);
  const [selectedPoolIds, setSelectedPoolIds] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showDefaultExtra, setShowDefaultExtra] = useState(false);
  const [poolSearchQuery, setPoolSearchQuery] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [scoringMode, setScoringMode] = useState<ScoringMode>('all_or_nothing');
  const [partialMethod, setPartialMethod] = useState<PartialMethod>('edc');
  const [penaltyPerWrong, setPenaltyPerWrong] = useState(0.25);

  // Tags state
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<Array<{ id: string; name: string; normalizedName: string }>>([]);
  const [tagsBusy, setTagsBusy] = useState(false);

  const poolById = useMemo(() => new Map(pools.map(p => [p.id, p])), [pools]);
  const selectedTagInfo = useMemo(
    () => tagSuggestions.find(s => s.normalizedName === tag) ?? null,
    [tagSuggestions, tag],
  );
  const projectedQuestions = mode === 'same' ? count : commonCount + variantCount;

  // Auto-adjust count nếu tag có ít câu hơn số đã nhập khi chọn tag mới
  useEffect(() => {
    if (tag && selectedTagInfo) {
      if (mode === 'same' && count > selectedTagInfo.questionCount) {
        setCount(selectedTagInfo.questionCount);
      }
      if (mode === 'variant') {
        const total = commonCount + variantCount;
        if (total > selectedTagInfo.questionCount) {
          // Giữ tỉ lệ commonCount/variantCount nhưng giảm tổng
          const ratio = total > 0 ? commonCount / total : 0.5;
          const newTotal = selectedTagInfo.questionCount;
          setCommonCount(Math.floor(newTotal * ratio));
          setVariantCount(newTotal - Math.floor(newTotal * ratio));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag, selectedTagInfo?.questionCount, mode]); // Chỉ chạy khi tag/mode thay đổi
  const totalRequestedFromRules = useMemo(
    () =>
      rules.reduce((acc, r) => {
        if (typeof r.count === 'number' && r.count > 0) {
          return acc + r.count;
        }
        const common = r.commonCount ?? 0;
        const variant = r.variantCount ?? 0;
        return acc + common + variant;
      }, 0),
    [rules],
  );

  async function fetchTagSuggestions(query: string) {
    const q = query.trim();
    try {
      const url = q ? `/api/tags?q=${encodeURIComponent(q)}` : '/api/tags';
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        return;
      }
      const json = await res.json() as { tags?: TagSuggestion[] };
      setTagSuggestions(json.tags ?? []);
    } catch {
      // ignore suggestion errors – không chặn flow chính
    }
  }

  async function load() {
    setError(null);
    const [qRes, rRes, pRes] = await Promise.all([
      fetch(`/api/quizzes/${props.quizId}`, { method: 'GET' }),
      fetch(`/api/quizzes/${props.quizId}/rules`, { method: 'GET' }),
      fetch('/api/pools', { method: 'GET' }),
    ]);
    const qJson = await qRes.json() as QuizInfo & { error?: string };
    const rJson = await rRes.json() as QuizRulesResponse & { error?: string };
    const pJson = await pRes.json() as PoolsResponse & { error?: string };
    if (!qRes.ok) {
      setError(qJson.error ?? 'LOAD_QUIZ_FAILED');
      return;
    }
    if (!rRes.ok) {
      setError(rJson.error ?? 'LOAD_RULES_FAILED');
      return;
    }
    if (!pRes.ok) {
      setError(pJson.error ?? 'LOAD_POOLS_FAILED');
      return;
    }
    setQuizInfo(qJson);
    setRules(rJson.rules ?? []);
    setPools([...(pJson.owned ?? []), ...(pJson.shared ?? [])]);

    // settings (defaultExtraPercent, durationSeconds)
    const sRes = await fetch(`/api/quizzes/${props.quizId}/settings`, { method: 'GET' });
    const sJson = await sRes.json() as QuizSettingsResponse & { error?: string };
    if (sRes.ok) {
      if (sJson.variant && typeof sJson.variant.defaultExtraPercent === 'number') {
        setDefaultExtraPercent(sJson.variant.defaultExtraPercent);
      }
      if (typeof sJson.durationSeconds === 'number') {
        setDurationMinutes(Math.round(sJson.durationSeconds / 60));
      } else {
        setDurationMinutes(null);
      }
      if (sJson.scoring) {
        setScoringMode(sJson.scoring.mode);
        setPartialMethod(sJson.scoring.partialCreditMethod);
        setPenaltyPerWrong(sJson.scoring.penaltyPerWrongOption);
      }
    }
  }

  async function loadTags() {
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/tags`);
      const json = await res.json() as { tags?: Array<{ id: string; name: string; normalizedName: string }>; error?: string };
      if (res.ok) {
        setTags(json.tags ?? []);
        setTagsInput(json.tags?.map(t => t.name).join(', ') ?? '');
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  }

  async function saveTags() {
    setTagsBusy(true);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/tags`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tagsInput }),
      });
      const json = await res.json() as { tags?: Array<{ id: string; name: string; normalizedName: string }>; error?: string };
      if (res.ok) {
        setTags(json.tags ?? []);
        setToast({ message: t('tags_saved'), type: 'success' });
      } else {
        setToast({ message: json.error ?? t('tags_save_error'), type: 'error' });
      }
    } catch (err) {
      console.error('Error saving tags:', err);
      setToast({ message: t('tags_save_error'), type: 'error' });
    } finally {
      setTagsBusy(false);
    }
  }

  useEffect(() => {
    void load();
    void fetchTagSuggestions('');
    void loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.quizId]);

  async function saveRule() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/rules`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tag,
          mode,
          count: mode === 'same' ? count : undefined,
          commonCount: mode === 'variant' ? commonCount : undefined,
          variantCount: mode === 'variant' ? variantCount : undefined,
          extraPercent: (mode === 'variant' && !useDefaultExtra) ? extraPercent : undefined,
          poolIds: selectedPoolIds,
        }),
      });
      if (!res.ok) {
        let errorMessage = 'SAVE_FAILED';
        try {
          const errorJson = await res.json() as { error?: string };
          errorMessage = errorJson.error ?? 'SAVE_FAILED';
        } catch {
          // Response không phải JSON, dùng message mặc định
        }
        setError(errorMessage);
        setToast({ message: t('rule_save_failed'), type: 'error' });
        return;
      }
      const json = await res.json() as { ok?: boolean; rule?: any; error?: string };
      if (!json.ok) {
        setError(json.error ?? 'SAVE_FAILED');
        setToast({ message: t('rule_save_failed'), type: 'error' });
        return;
      }
      setTag('');
      setMode('same');
      setCount(5);
      setCommonCount(5);
      setVariantCount(1);
      setExtraPercent(0.2);
      setUseDefaultExtra(true);
      setSelectedPoolIds([]);
      setToast({ message: t('rule_saved'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveDefaultExtra() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ variant: { defaultExtraPercent } }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'SAVE_SETTINGS_FAILED');
        setToast({ message: t('settings_save_failed'), type: 'error' });
        return;
      }
      setToast({ message: t('default_settings_saved'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveDuration() {
    if (durationMinutes === null || durationMinutes < 1) {
      setToast({ message: t('duration_required'), type: 'error' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ durationSeconds: durationMinutes * 60 }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'SAVE_DURATION_FAILED');
        setToast({ message: t('duration_save_failed'), type: 'error' });
        return;
      }
      setToast({ message: t('duration_saved'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveScoring() {
    if (!(penaltyPerWrong >= 0 && penaltyPerWrong <= 1)) {
      setToast({ message: t('scoring_penalty_invalid'), type: 'error' });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/settings`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scoring: { mode: scoringMode, partialCreditMethod: partialMethod, penaltyPerWrongOption: penaltyPerWrong },
        }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'SAVE_SCORING_FAILED');
        setToast({ message: t('scoring_save_failed'), type: 'error' });
        return;
      }
      setToast({ message: t('scoring_saved'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!quizInfo || quizInfo.status !== 'draft') {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'PUBLISH_FAILED');
        setToast({ message: t('publish_failed'), type: 'error' });
        return;
      }
      setToast({ message: t('published_success'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveTitle() {
    const title = titleInput.trim();
    if (!title) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'RENAME_FAILED');
        setToast({ message: t('rename_failed'), type: 'error' });
        return;
      }
      setEditingTitle(false);
      setToast({ message: t('renamed_success'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate() {
    if (!quizInfo) {
      return;
    }
    setBusy(true);
    try {
      const result = await duplicateQuiz(quizInfo.id, tQuizzes('copy_title', { title: quizInfo.title }));
      if ('error' in result) {
        setToast({ message: tQuizzes('duplicate_failed'), type: 'error' });
        return;
      }
      setToast({ message: tQuizzes('duplicate_success'), type: 'success' });
      router.push(`/dashboard/quizzes/${result.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function setArchived(archived: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: archived ? 'archived' : 'draft' }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'UPDATE_STATUS_FAILED');
        setToast({ message: t('status_update_failed'), type: 'error' });
        return;
      }
      setToast({ message: archived ? t('archived_success') : t('unarchived_success'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuiz() {
    if (!quizInfo || !window.confirm(t('confirm_delete_quiz', { title: quizInfo.title }))) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}`, { method: 'DELETE' });
      const json = await res.json() as { error?: string; sessionCount?: number };
      if (!res.ok) {
        setToast({
          message: json.error === 'QUIZ_HAS_SESSIONS'
            ? t('delete_quiz_has_sessions', { count: json.sessionCount ?? 0 })
            : t('delete_quiz_failed'),
          type: 'error',
        });
        return;
      }
      router.push('/dashboard/quizzes');
    } finally {
      setBusy(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  async function loadPreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${props.quizId}/preview`, { method: 'GET' });
      const json = await res.json() as any;
      if (!res.ok) {
        setError(json.error ?? 'PREVIEW_FAILED');
        return;
      }
      setPreview({ totals: json.totals, rows: json.rows });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <nav className="text-base">
        <div className="flex items-center gap-2 text-chalk-dim">
          <Link href="/dashboard" className="hover:text-chalk">
            {t('breadcrumb_dashboard')}
          </Link>
          <span>·</span>
          <Link href="/dashboard/quizzes" className="hover:text-chalk">
            {t('breadcrumb_quizzes')}
          </Link>
          {quizInfo && (
            <>
              <span>·</span>
              <span className="truncate text-chalk">{quizInfo.title}</span>
            </>
          )}
        </div>
      </nav>

      {/* Quiz Header */}
      {quizInfo && (
        <Card className="p-5 md:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {editingTitle
                  ? (
                      <form
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveTitle();
                        }}
                      >
                        <Input
                          aria-label={t('title_label')}
                          value={titleInput}
                          onChange={e => setTitleInput(e.target.value)}
                          maxLength={200}
                          disabled={busy}
                          className="flex-1"
                        />
                        <Button type="submit" variant="primary" size="sm" disabled={busy || titleInput.trim() === ''}>
                          {t('save')}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditingTitle(false)}>
                          {t('cancel')}
                        </Button>
                      </form>
                    )
                  : (
                      <>
                        <h1 className="min-w-0 font-chalk text-[1.6rem] leading-tight break-words chalk-glow text-chalk md:text-[2rem]">
                          {quizInfo.title}
                        </h1>
                        <button
                          type="button"
                          className="flex-shrink-0 text-base text-chalk-dim transition-colors hover:text-chalk"
                          aria-label={t('rename')}
                          title={t('rename')}
                          onClick={() => {
                            setTitleInput(quizInfo.title);
                            setEditingTitle(true);
                          }}
                        >
                          ✏️
                        </button>
                      </>
                    )}
                <Badge
                  variant={
                    quizInfo.status === 'published'
                      ? 'success'
                      : quizInfo.status === 'archived'
                        ? 'neutral'
                        : 'info'
                  }
                >
                  {tQuizzes(quizInfo.status)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-base text-chalk-dim">
                <span>
                  {t('updated_at')}
                  {' '}
                  {formatDate(quizInfo.updatedAt)}
                </span>
                <span>·</span>
                <span className="font-mono text-sm">
                  ID:
                  {' '}
                  {quizInfo.id.slice(0, 8)}
                  ...
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/dashboard/quizzes" className={cn(s.btn, s.btnSm)}>{t('back')}</Link>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void handleDuplicate()}>
                {tQuizzes('duplicate')}
              </Button>
              {quizInfo.status === 'draft' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handlePublish()}
                  disabled={busy || rules.length === 0}
                >
                  {t('publish_quiz')}
                </Button>
              )}
            </div>
          </div>
          {error
            ? (
                <div className="mt-3 rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-3 text-base text-chalk-pink">
                  {error}
                </div>
              )
            : null}
        </Card>
      )}

      {/* Tags Section */}
      {quizInfo && (
        <Card className="p-5 md:p-6">
          <div className="space-y-2">
            <label className="text-base font-medium text-chalk">
              {t('tags_label')}
            </label>
            <TagInput
              value={tagsInput}
              onChange={setTagsInput}
              onSave={saveTags}
              tags={tags}
              showSaveButton={true}
              disabled={tagsBusy}
              placeholder="midterm, 2025, practice..."
            />
          </div>
        </Card>
      )}

      {/* Rules List - Hiển thị trước */}
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-chalk">{t('rules_title')}</div>
            <div className="mt-1 text-base text-chalk-dim">
              {t.rich('total_expected', {
                count: totalRequestedFromRules,
                strong: chunks => <span className="font-mono text-base font-semibold text-chalk">{chunks}</span>,
              })}
            </div>
          </div>
        </div>
        {rules.length === 0
          ? (
              <div className="mt-6 py-8 text-center">
                <div className="text-base text-chalk-dim">
                  {t('no_rules')}
                </div>
                <div className="mt-2 text-sm text-chalk-dim">
                  {t('no_rules_hint')}
                </div>
              </div>
            )
          : (
              <div className="mt-4 space-y-3">
                {rules.map((r) => {
                  const ruleMode: 'same' | 'variant' = (r.commonCount ?? 0) > 0 || (r.variantCount ?? 0) > 0 ? 'variant' : 'same';
                  const questionCount = ruleMode === 'same' ? (r.count ?? 0) : ((r.commonCount ?? 0) + (r.variantCount ?? 0));
                  return (
                    <div
                      key={r.id}
                      className="rounded-hand border border-chalk-faint bg-white/2 transition-colors hover:border-chalk-dim"
                    >
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-4 md:grid-cols-[120px_100px_auto]">
                          <Badge variant="info" className="text-sm">
                            {r.tag.name}
                          </Badge>
                          <span className="text-base font-medium text-chalk">
                            {t('questions_count', { count: questionCount })}
                          </span>
                          <Badge variant={ruleMode === 'variant' ? 'warning' : 'neutral'} className="text-sm">
                            {ruleMode === 'variant' ? t('variant_set') : t('same_set')}
                          </Badge>
                        </div>
                        <button
                          type="button"
                          className="flex-shrink-0 text-base text-chalk-dim transition-colors hover:text-chalk-pink"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                              const res = await fetch(
                                `/api/quizzes/${props.quizId}/rules?ruleId=${encodeURIComponent(r.id)}`,
                                { method: 'DELETE' },
                              );
                              const json = await res.json() as { error?: string };
                              if (!res.ok) {
                                setError(json.error ?? 'DELETE_FAILED');
                                setToast({ message: t('rule_delete_failed'), type: 'error' });
                                return;
                              }
                              setToast({ message: t('rule_deleted'), type: 'success' });
                              await load();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </Card>

      {/* Quiz Settings - Time Limit */}
      <Card className="p-5 md:p-6">
        <div className="text-lg font-semibold text-chalk">{t('step1_title')}</div>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <label className="text-base font-medium text-chalk" htmlFor="durationMinutes">
              {t('duration_label')}
            </label>
            <div className="flex items-center gap-3">
              <Input
                id="durationMinutes"
                type="number"
                min={1}
                max={1440}
                value={durationMinutes ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  setDurationMinutes(val);
                }}
                placeholder={t('duration_placeholder')}
                disabled={busy}
                className="w-32"
              />
              <span className="text-base text-chalk-dim">
                {durationMinutes !== null && durationMinutes > 0
                  ? (
                      <>
                        (
                        {durationMinutes >= 60
                          ? (durationMinutes % 60 > 0
                              ? t('hours_minutes', { hours: Math.floor(durationMinutes / 60), minutes: durationMinutes % 60 })
                              : t('hours_only', { hours: Math.floor(durationMinutes / 60) }))
                          : t('minutes_only', { minutes: durationMinutes })}
                        )
                      </>
                    )
                  : t('no_time_limit')}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void saveDuration()}
                disabled={busy || durationMinutes === null || durationMinutes < 1}
              >
                {t('save')}
              </Button>
            </div>
            <div className="text-sm text-chalk-dim">
              {t('duration_hint')}
            </div>
          </div>

          {/* Chế độ chấm điểm */}
          <div className="grid gap-2 border-t border-chalk-faint pt-4">
            <label className="text-base font-medium text-chalk" htmlFor="scoringMode">
              {t('scoring_label')}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                id="scoringMode"
                className={cn(s.field, 'w-auto')}
                value={scoringMode}
                onChange={e => setScoringMode(e.target.value as ScoringMode)}
                disabled={busy}
              >
                <option value="all_or_nothing">{t('scoring_mode_all_or_nothing')}</option>
                <option value="partial">{t('scoring_mode_partial')}</option>
                <option value="penalty">{t('scoring_mode_penalty')}</option>
              </select>

              {scoringMode === 'partial' && (
                <select
                  id="partialMethod"
                  aria-label={t('scoring_partial_method_label')}
                  className={cn(s.field, 'w-auto')}
                  value={partialMethod}
                  onChange={e => setPartialMethod(e.target.value as PartialMethod)}
                  disabled={busy}
                >
                  <option value="edc">{t('scoring_partial_edc')}</option>
                  <option value="halves">{t('scoring_partial_halves')}</option>
                </select>
              )}

              {scoringMode === 'penalty' && (
                <label className="flex items-center gap-2 text-base text-chalk-dim" htmlFor="penaltyPerWrong">
                  {t('scoring_penalty_label')}
                  <Input
                    id="penaltyPerWrong"
                    type="number"
                    step="0.05"
                    min={0}
                    max={1}
                    value={penaltyPerWrong}
                    onChange={e => setPenaltyPerWrong(Number(e.target.value))}
                    disabled={busy}
                    className="w-24"
                  />
                </label>
              )}

              <Button size="sm" variant="ghost" onClick={() => void saveScoring()} disabled={busy}>
                {t('save')}
              </Button>
            </div>
            <div className="text-sm text-chalk-dim">
              {scoringMode === 'all_or_nothing' && t('scoring_hint_all_or_nothing')}
              {scoringMode === 'partial' && (partialMethod === 'edc' ? t('scoring_hint_partial_edc') : t('scoring_hint_partial_halves'))}
              {scoringMode === 'penalty' && t('scoring_hint_penalty', { value: penaltyPerWrong })}
            </div>
            <div className="text-sm text-chalk-dim">
              {t('scoring_apply_note')}
            </div>
          </div>
        </div>
      </Card>

      {/* Rule Builder */}
      <Card className="p-5 md:p-6">
        <div className="text-lg font-semibold text-chalk">{t('step2_title')}</div>
        <div className="mt-4 grid gap-4">
          {/* 1) Tỉ lệ dự phòng mặc định - Collapse/Expand */}
          <div className="rounded-hand border border-chalk-faint bg-white/2">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-2 text-left text-base"
              onClick={() => setShowDefaultExtra(!showDefaultExtra)}
            >
              <span className="text-chalk-dim">
                {t('default_extra_title')}
                {' '}
                <span className="text-sm">
                  {t.rich('default_extra_current', { value: defaultExtraPercent, mono })}
                </span>
              </span>
              <span className="text-chalk-dim">
                {showDefaultExtra ? '▲' : '▼'}
              </span>
            </button>
            {showDefaultExtra && (
              <div className="border-t border-chalk-faint px-4 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex-1" htmlFor="defaultExtraPercent">
                    <div className="text-base font-medium text-chalk">{t('default_extra_label')}</div>
                    <Input
                      id="defaultExtraPercent"
                      type="number"
                      step="0.05"
                      className="mt-1"
                      value={defaultExtraPercent}
                      onChange={e => setDefaultExtraPercent(Number(e.target.value))}
                      disabled={busy}
                      min={0}
                      max={5}
                    />
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => void saveDefaultExtra()} disabled={busy}>
                    {t('save_default')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 2) Chọn pools trước */}
          <div className="grid gap-2">
            <div className="text-base font-medium text-chalk">{t('pools_label')}</div>
            {pools.length > 5 && (
              <Input
                placeholder={t('search_pool_placeholder')}
                value={poolSearchQuery}
                onChange={e => setPoolSearchQuery(e.target.value)}
                className="text-base"
              />
            )}
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-hand border border-chalk-faint bg-white/2 p-3">
              {pools.length === 0
                ? (
                    <div className="text-base text-chalk-dim">{t('no_pools')}</div>
                  )
                : pools
                    .filter(p => poolSearchQuery.trim() === '' || p.name.toLowerCase().includes(poolSearchQuery.toLowerCase()))
                    .map(p => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-3 rounded-hand border border-chalk-faint bg-white/2 px-3 py-2 text-base transition-colors hover:bg-white/5"
                      >
                        <input
                          aria-label={`pool:${p.name}`}
                          type="checkbox"
                          checked={selectedPoolIds.includes(p.id)}
                          onChange={(e) => {
                            setSelectedPoolIds((prev) => {
                              if (e.target.checked) {
                                return [...prev, p.id];
                              }
                              return prev.filter(x => x !== p.id);
                            });
                          }}
                          disabled={busy}
                          className="h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-chalk">{p.name}</div>
                          <div className="text-sm text-chalk-dim">
                            <span className="font-mono">{p.visibility}</span>
                            {p.permission
                              ? (
                                  <>
                                    {' '}
                                    ·
                                    {' '}
                                    <span className="font-mono">{p.permission}</span>
                                  </>
                                )
                              : null}
                          </div>
                        </div>
                        {selectedPoolIds.includes(p.id) && (
                          <span className="text-sm text-chalk-yellow">✓</span>
                        )}
                      </label>
                    ))}
            </div>
            <div className="text-sm text-chalk-dim">
              {selectedPoolIds.length === 0
                ? t.rich('no_pool_selected', { strong })
                : t.rich('pools_selected', { count: selectedPoolIds.length, strong })}
            </div>
          </div>

          {/* 3) Sau đó chọn chủ đề (tag) bằng cách bấm chọn trong danh sách */}
          <div className="grid gap-1 text-base">
            <div className="font-medium text-chalk">{t('topic_label')}</div>
            <div className="flex flex-wrap gap-2">
              {tagSuggestions.length === 0
                ? (
                    <div className="text-sm text-chalk-dim">
                      {t('no_tags_hint')}
                    </div>
                  )
                : tagSuggestions.map((s) => {
                    const selected = tag === s.normalizedName;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                          selected
                            ? 'text-ink-on-yellow border-chalk-yellow bg-chalk-yellow'
                            : 'border-chalk-faint bg-white/2 text-chalk/85 hover:bg-white/2'
                        }`}
                        onClick={() => {
                          setTag(selected ? '' : s.normalizedName);
                        }}
                        disabled={busy}
                      >
                        <span className="truncate">{s.name}</span>
                        <span className="font-mono text-sm text-chalk-dim">
                          {t('tag_question_count', { count: s.questionCount })}
                        </span>
                      </button>
                    );
                  })}
            </div>
            <div className="text-sm text-chalk-dim">
              {tag
                ? t.rich('selected_tag', { tag, mono })
                : t('select_tag_hint')}
            </div>
          </div>

          <label className="grid gap-1 text-base" htmlFor="ruleMode">
            <div className="font-medium text-chalk">{t('mode_label')}</div>
            <select
              id="ruleMode"
              className={cn(s.field, 'w-auto')}
              value={mode}
              onChange={e => setMode(e.target.value as 'same' | 'variant')}
              disabled={busy}
            >
              <option value="same">{t('mode_same')}</option>
              <option value="variant">{t('mode_variant')}</option>
            </select>
          </label>

          {mode === 'same' && (
            <label className="grid gap-1 text-base" htmlFor="ruleCount">
              <div className="font-medium text-chalk">
                {t('count_label')}
                {tag && selectedTagInfo && (
                  <span className="ml-2 text-sm font-normal text-chalk-dim">
                    {t.rich('max_questions', { count: selectedTagInfo.questionCount, mono })}
                  </span>
                )}
              </div>
              <Input
                id="ruleCount"
                type="number"
                value={count}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const max = tag && selectedTagInfo ? selectedTagInfo.questionCount : 500;
                  setCount(Math.min(val, max));
                }}
                disabled={busy}
                min={1}
                max={tag && selectedTagInfo ? selectedTagInfo.questionCount : 500}
              />
              {tag && selectedTagInfo && count > selectedTagInfo.questionCount && (
                <div className="text-sm text-chalk-yellow">
                  {t('count_adjusted', { requested: count, available: selectedTagInfo.questionCount })}
                </div>
              )}
            </label>
          )}

          {mode === 'variant'
            ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-base" htmlFor="commonCount">
                    <div className="font-medium text-chalk">
                      {t('common_count_label')}
                      {tag && selectedTagInfo && (
                        <span className="ml-2 text-sm font-normal text-chalk-dim">
                          {t.rich('max_short', { count: selectedTagInfo.questionCount, mono })}
                        </span>
                      )}
                    </div>
                    <Input
                      id="commonCount"
                      type="number"
                      value={commonCount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const max = tag && selectedTagInfo ? selectedTagInfo.questionCount : 500;
                        setCommonCount(Math.min(val, max));
                      }}
                      disabled={busy}
                      min={0}
                      max={tag && selectedTagInfo ? selectedTagInfo.questionCount : 500}
                    />
                  </label>
                  <label className="grid gap-1 text-base" htmlFor="variantCount">
                    <div className="font-medium text-chalk">
                      {t('variant_count_label')}
                      {tag && selectedTagInfo && (
                        <span className="ml-2 text-sm font-normal text-chalk-dim">
                          {t.rich('max_short', { count: selectedTagInfo.questionCount, mono })}
                        </span>
                      )}
                    </div>
                    <Input
                      id="variantCount"
                      type="number"
                      value={variantCount}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const max = tag && selectedTagInfo ? selectedTagInfo.questionCount : 500;
                        setVariantCount(Math.min(val, max));
                      }}
                      disabled={busy}
                      min={0}
                      max={tag && selectedTagInfo ? selectedTagInfo.questionCount : 500}
                    />
                  </label>
                  <label className="grid gap-1 text-base" htmlFor="extraPercent">
                    <div className="font-medium text-chalk">{t('extra_percent_label')}</div>
                    <Input
                      id="extraPercent"
                      type="number"
                      step="0.05"
                      value={extraPercent}
                      onChange={e => setExtraPercent(Number(e.target.value))}
                      disabled={busy || useDefaultExtra}
                      min={0}
                      max={5}
                    />
                  </label>
                </div>
              )
            : null}
          {mode === 'variant'
            ? (
                <label className="flex items-center gap-2 text-base">
                  <input
                    type="checkbox"
                    checked={useDefaultExtra}
                    onChange={e => setUseDefaultExtra(e.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    {t.rich('use_default_extra', { value: defaultExtraPercent, mono })}
                  </span>
                </label>
              )
            : null}

          <div className="mt-2 text-sm">
            <div className="text-chalk-dim">
              {t.rich('projected', { count: projectedQuestions, mono })}
            </div>
            {tag && selectedTagInfo && projectedQuestions > selectedTagInfo.questionCount && (
              <div className="mt-1 text-chalk-yellow">
                {t.rich('projected_exceeds', {
                  requested: projectedQuestions,
                  available: selectedTagInfo.questionCount,
                  mono,
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              disabled={
                busy
                || tag.trim().length === 0
                || (mode === 'same' ? count < 1 : (commonCount + variantCount) < 1)
              }
              onClick={() => void saveRule()}
            >
              {busy ? t('saving') : t('finish_selection')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Preview Card - Hiển thị sau cùng */}
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-chalk">{t('preview_title')}</div>
          <Button size="sm" variant="ghost" onClick={() => void loadPreview()} disabled={busy}>
            {t('preview')}
          </Button>
        </div>
        {preview
          ? (
              <div className="mt-3 overflow-x-auto">
                <div className="mb-2 text-base text-chalk">
                  {t.rich('preview_totals', {
                    requested: preview.totals.totalRequested,
                    poolSize: preview.totals.totalPoolSize,
                    shortage: preview.totals.totalShortage,
                    mono,
                  })}
                </div>
                <div className="mb-2 text-sm text-chalk-dim">
                  {t.rich('preview_explanation', { strong })}
                </div>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr className="text-chalk-dim">
                        <th className="border-b p-2">{t('col_tag')}</th>
                        <th className="border-b p-2">{t('col_requested')}</th>
                        <th className="border-b p-2">{t('col_to_fetch')}</th>
                        <th className="border-b p-2">{t('col_available')}</th>
                        <th className="border-b p-2">{t('col_missing')}</th>
                        <th className="border-b p-2">{t('col_pools')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map(r => (
                        <tr
                          key={r.ruleId}
                          className={r.shortage > 0
                            ? 'bg-chalk-yellow/10'
                            : 'odd:bg-white/5'}
                        >
                          <td className="p-2 font-mono">{r.tag.normalizedName}</td>
                          <td className="p-2 font-mono">{r.requested}</td>
                          <td className="p-2 font-mono">{r.poolSize}</td>
                          <td className="p-2 font-mono">{r.available}</td>
                          <td className="p-2 font-mono">{r.shortage}</td>
                          <td className="p-2 text-sm">
                            {r.poolIds.length === 0
                              ? <span className="font-mono">{t('all_pools')}</span>
                              : r.poolIds.map(id => poolById.get(id)?.name ?? id).join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </div>
            )
          : (
              <div className="mt-2 text-base text-chalk-dim">
                {t('preview_hint')}
              </div>
            )}
      </Card>

      {/* Danger Zone */}
      {quizInfo && (
        <Card className="border-chalk-pink/40 p-5 md:p-6">
          <div className="text-lg font-semibold text-chalk-pink">{t('danger_zone')}</div>
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-medium text-chalk">
                  {quizInfo.status === 'archived' ? t('unarchive_title') : t('archive_title')}
                </div>
                <div className="text-sm text-chalk-dim">
                  {quizInfo.status === 'archived' ? t('unarchive_hint') : t('archive_hint')}
                </div>
              </div>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void setArchived(quizInfo.status !== 'archived')}>
                {quizInfo.status === 'archived' ? t('unarchive_button') : t('archive_button')}
              </Button>
            </div>
            <div className="flex flex-col gap-2 border-t border-chalk-faint pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-medium text-chalk">{t('delete_quiz_title')}</div>
                <div className="text-sm text-chalk-dim">{t('delete_quiz_hint')}</div>
              </div>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => void deleteQuiz()}>
                {t('delete_quiz_button')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
// EOF
