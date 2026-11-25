'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TagFilter } from '@/components/ui/TagFilter';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';

type ClassroomLite = {
  id: string;
  name: string;
  classCode: string;
  createdAt: string;
  ownerTeacherId: string;
  roleInClass: 'student' | 'ta' | 'teacher';
  joinedAt: string;
  memberCount: number;
  tags?: Array<{ id: string; name: string; normalizedName: string }>;
};

type ClassesPanelProps = {
  role: 'teacher' | 'student';
};

export function ClassesPanel(props: ClassesPanelProps) {
  const { role } = props;
  const t = useTranslations('Classes');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [classes, setClasses] = useState<ClassroomLite[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [pendingClassCode, setPendingClassCode] = useState<string | null>(null);
  const [classPreview, setClassPreview] = useState<{
    id: string;
    name: string;
    classCode: string;
    ownerTeacher: { name: string | null; email: string | null };
    memberCount: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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
    const owned = classes.filter(c => c.roleInClass === 'teacher').length;
    const joined = classes.filter(c => c.roleInClass !== 'teacher').length;
    return { total: classes.length, owned, joined };
  }, [classes]);

  async function load() {
    const url = new URL('/api/classes', window.location.origin);
    if (tagFilter.trim()) {
      url.searchParams.set('tags', tagFilter.trim());
    }
    try {
      const res = await fetch(url.toString(), { method: 'GET' });
      if (!res.ok) {
        const text = await res.text();
        let json: { classes?: ClassroomLite[]; error?: string };
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
      let json: { classes?: ClassroomLite[]; error?: string };
      try {
        json = JSON.parse(text);
      } catch (err) {
        setError('LOAD_FAILED: Invalid JSON response');
        console.error('Failed to parse response:', text, err);
        return;
      }
      setError(null);
      setClasses(json.classes ?? []);
    } catch (err) {
      setError(`LOAD_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error loading classes:', err);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagFilter]);

  async function createClass() {
    if (newClassName.trim().length === 0) {
      setError(t('please_enter_class_name'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: newClassName }),
      });
      const json = await res.json() as { id?: string; error?: string };
      if (!res.ok || !json.id) {
        setError(json.error ?? 'CREATE_FAILED');
        return;
      }
      setNewClassName('');
      setToast({ message: t('class_created_success'), type: 'success' });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function joinClass(code?: string) {
    const codeToJoin = code || joinCode.trim();
    if (codeToJoin.length === 0) {
      setError(t('please_enter_class_code'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ classCode: codeToJoin }),
      });
      const text = await res.text();
      if (!text) {
        setError('JOIN_FAILED: Empty response');
        return;
      }
      let json: { id?: string; error?: string };
      try {
        json = JSON.parse(text);
      } catch (err) {
        setError('JOIN_FAILED: Invalid JSON response');
        console.error('Failed to parse response:', text, err);
        return;
      }
      if (!res.ok || !json.id) {
        setError(json.error === 'CLASS_BANNED' ? t('class_banned') : (json.error ?? 'JOIN_FAILED'));
        return;
      }
      setJoinCode('');
      setToast({ message: t('class_joined_success'), type: 'success' });
      await load();
      // Redirect to class detail page
      if (json.id) {
        setTimeout(() => {
          router.push(`/dashboard/classes/${json.id}`);
        }, 1000);
      }
      return json.id;
    } finally {
      setBusy(false);
    }
  }

  // Fetch class preview when join param is present
  async function fetchClassPreview(classCode: string) {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/classes/preview?classCode=${encodeURIComponent(classCode)}`);
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setError(json.error ?? 'CLASS_NOT_FOUND');
        setShowJoinModal(false);
        setPendingClassCode(null);
        // Clear query param on error
        router.replace('/dashboard/classes');
        return;
      }
      const preview = await res.json() as {
        id: string;
        name: string;
        classCode: string;
        ownerTeacher: { name: string | null; email: string | null };
        memberCount: number;
      };
      setClassPreview(preview);
      setShowJoinModal(true);
    } catch (err) {
      setError(`PREVIEW_FAILED: ${err instanceof Error ? err.message : String(err)}`);
      setShowJoinModal(false);
      setPendingClassCode(null);
      router.replace('/dashboard/classes');
    } finally {
      setLoadingPreview(false);
    }
  }

  // Show join confirmation modal when join param is present
  useEffect(() => {
    const joinParam = searchParams.get('join');
    if (joinParam && !showJoinModal && !pendingClassCode) {
      setPendingClassCode(joinParam);
      void fetchClassPreview(joinParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleConfirmJoin() {
    if (!pendingClassCode) {
      return;
    }
    setShowJoinModal(false);
    const classId = await joinClass(pendingClassCode);
    setPendingClassCode(null);
    setClassPreview(null);
    if (classId) {
      // Clear query param
      router.replace('/dashboard/classes');
    }
  }

  function handleCancelJoin() {
    setShowJoinModal(false);
    setPendingClassCode(null);
    setClassPreview(null);
    // Clear query param
    router.replace('/dashboard/classes');
  }

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <nav className="text-base">
        <div className="flex items-center gap-2 text-chalk-dim">
          <Link href="/dashboard" className="transition-colors hover:text-chalk">
            Dashboard
          </Link>
          <span>·</span>
          <span className="text-chalk">Classes</span>
          <Badge
            variant={role === 'teacher' ? 'success' : 'info'}
            className="ml-2 px-1.5 py-0.5 text-sm"
          >
            {role === 'teacher' ? 'Teacher' : 'Student'}
          </Badge>
        </div>
      </nav>

      {/* Header */}
      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-script text-2xl leading-tight font-bold chalk-glow text-chalk md:text-[1.85rem]">Classes</h1>
            <div className="mt-1 text-base text-chalk-dim">
              {role === 'teacher'
                ? t('manage_your_classes')
                : t('classes_you_joined')}
            </div>
          </div>
        </div>

        {role === 'teacher'
          ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-base" htmlFor="newClassName">
                  <div className="font-medium text-chalk-dim">{t('create_new_class')}</div>
                  <div className="flex gap-2">
                    <Input
                      id="newClassName"
                      className="w-full"
                      placeholder={t('class_name_placeholder')}
                      value={newClassName}
                      onChange={e => setNewClassName(e.target.value)}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void createClass();
                        }
                      }}
                    />
                    <Button
                      variant="primary"
                      disabled={busy || newClassName.trim().length === 0}
                      onClick={() => void createClass()}
                      className=""
                    >
                      {t('create')}
                    </Button>
                  </div>
                </label>

                <label className="grid gap-1 text-base" htmlFor="joinCode">
                  <div className="font-medium text-chalk-dim">{t('join_class_by_code')}</div>
                  <div className="flex gap-2">
                    <Input
                      id="joinCode"
                      className="w-full"
                      placeholder={t('class_code_placeholder')}
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void joinClass();
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      disabled={busy || joinCode.trim().length === 0}
                      onClick={() => void joinClass()}
                      className=""
                    >
                      Join
                    </Button>
                  </div>
                </label>
              </div>
            )
          : (
              <div className="mt-4">
                <label className="grid gap-1 text-base" htmlFor="joinCode">
                  <div className="font-medium text-chalk-dim">{t('join_class_by_code')}</div>
                  <div className="flex gap-2">
                    <Input
                      id="joinCode"
                      className="w-full"
                      placeholder={t('class_code_placeholder')}
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void joinClass();
                        }
                      }}
                    />
                    <Button
                      variant="primary"
                      disabled={busy || joinCode.trim().length === 0}
                      onClick={() => void joinClass()}

                    >
                      Join
                    </Button>
                  </div>
                </label>
              </div>
            )}

        {error
          ? (
              <div className="mt-3 rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-3 text-base text-chalk-pink">
                {error}
              </div>
            )
          : null}
      </Card>

      {/* Stats Cards */}
      {classes.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 transition-all duration-200">
            <div className="text-sm text-chalk-dim">{t('total_classes')}</div>
            <div className="mt-1 text-2xl font-semibold text-chalk">{stats.total}</div>
          </Card>
          {role === 'teacher'
            ? (
                <>
                  <Card className="p-4 transition-all duration-200">
                    <div className="text-sm text-chalk-dim">{t('classes_owned')}</div>
                    <div className="mt-1 text-2xl font-semibold text-chalk">{stats.owned}</div>
                  </Card>
                  <Card className="p-4 transition-all duration-200">
                    <div className="text-sm text-chalk-dim">{t('classes_joined')}</div>
                    <div className="mt-1 text-2xl font-semibold text-chalk">{stats.joined}</div>
                  </Card>
                </>
              )
            : (
                <>
                  <Card className="border-chalk-blue/20 p-4 transition-all duration-200">
                    <div className="text-sm text-chalk-dim">Active Sessions</div>
                    <div className="mt-1 text-2xl font-semibold text-chalk-blue">
                      {classes.filter(c => c.roleInClass !== 'teacher').length}
                    </div>
                  </Card>
                  <Card className="border-chalk-blue/20 p-4 transition-all duration-200">
                    <div className="text-sm text-chalk-dim">Total Members</div>
                    <div className="mt-1 text-2xl font-semibold text-chalk-blue">
                      {classes.reduce((sum, c) => sum + c.memberCount, 0)}
                    </div>
                  </Card>
                </>
              )}
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

      {/* Classes List */}
      <Card className="p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-chalk">
              {t('my_classes')}
            </div>
            <div className="mt-1 text-base text-chalk-dim">
              {t('classes_count', { count: classes.length })}
            </div>
          </div>
        </div>

        {classes.length === 0
          ? (
              <div className="mt-6 rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center">
                <div className="text-base text-chalk-dim">
                  {t('no_classes_yet')}
                </div>
                <div className="mt-2 text-sm text-chalk-dim">
                  {role === 'teacher'
                    ? t('create_or_join_hint_teacher')
                    : t('create_or_join_hint_student')}
                </div>
              </div>
            )
          : (
              <div className="mt-4 space-y-3">
                {classes.map((c, idx) => (
                  <Link key={c.id} href={`/dashboard/classes/${c.id}`}>
                    <div
                      className="rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto_auto] items-center gap-4 md:grid-cols-[2fr_auto_120px_100px]">
                          <div className="min-w-0">
                            <div className="truncate text-base font-medium text-chalk">{c.name}</div>
                            <div className="mt-1 text-sm text-chalk-dim">
                              {t('member_count', { count: c.memberCount })}
                            </div>
                          </div>
                          {c.tags && c.tags.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {c.tags.slice(0, 5).map((tag) => {
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
                              {c.tags.length > 5 && (
                                <Badge variant="neutral" className="text-sm">
                                  +
                                  {c.tags.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}
                          <Badge
                            variant={c.roleInClass === 'teacher' ? 'success' : (c.roleInClass === 'ta' ? 'info' : 'neutral')}
                            className="text-sm"
                          >
                            {c.roleInClass === 'teacher' ? 'Owner' : (c.roleInClass === 'ta' ? 'TA' : 'Student')}
                          </Badge>
                          <div className="text-sm text-chalk-dim">
                            <span className="font-mono">{c.classCode}</span>
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

      {/* Join Confirmation Modal */}
      <Modal
        open={showJoinModal && !!classPreview}
        onClose={handleCancelJoin}
        dismissible={!busy}
        title={t('confirm_join_class')}
        footer={(
          <>
            <Button onClick={handleCancelJoin} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button variant="solid" onClick={() => void handleConfirmJoin()} loading={busy}>
              {busy ? t('joining') : t('confirm_join')}
            </Button>
          </>
        )}
      >
        {classPreview && (
          <>
            <div className={s.row}>
              <span className={s.dim}>{t('class_name')}</span>
              <span className={cn(s.chalk, 'text-right')}>{classPreview.name}</span>
            </div>
            <div className={s.row}>
              <span className={s.dim}>{t('class_code')}</span>
              <span className={cn(s.yellow, 'font-mono')}>{classPreview.classCode}</span>
            </div>
            <div className={s.row}>
              <span className={s.dim}>{t('teacher_label')}</span>
              <span className={cn(s.chalk, 'text-right')}>
                {classPreview.ownerTeacher.name || classPreview.ownerTeacher.email || 'N/A'}
              </span>
            </div>
            <div className={s.row}>
              <span className={s.dim}>{t('member_count_label')}</span>
              <span className={s.green}>{classPreview.memberCount}</span>
            </div>
          </>
        )}
      </Modal>

      {/* Loading state while fetching the class preview */}
      <Modal open={loadingPreview} dismissible={false} size="sm" title={t('loading_class_info')}>
        <div className={cn(s.progressTrack, 'bk-skeleton')} />
      </Modal>

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
