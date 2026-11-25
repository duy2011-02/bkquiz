'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { TagFilter } from '@/components/ui/TagFilter';

type Pool = {
  id: string;
  name: string;
  visibility: 'private' | 'shared';
  updatedAt: string | Date;
  questionCount?: number;
  tagCount?: number;
  tags?: Array<{ id: string; name: string; normalizedName: string }>;
};

export function QuestionBankPanel(props: { initialOwned: Pool[] }) {
  const t = useTranslations('QuestionBank');
  const locale = useLocale();
  const [owned, setOwned] = useState<Pool[]>(props.initialOwned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
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

  const sorted = useMemo(
    () => [...owned].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [owned],
  );

  async function refresh() {
    const url = new URL('/api/pools', window.location.origin);
    if (tagFilter.trim()) {
      url.searchParams.set('tags', tagFilter.trim());
    }
    try {
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        return;
      }
      const text = await res.text();
      if (!text) {
        return;
      }
      let data: { owned: Pool[]; shared: Pool[] };
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error('Failed to parse pools response:', text, err);
        return;
      }
      setOwned(data.owned);
    } catch (err) {
      console.error('Error loading pools:', err);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter]);

  async function createPool() {
    if (!newPoolName.trim()) {
      return;
    }
    setCreateBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPoolName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'CREATE_FAILED');
        return;
      }
      setNewPoolName('');
      setShowCreateForm(false);
      await refresh();
    } finally {
      setCreateBusy(false);
    }
  }

  async function importFile() {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/pools/import', { method: 'POST', body: form });
      const raw = await res.text();
      const data = (() => {
        try {
          return JSON.parse(raw) as { error?: string; warnings?: string[] };
        } catch {
          return { error: raw || 'EMPTY_RESPONSE' };
        }
      })();
      if (!res.ok) {
        setError(data.error ?? 'IMPORT_FAILED');
        return;
      }
      if (data.warnings?.length) {
        setError(`Imported with warnings: ${data.warnings.slice(0, 3).join(' | ')}`);
      }
      setFile(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.md') || droppedFile.name.endsWith('.zip'))) {
      setFile(droppedFile);
    }
  };

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <nav className="text-base text-chalk-dim">
        <Link href="/dashboard" className="transition-colors hover:text-chalk">
          {t('breadcrumb_dashboard')}
        </Link>
        <span className="mx-2">·</span>
        <span className="text-chalk">{t('title')}</span>
      </nav>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-chalk">{t('title')}</div>
            <div className="mt-1 text-base text-chalk-dim">
              {t('description')}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? t('cancel') : t('create_new_pool')}
            </Button>
          </div>
        </div>

        {/* Create Pool Form */}
        {showCreateForm
          ? (
              <div className="mt-4 rounded-hand border border-chalk-faint bg-white/2 p-4">
                <div className="mb-3 text-base font-medium text-chalk">
                  {t('create_new_pool')}
                </div>
                <div className="flex gap-3">
                  <Input
                    placeholder={t('pool_name_placeholder')}
                    value={newPoolName}
                    onChange={e => setNewPoolName(e.target.value)}
                    disabled={createBusy}
                    className="flex-1"
                  />
                  <Button
                    variant="primary"
                    onClick={createPool}
                    disabled={createBusy || !newPoolName.trim()}
                  >
                    {createBusy ? t('creating') : t('create')}
                  </Button>
                </div>
              </div>
            )
          : null}

        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-base font-medium text-chalk">{t('import_from_markdown_zip')}</div>
            <a
              href="/docs/import.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-chalk-yellow hover:underline"
            >
              {t('view_guide')}
            </a>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`mt-2 rounded-md border-2 border-dashed transition-colors ${
              file
                ? 'border-chalk-yellow/40 bg-chalk-yellow/5'
                : 'border-chalk-faint bg-white/2 hover:border-chalk-dim'
            }`}
          >
            {file
              ? (
                  <div className="p-6 text-center">
                    <div className="mb-1 text-base font-medium text-chalk">
                      {file.name}
                    </div>
                    <div className="mb-3 text-sm text-chalk-dim">
                      {(file.size / 1024).toFixed(1)}
                      {' '}
                      KB
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setFile(null)}
                      disabled={busy}
                    >
                      {t('remove_file')}
                    </Button>
                  </div>
                )
              : (
                  <label className="block cursor-pointer p-8 text-center">
                    <div className="mb-2 text-base text-chalk-dim">
                      {t('drag_drop_or_click')}
                    </div>
                    <div className="text-sm text-chalk-dim">
                      {t('supported_files')}
                      {' '}
                      <span className="font-mono">{t('md_or_zip')}</span>
                    </div>
                    <input
                      type="file"
                      accept=".md,.zip"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={busy}
                    />
                  </label>
                )}
          </div>

          <div className="mt-3 flex justify-end">
            <Button variant="primary" onClick={importFile} disabled={busy || !file}>
              {busy ? t('importing') : t('import')}
            </Button>
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

      {/* Tag Filter */}
      <Card className="p-5 md:p-6">
        <TagFilter
          value={tagFilter}
          onChange={setTagFilter}
          onClear={() => setTagFilter('')}
        />
      </Card>

      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-chalk">{t('your_pools')}</div>
            <div className="mt-1 text-base text-chalk-dim">
              {sorted.length}
              {' '}
              {t('pools')}
            </div>
          </div>
        </div>

        {busy && sorted.length === 0
          ? (
              <div className="mt-4 space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            )
          : sorted.length === 0
            ? (
                <div className="mt-6 rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center">
                  <div className="text-base text-chalk-dim">
                    {t('no_pools_yet')}
                  </div>
                  <div className="mt-2 text-sm text-chalk-dim">
                    {t('get_started_hint')}
                  </div>
                </div>
              )
            : (
                <div className="mt-4 space-y-3">
                  {sorted.map((p, idx) => (
                    <Link key={p.id} href={`/dashboard/question-bank/${p.id}`}>
                      <div
                        className="rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
                        style={{ animationDelay: `${idx * 30}ms` }}
                      >
                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto_auto] items-center gap-4 md:grid-cols-[2fr_auto_120px_100px]">
                            <div className="min-w-0">
                              <div className="truncate text-base font-medium text-chalk">{p.name}</div>
                              <div className="mt-1 text-sm text-chalk-dim">
                                {t('questions_count', { count: p.questionCount ?? 0 })}
                              </div>
                            </div>
                            {p.tags && p.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                {p.tags.slice(0, 5).map((tag) => {
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
                                {p.tags.length > 5 && (
                                  <Badge variant="neutral" className="text-sm">
                                    +
                                    {p.tags.length - 5}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <Badge
                              variant={p.visibility === 'shared' ? 'info' : 'neutral'}
                              className="text-sm"
                            >
                              {p.visibility}
                            </Badge>
                            <div className="text-sm text-chalk-dim">
                              <span className="font-mono">
                                {new Date(p.updatedAt).toLocaleDateString(locale)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-chalk-dim">→</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
      </Card>
    </div>
  );
}
