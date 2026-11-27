'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { TagFilter } from '@/components/ui/TagFilter';
import { Toast } from '@/components/ui/Toast';
import { duplicateQuiz } from './duplicateQuiz';

type ClassroomLite = {
  id: string;
  name: string;
  classCode: string;
  roleInClass: 'student' | 'teacher';
};

type QuizLite = {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  updatedAt: string;
  ruleCount?: number;
  tags?: Array<{ id: string; name: string; normalizedName: string }>;
};

export function QuizzesPanel(_props: { classrooms: ClassroomLite[] }) {
  const router = useRouter();
  const t = useTranslations('Quizzes');
  const locale = useLocale();
  const [quizzes, setQuizzes] = useState<QuizLite[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [tagFilter, setTagFilter] = useState('');

  // Parse tag filter thành array
  const activeFilterTags = useMemo(() => {
    if (!tagFilter.trim()) {
      return [];
    }
    return tagFilter.split(',').map(t => t.trim()).filter(Boolean);
  }, [tagFilter]);

  // Helper function để toggle tag trong filter
  const toggleTagFilter = (tagName: string) => {
    const normalizedTagName = tagName.trim();
    const currentTags = activeFilterTags;
    const isSelected = currentTags.some(t => t.toLowerCase() === normalizedTagName.toLowerCase());

    if (isSelected) {
      // Remove tag nếu đã được chọn
      const newTags = currentTags.filter(t => t.toLowerCase() !== normalizedTagName.toLowerCase());
      setTagFilter(newTags.join(', '));
    } else {
      // Add tag nếu chưa được chọn
      const newTags = [...currentTags, normalizedTagName];
      setTagFilter(newTags.join(', '));
    }
  };

  // Check nếu tag đang được filter
  const isTagSelected = (tagName: string) => {
    return activeFilterTags.some(t => t.toLowerCase() === tagName.trim().toLowerCase());
  };

  const stats = useMemo(() => {
    const draft = quizzes.filter(q => q.status === 'draft').length;
    const published = quizzes.filter(q => q.status === 'published').length;
    const archived = quizzes.filter(q => q.status === 'archived').length;
    return { total: quizzes.length, draft, published, archived };
  }, [quizzes]);

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

  async function load() {
    const url = new URL('/api/quizzes', window.location.origin);
    if (tagFilter.trim()) {
      url.searchParams.set('tags', tagFilter.trim());
    }
    try {
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        const text = await res.text();
        let json: { quizzes?: QuizLite[]; error?: string };
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
      let json: { quizzes?: QuizLite[]; error?: string };
      try {
        json = JSON.parse(text);
      } catch (err) {
        setError('LOAD_FAILED: Invalid JSON response');
        console.error('Failed to parse response:', text, err);
        return;
      }
      setError(null);
      setQuizzes(json.quizzes ?? []);
    } catch (err) {
      setError(`LOAD_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error loading quizzes:', err);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter]);

  async function createQuiz() {
    if (title.trim().length === 0) {
      setError(t('please_enter_quiz_title'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, status: 'draft' }),
      });
      if (!res.ok) {
        let errorMessage = 'CREATE_FAILED';
        try {
          const errorJson = await res.json() as { error?: string };
          errorMessage = errorJson.error ?? 'CREATE_FAILED';
        } catch {
          // Response không phải JSON, dùng message mặc định
        }
        setError(errorMessage);
        return;
      }
      const json = await res.json() as { id?: string; error?: string };
      if (!json.id) {
        setError(json.error ?? 'CREATE_FAILED');
        return;
      }
      setTitle('');
      setToast({ message: t('quiz_created_success'), type: 'success' });
      await load();
      // Delay redirect để user thấy toast
      setTimeout(() => {
        router.push(`/dashboard/quizzes/${json.id}`);
      }, 500);
    } finally {
      setBusy(false);
    }
  }

  async function handleDuplicate(q: QuizLite) {
    setBusy(true);
    setError(null);
    try {
      const result = await duplicateQuiz(q.id, t('copy_title', { title: q.title }));
      if ('error' in result) {
        setToast({ message: t('duplicate_failed'), type: 'error' });
        return;
      }
      setToast({ message: t('duplicate_success'), type: 'success' });
      router.push(`/dashboard/quizzes/${result.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateQuizStatus(quizId: string, status: QuizLite['status']) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/status`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? 'UPDATE_STATUS_FAILED');
        setToast({ message: t('cannot_publish_quiz'), type: 'error' });
        return;
      }
      setToast({ message: t('quiz_published_success'), type: 'success' });
      await load();
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
          <span className="text-chalk">{t('title')}</span>
        </div>
      </nav>

      {/* Header */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-chalk text-[1.6rem] leading-tight chalk-glow text-chalk md:text-[2rem]">{t('title')}</h1>
            <div className="mt-1 text-base text-chalk-dim">
              {t('description')}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="grid gap-1 text-base" htmlFor="quizTitle">
            <div className="font-medium text-chalk-dim">{t('create_new_quiz_draft')}</div>
            <div className="flex gap-2">
              <Input
                id="quizTitle"
                className="w-full"
                placeholder={t('quiz_title_placeholder')}
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={busy}
              />
              <Button
                variant="primary"
                disabled={busy || title.trim().length === 0}
                onClick={() => void createQuiz()}
              >
                {t('create')}
              </Button>
            </div>
          </label>
        </div>

        {error
          ? (
              <div className="mt-3 rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-3 text-base text-chalk-pink">
                {error}
              </div>
            )
          : null}
      </Card>

      {/* Stats Cards */}
      {quizzes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-sm text-chalk-dim">{t('total_quizzes')}</div>
            <div className="mt-1 text-2xl font-semibold text-chalk">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-chalk-dim">{t('draft')}</div>
            <div className="mt-1 text-2xl font-semibold text-chalk">{stats.draft}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-chalk-dim">{t('published')}</div>
            <div className="mt-1 text-2xl font-semibold text-chalk">{stats.published}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-chalk-dim">{t('archived')}</div>
            <div className="mt-1 text-2xl font-semibold text-chalk">{stats.archived}</div>
          </Card>
        </div>
      )}

      {/* Tag Filter */}
      <Card className="p-5 md:p-6">
        <TagFilter
          value={tagFilter}
          onChange={setTagFilter}
          onClear={() => setTagFilter('')}
        />
      </Card>

      {/* Quiz List */}
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-chalk">{t('quiz_list_title')}</div>
            <div className="mt-1 text-base text-chalk-dim">
              {t('quiz_list_description')}
            </div>
          </div>
        </div>

        {quizzes.length === 0
          ? (
              <div className="mt-6 rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center">
                <div className="text-base text-chalk-dim">
                  {t('no_quizzes_yet')}
                </div>
                <div className="mt-2 text-sm text-chalk-dim">
                  {t('create_quiz_draft_hint')}
                </div>
              </div>
            )
          : (
              <div className="mt-4 space-y-3">
                {quizzes.map((q, idx) => (
                  <Link key={q.id} href={`/dashboard/quizzes/${q.id}`}>
                    <div
                      className="rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 md:grid md:grid-cols-[2fr_auto_120px_100px] md:gap-4">
                          <div className="min-w-0 basis-full md:basis-auto">
                            <div className="truncate text-base font-medium text-chalk">{q.title}</div>
                            {typeof q.ruleCount === 'number' && (
                              <div className="mt-1 text-sm text-chalk-dim">
                                {q.ruleCount}
                                {' '}
                                {t('rule_count')}
                              </div>
                            )}
                          </div>
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {q.tags.slice(0, 5).map((tag) => {
                                const isSelected = isTagSelected(tag.name);
                                return (
                                  <Badge
                                    key={tag.id}
                                    variant={isSelected ? 'info' : 'neutral'}
                                    className={`cursor-pointer text-sm transition-colors ${
                                      isSelected
                                        ? 'border-chalk-yellow/40 bg-chalk-yellow/20 hover:bg-chalk-yellow/30'
                                        : 'hover:bg-chalk-yellow/10'
                                    }`}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toggleTagFilter(tag.name);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleTagFilter(tag.name);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    {tag.name}
                                  </Badge>
                                );
                              })}
                              {q.tags.length > 5 && (
                                <Badge variant="neutral" className="text-sm">
                                  +
                                  {q.tags.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}
                          <Badge
                            variant={q.status === 'published' ? 'success' : (q.status === 'archived' ? 'neutral' : 'warning')}
                            className="text-sm"
                          >
                            {t(q.status)}
                          </Badge>
                          <div className="text-sm text-chalk-dim">
                            {formatDate(q.updatedAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {q.status === 'draft'
                            ? (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void updateQuizStatus(q.id, 'published');
                                  }}
                                >
                                  {t('publish')}
                                </Button>
                              )
                            : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDuplicate(q);
                            }}
                          >
                            {t('duplicate')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/dashboard/quizzes/${q.id}`);
                            }}
                          >
                            {t('open')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
      </Card>

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
