'use client';

import type { ClassInfo, Member, QuizLite, Session } from './types';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import s from '@/components/chalk/chalk.module.css';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { TagInput } from '@/components/ui/TagInput';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { ClassHeader } from './shared/ClassHeader';
import { MembersList } from './shared/MembersList';
import { SessionsList } from './shared/SessionsList';
import { StatsCards } from './shared/StatsCards';

type TeacherClassDetailProps = {
  classId: string;
};

export function TeacherClassDetail(props: TeacherClassDetailProps) {
  const { classId } = props;
  const router = useRouter();
  const t = useTranslations('Classes.detail');
  const tClasses = useTranslations('Classes');
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'sessions' | 'settings'>('members');
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizLite[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [quizSearchQuery, setQuizSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState<string>('');
  const [bufferMinutes, setBufferMinutes] = useState<number>(5); // Mặc định 5 phút
  const [reviewDelayMinutes, setReviewDelayMinutes] = useState<number | null>(null); // null = không cho xem, số = phút sau khi session kết thúc

  // Helper function: Tính thời gian với offset phút, làm tròn chẵn 5 phút
  function getRoundedTime(minutesOffset: number): string {
    const now = new Date();
    const target = new Date(now.getTime() + minutesOffset * 60 * 1000);
    // Làm tròn chẵn 5 phút (làm tròn lên)
    const minutes = target.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 5) * 5;
    target.setMinutes(roundedMinutes);
    target.setSeconds(0);
    target.setMilliseconds(0);
    // Format cho datetime-local input (YYYY-MM-DDTHH:mm)
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const mins = String(target.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${mins}`;
  }
  const [createSessionBusy, setCreateSessionBusy] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Toggle tag filter
  const toggleTagFilter = (tagName: string) => {
    const normalizedTagName = tagName.trim().toLowerCase();
    setSelectedTags((prev) => {
      const isSelected = prev.some(t => t.toLowerCase() === normalizedTagName);
      if (isSelected) {
        return prev.filter(t => t.toLowerCase() !== normalizedTagName);
      }
      return [...prev, tagName.trim()];
    });
  };

  // Check if tag is selected
  const isTagSelected = (tagName: string) => {
    return selectedTags.some(t => t.toLowerCase() === tagName.trim().toLowerCase());
  };

  // Tags state
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<Array<{ id: string; name: string; normalizedName: string }>>([]);
  const [tagsBusy, setTagsBusy] = useState(false);

  // Quản lý thành viên & lớp
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [manageBusy, setManageBusy] = useState(false);
  const [editClassName, setEditClassName] = useState('');
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Mã lỗi từ API quản lý lớp → thông báo
  function manageErrorMessage(code: string | undefined) {
    switch (code) {
      case 'USER_NOT_FOUND':
        return t('error_user_not_found');
      case 'ALREADY_MEMBER':
        return t('error_already_member');
      case 'CLASS_HAS_ACTIVE_SESSION':
        return t('error_class_has_active_session');
      case 'INVALID_INPUT':
        return t('error_invalid_input');
      default:
        return t('error_generic');
    }
  }

  async function addMember() {
    const email = addMemberEmail.trim();
    if (!email) {
      return;
    }
    setManageBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setToast({ message: manageErrorMessage(json.error), type: 'error' });
        return;
      }
      setToast({ message: t('member_added', { email }), type: 'success' });
      setAddMemberEmail('');
      setShowAddMember(false);
      await Promise.all([loadMembers(), loadClassInfo()]);
    } finally {
      setManageBusy(false);
    }
  }

  async function removeMember(member: Member, ban: boolean) {
    const name = member.user.name ?? member.user.email ?? member.userId;
    if (!window.confirm(ban ? t('confirm_ban_member', { name }) : t('confirm_remove_member', { name }))) {
      return;
    }
    setManageBusy(true);
    try {
      const res = await fetch(
        `/api/classes/${classId}/members/${encodeURIComponent(member.userId)}${ban ? '?ban=1' : ''}`,
        { method: 'DELETE' },
      );
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setToast({ message: manageErrorMessage(json.error), type: 'error' });
        return;
      }
      setToast({ message: ban ? t('member_banned', { name }) : t('member_removed', { name }), type: 'success' });
      await Promise.all([loadMembers(), loadClassInfo()]);
    } finally {
      setManageBusy(false);
    }
  }

  async function renameClass() {
    const name = editClassName.trim();
    if (!name) {
      return;
    }
    setManageBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setToast({ message: manageErrorMessage(json.error), type: 'error' });
        return;
      }
      setToast({ message: t('class_renamed'), type: 'success' });
      await loadClassInfo();
    } finally {
      setManageBusy(false);
    }
  }

  async function deleteClass() {
    if (!classInfo || deleteConfirmName !== classInfo.name) {
      return;
    }
    setManageBusy(true);
    try {
      const res = await fetch(`/api/classes/${classId}`, { method: 'DELETE' });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setToast({ message: manageErrorMessage(json.error), type: 'error' });
        return;
      }
      router.push('/dashboard/classes');
    } finally {
      setManageBusy(false);
    }
  }

  async function loadClassInfo() {
    const res = await fetch(`/api/classes/${classId}`, { method: 'GET' });
    const json = await res.json() as ClassInfo | { error?: string };
    if (!res.ok) {
      return;
    }
    setClassInfo(json as ClassInfo);
    setEditClassName((json as ClassInfo).name);
  }

  async function loadMembers() {
    const res = await fetch(`/api/classes/${classId}/members`, { method: 'GET' });
    const json = await res.json() as { members?: Member[]; error?: string };
    if (!res.ok) {
      return;
    }
    setMembers(json.members ?? []);
  }

  async function loadSessions() {
    const res = await fetch(`/api/classes/${classId}/sessions`, { method: 'GET' });
    const json = await res.json() as { sessions?: Session[]; error?: string };
    if (!res.ok) {
      return;
    }
    setSessions(json.sessions ?? []);
  }

  async function loadQuizzes() {
    const res = await fetch('/api/quizzes', { method: 'GET' });
    const json = await res.json() as { quizzes?: QuizLite[]; error?: string };
    if (!res.ok) {
      return;
    }
    // Quiz đã lưu trữ không dùng để tạo session mới
    setQuizzes((json.quizzes ?? []).filter(q => q.status !== 'archived'));
  }

  async function loadTags() {
    try {
      const res = await fetch(`/api/classes/${classId}/tags`);
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
      const res = await fetch(`/api/classes/${classId}/tags`, {
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

  async function createSession() {
    if (!selectedQuizId) {
      setCreateSessionError(t('please_select_quiz'));
      return;
    }
    const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
    if (!selectedQuiz) {
      setCreateSessionError(t('please_select_quiz'));
      return;
    }
    if (selectedQuiz.ruleCount === 0) {
      setCreateSessionError(t('quiz_no_rules'));
      return;
    }
    setCreateSessionBusy(true);
    setCreateSessionError(null);
    try {
      const body: any = {
        classroomId: classId,
        quizId: selectedQuizId,
      };
      // Add session name (use quiz title if empty)
      if (sessionName.trim()) {
        body.sessionName = sessionName.trim();
      } else if (selectedQuiz) {
        body.sessionName = selectedQuiz.title;
      }
      if (scheduledStartTime) {
        body.scheduledStartAt = scheduledStartTime;
      }
      // Use duration from input if set, otherwise use quiz's default duration
      if (durationMinutes !== null && durationMinutes > 0) {
        body.durationSeconds = durationMinutes * 60;
      } else if (selectedQuiz.durationSeconds !== null && selectedQuiz.durationSeconds > 0) {
        // Fallback to quiz's duration if no override
        body.durationSeconds = selectedQuiz.durationSeconds;
      }
      // Add buffer minutes for auto-end
      if (bufferMinutes > 0) {
        body.bufferMinutes = bufferMinutes;
      }
      // Add reviewDelayMinutes (null = không cho xem, số = phút sau khi session kết thúc)
      if (reviewDelayMinutes !== null) {
        body.reviewDelayMinutes = reviewDelayMinutes;
      } else {
        body.reviewDelayMinutes = null;
      }
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { sessionId?: string; error?: string };
      if (!res.ok || !json.sessionId) {
        setCreateSessionError(json.error ?? 'CREATE_SESSION_FAILED');
        return;
      }
      setShowCreateSessionModal(false);
      setSelectedQuizId('');
      setScheduledStartTime('');
      setDurationMinutes(null);
      setSessionName('');
      setBufferMinutes(5);
      setReviewDelayMinutes(null);
      setSelectedTags([]);
      setQuizSearchQuery('');
      setToast({ message: t('session_created_success'), type: 'success' });
      await loadSessions();
      setTimeout(() => {
        router.push(`/dashboard/sessions/${json.sessionId}/teacher`);
      }, 1000);
    } catch {
      setCreateSessionError(t('cannot_create_session'));
    } finally {
      setCreateSessionBusy(false);
    }
  }

  useEffect(() => {
    void Promise.all([loadClassInfo(), loadMembers(), loadSessions(), loadQuizzes(), loadTags()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  if (!classInfo) {
    return (
      <div className="space-y-7">
        <Card className="p-5 md:p-6">
          <div className="text-center text-chalk-dim">{t('loading')}</div>
        </Card>
      </div>
    );
  }

  const isOwner = classInfo.userRole === 'teacher';

  return (
    <div className="space-y-7">
      {/* Breadcrumb */}
      <nav className="text-base">
        <div className="flex items-center gap-2 text-chalk-dim">
          <Link href="/dashboard" className="transition-colors hover:text-chalk">
            {tClasses('breadcrumb_dashboard')}
          </Link>
          <span>·</span>
          <Link href="/dashboard/classes" className="transition-colors hover:text-chalk">
            {tClasses('my_classes')}
          </Link>
          <span>·</span>
          <span className="text-chalk">{classInfo.name}</span>
          <Badge variant="success" className="ml-2 px-1.5 py-0.5 text-sm">
            {t('teacher')}
          </Badge>
        </div>
      </nav>

      {/* Class Header */}
      <ClassHeader
        classInfo={classInfo}
        isOwner={isOwner}
        onCreateSession={() => {
          setShowCreateSessionModal(true);
          // Set default start time when opening modal
          setScheduledStartTime(getRoundedTime(5));
        }}
      />

      {/* Stats Cards */}
      <StatsCards members={members} sessions={sessions} isOwner={isOwner} />

      {/* Tabs */}
      <Card className="p-5 md:p-6">
        <div className="flex gap-2 border-b border-chalk-faint">
          <button
            type="button"
            className={`px-4 py-2 text-base font-medium transition-colors ${
              activeTab === 'members'
                ? 'border-b-2 border-chalk-yellow text-chalk'
                : 'text-chalk-dim hover:text-chalk'
            }`}
            onClick={() => setActiveTab('members')}
          >
            {t('members')}
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-base font-medium transition-colors ${
              activeTab === 'sessions'
                ? 'border-b-2 border-chalk-yellow text-chalk'
                : 'text-chalk-dim hover:text-chalk'
            }`}
            onClick={() => setActiveTab('sessions')}
          >
            {t('sessions')}
          </button>
          {isOwner && (
            <button
              type="button"
              className={`px-4 py-2 text-base font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'border-b-2 border-chalk-yellow text-chalk'
                  : 'text-chalk-dim hover:text-chalk'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              {t('settings')}
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'members' && (
            <div className="space-y-4">
              {isOwner && showAddMember && (
                <form
                  className="rounded-hand border border-chalk-faint bg-white/2 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addMember();
                  }}
                >
                  <label className="text-base font-medium text-chalk" htmlFor="addMemberEmail">
                    {t('add_member_email_label')}
                  </label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="addMemberEmail"
                      type="email"
                      value={addMemberEmail}
                      onChange={e => setAddMemberEmail(e.target.value)}
                      placeholder="student@hust.edu.vn"
                      disabled={manageBusy}
                      className="flex-1"
                    />
                    <Button type="submit" variant="primary" size="sm" disabled={manageBusy || addMemberEmail.trim() === ''}>
                      {t('add_member_submit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={manageBusy}
                      onClick={() => {
                        setShowAddMember(false);
                        setAddMemberEmail('');
                      }}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                  <div className="mt-2 text-sm text-chalk-dim">
                    {t('add_member_hint')}
                  </div>
                </form>
              )}
              <MembersList
                members={members}
                isOwner={isOwner}
                ownerTeacherId={classInfo.ownerTeacherId}
                busy={manageBusy}
                onAddMember={() => setShowAddMember(true)}
                onRemoveMember={(m, ban) => void removeMember(m, ban)}
              />
            </div>
          )}

          {activeTab === 'sessions' && (
            <SessionsList
              sessions={sessions}
              isStudent={false}
              onCreateSession={() => {
                setShowCreateSessionModal(true);
                // Set default start time when opening modal
                setScheduledStartTime(getRoundedTime(5));
              }}
            />
          )}

          {activeTab === 'settings' && isOwner && (
            <div className="space-y-4">
              <form
                className="rounded-hand border border-chalk-faint bg-white/2 p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void renameClass();
                }}
              >
                <label className="text-base font-medium text-chalk" htmlFor="editClassName">
                  {t('class_name_label')}
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="editClassName"
                    value={editClassName}
                    onChange={e => setEditClassName(e.target.value)}
                    maxLength={200}
                    disabled={manageBusy}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={manageBusy || editClassName.trim() === '' || editClassName.trim() === classInfo.name}
                  >
                    {t('save')}
                  </Button>
                </div>
              </form>

              <div className="rounded-hand border border-chalk-faint bg-white/2 p-4">
                <div className="text-base font-medium text-chalk">{t('class_code_label')}</div>
                <div className="mt-2 flex items-center gap-2">
                  <code className="rounded bg-white/2 px-3 py-2 font-mono text-base">
                    {classInfo.classCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(classInfo.classCode);
                    }}
                  >
                    {t('copy')}
                  </Button>
                </div>
                <div className="mt-2 text-sm text-chalk-dim">
                  {t('share_class_code_hint')}
                </div>
              </div>

              <Card className="p-5 md:p-6">
                <div className="space-y-2">
                  <label className="text-base font-medium text-chalk">
                    {t('tags')}
                  </label>
                  <TagInput
                    value={tagsInput}
                    onChange={setTagsInput}
                    onSave={saveTags}
                    tags={tags}
                    showSaveButton={true}
                    disabled={tagsBusy}
                    placeholder={t('tags_placeholder')}
                  />
                  <p className="text-sm text-chalk-dim">
                    {t('tags_hint')}
                  </p>
                </div>
              </Card>

              <div className="rounded-hand border border-chalk-pink/40 bg-chalk-pink/5 p-4">
                <div className="text-base font-medium text-chalk-pink">{t('danger_zone')}</div>
                <div className="mt-2 text-base text-chalk">{t('delete_class_title')}</div>
                <div className="mt-1 text-sm text-chalk-dim">
                  {t('delete_class_warning', { sessions: sessions.length })}
                </div>
                <label className="mt-3 block text-sm text-chalk-dim" htmlFor="deleteConfirmName">
                  {t.rich('delete_class_confirm_label', {
                    name: classInfo.name,
                    strong: chunks => <strong className="font-mono text-chalk">{chunks}</strong>,
                  })}
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="deleteConfirmName"
                    value={deleteConfirmName}
                    onChange={e => setDeleteConfirmName(e.target.value)}
                    disabled={manageBusy}
                    className="flex-1"
                    autoComplete="off"
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={manageBusy || deleteConfirmName !== classInfo.name}
                    onClick={() => void deleteClass()}
                  >
                    {t('delete_class_button')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Create Session Modal */}
      <Modal
        open={showCreateSessionModal}
        size="xl"
        title={t('create_session')}
        className="max-h-[90dvh]"
        onClose={() => {
          setShowCreateSessionModal(false);
          setSelectedQuizId('');
          setQuizSearchQuery('');
          setSelectedTags([]);
          setCreateSessionError(null);
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row">
          {/* Left: Quiz List */}
          <div className={cn(
            'flex flex-col space-y-4',
            selectedQuizId ? 'md:w-1/3' : 'w-full',
            selectedQuizId && 'border-r border-chalk-faint pr-6',
          )}
          >
            {quizzes.length === 0
              ? (
                  <div className="flex flex-1 items-center justify-center rounded-hand border border-dashed border-chalk-faint px-4 py-8 text-center text-base text-chalk-dim">
                    <div>
                      <div>{t('no_quizzes_yet')}</div>
                      <div className="mt-2">
                        <Link href="/dashboard/quizzes" className={cn(s.btn, s.btnPrimary, s.btnSm)}>{t('create_new_quiz')}</Link>
                      </div>
                    </div>
                  </div>
                )
              : (
                  <>
                    {/* Search Input */}
                    <div>
                      <Input
                        type="text"
                        placeholder={t('search_quiz_placeholder')}
                        value={quizSearchQuery}
                        onChange={e => setQuizSearchQuery(e.target.value)}
                        className="w-full"
                      />
                    </div>

                    {/* Selected Tags Filter */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 rounded-hand border border-chalk-yellow/30 bg-chalk-yellow/5 px-3 py-2">
                        <span className="text-sm text-chalk-dim">{t('filter')}</span>
                        {selectedTags.map((tag, idx) => (
                          <Badge
                            key={idx}
                            variant="info"
                            className="cursor-pointer border-chalk-yellow/40 bg-chalk-yellow/20 text-sm hover:bg-chalk-yellow/30"
                            onClick={(e) => {
                              e.preventDefault();
                              toggleTagFilter(tag);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleTagFilter(tag);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            {tag}
                            {' '}
                            ×
                          </Badge>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto h-5 px-2 text-sm"
                          onClick={(e) => {
                            e.preventDefault();
                            setSelectedTags([]);
                          }}
                        >
                          {t('clear')}
                        </Button>
                      </div>
                    )}

                    {/* Quiz List */}
                    <div className="flex-1 space-y-2 overflow-y-auto">
                      {quizzes
                        .filter((q) => {
                          // Filter by search query
                          if (quizSearchQuery.trim()) {
                            const query = quizSearchQuery.toLowerCase();
                            const matchesSearch = q.title.toLowerCase().includes(query)
                              || q.tags?.some(t => t.name.toLowerCase().includes(query));
                            if (!matchesSearch) {
                              return false;
                            }
                          }
                          // Filter by selected tags (AND logic - quiz must have ALL selected tags)
                          if (selectedTags.length > 0) {
                            const quizTagNames = (q.tags || []).map(t => t.name.trim().toLowerCase());
                            const hasAllTags = selectedTags.every(selectedTag =>
                              quizTagNames.includes(selectedTag.toLowerCase()),
                            );
                            if (!hasAllTags) {
                              return false;
                            }
                          }
                          return true;
                        })
                        .map((q) => {
                          const isSelected = selectedQuizId === q.id;
                          return (
                            <button
                              key={q.id}
                              type="button"
                              onClick={() => {
                                setSelectedQuizId(q.id);
                                // Auto-set session name to quiz title (default)
                                setSessionName(q.title);
                                // Auto-set duration from quiz (always set when selecting a quiz)
                                if (q.durationSeconds !== null) {
                                  setDurationMinutes(Math.floor(q.durationSeconds / 60));
                                } else {
                                  setDurationMinutes(null);
                                }
                              }}
                              className={cn(
                                'w-full rounded-md border transition-all duration-200 text-left',
                                isSelected
                                  ? 'border-chalk-yellow bg-chalk-yellow/10 hover:border-chalk-yellow/70'
                                  : 'border-chalk-faint bg-white/2 hover:border-chalk-yellow/30   cursor-pointer',
                              )}
                            >
                              <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-base font-medium text-chalk">
                                      {q.title}
                                    </div>
                                    <Badge
                                      variant={q.status === 'published' ? 'success' : 'neutral'}
                                      className="shrink-0 text-sm"
                                    >
                                      {q.status}
                                    </Badge>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {q.tags && q.tags.length > 0
                                      ? (
                                          <>
                                            {q.tags.slice(0, 5).map((tag) => {
                                              const tagIsSelected = isTagSelected(tag.name);
                                              return (
                                                <Badge
                                                  key={tag.id}
                                                  variant={tagIsSelected ? 'info' : 'neutral'}
                                                  className={`cursor-pointer text-sm transition-colors ${
                                                    tagIsSelected
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
                                          </>
                                        )
                                      : (
                                          <span className="text-sm text-chalk-dim">{t('no_tags')}</span>
                                        )}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-sm text-chalk-dim">
                                    <span>
                                      {q.ruleCount}
                                      {' '}
                                      {t('rules')}
                                    </span>
                                    {q.durationSeconds !== null && (
                                      <span>
                                        ·
                                        {' '}
                                        {q.durationSeconds >= 3600
                                          ? `${Math.floor(q.durationSeconds / 3600)}h ${Math.floor((q.durationSeconds % 3600) / 60)}m`
                                          : `${Math.floor(q.durationSeconds / 60)} ${t('minutes')}`}
                                      </span>
                                    )}
                                    {q.ruleCount === 0 && (
                                      <Badge variant="neutral" className="border-chalk-yellow/40 bg-chalk-yellow/20 text-sm text-chalk-yellow">
                                        {t('no_rules_warning')}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  {isSelected
                                    ? (
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-chalk-yellow bg-chalk-yellow">
                                          <div className="h-2 w-2 rounded-full bg-white" />
                                        </div>
                                      )
                                    : (
                                        <div className="h-5 w-5 rounded-full border-2 border-chalk-dim" />
                                      )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </>
                )}
          </div>

          {/* Right: Session Configuration - Show when quiz is selected */}
          {selectedQuizId && (
            <div className="space-y-4 overflow-y-auto md:w-2/3 md:pl-6">
              {(() => {
                const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);
                const quizDurationMinutes = selectedQuiz?.durationSeconds
                  ? Math.floor(selectedQuiz.durationSeconds / 60)
                  : null;
                return (
                  <>
                    <div>
                      <label htmlFor="sessionName" className="mb-2 block text-base font-medium text-chalk">
                        {t('session_name')}
                      </label>
                      <Input
                        id="sessionName"
                        type="text"
                        value={sessionName}
                        onChange={e => setSessionName(e.target.value)}
                        placeholder={selectedQuiz?.title || t('session_name_placeholder')}
                        className="w-full"
                      />
                      <p className="mt-1 text-sm text-chalk-dim">
                        {t('session_name_hint')}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="scheduledStartTime" className="mb-2 block text-base font-medium text-chalk">
                        {t('scheduled_start_time')}
                      </label>
                      <div className="space-y-2">
                        <Input
                          id="scheduledStartTime"
                          type="datetime-local"
                          value={scheduledStartTime || getRoundedTime(5)}
                          onChange={e => setScheduledStartTime(e.target.value)}
                          className="w-full"
                          min={new Date().toISOString().slice(0, 16)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setScheduledStartTime(getRoundedTime(5))}
                            className="text-sm"
                          >
                            {t('default_plus_5')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setScheduledStartTime(getRoundedTime(15))}
                            className="text-sm"
                          >
                            {t('plus_15_minutes')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setScheduledStartTime(getRoundedTime(30))}
                            className="text-sm"
                          >
                            {t('plus_30_minutes')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setScheduledStartTime('')}
                            className="text-sm text-chalk-pink/80 hover:text-chalk-pink"
                          >
                            {t('remove')}
                          </Button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-chalk-dim">
                        {t('scheduled_start_time_hint')}
                      </p>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label htmlFor="durationMinutes" className="text-base font-medium text-chalk">
                          {t('duration_minutes')}
                        </label>
                        {quizDurationMinutes && (
                          <Badge variant="info" className="text-sm">
                            {t('quiz_duration', {
                              duration: quizDurationMinutes >= 60
                                ? `${Math.floor(quizDurationMinutes / 60)}h ${quizDurationMinutes % 60 > 0 ? `${quizDurationMinutes % 60}m` : ''}`
                                : `${quizDurationMinutes} ${t('minutes')}`,
                            })}
                          </Badge>
                        )}
                      </div>
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
                          placeholder={quizDurationMinutes ? `${quizDurationMinutes} ${t('minutes')}` : t('unlimited')}
                          className="w-32"
                        />
                        <span className="text-base text-chalk-dim">
                          {durationMinutes !== null && durationMinutes > 0
                            ? (
                                <>
                                  (
                                  {durationMinutes >= 60
                                    ? `${t('hours', { count: Math.floor(durationMinutes / 60) })} ${durationMinutes % 60 > 0 ? `${durationMinutes % 60} ${t('minutes')}` : ''}`
                                    : `${durationMinutes} ${t('minutes')}`}
                                  )
                                </>
                              )
                            : quizDurationMinutes
                              ? (
                                  <span className="text-chalk-dim">
                                    {t('using_default_from_quiz', {
                                      duration: quizDurationMinutes >= 60
                                        ? `${Math.floor(quizDurationMinutes / 60)}h ${quizDurationMinutes % 60}m`
                                        : `${quizDurationMinutes} ${t('minutes')}`,
                                    })}
                                  </span>
                                )
                              : t('unlimited')}
                        </span>
                      </div>
                      {quizDurationMinutes && (
                        <p className="mt-1 text-sm text-chalk-dim">
                          {t('duration_hint_with_default')}
                        </p>
                      )}
                      {!quizDurationMinutes && (
                        <p className="mt-1 text-sm text-chalk-dim">
                          {t('duration_hint_no_default')}
                        </p>
                      )}
                    </div>

                    {durationMinutes && durationMinutes > 0 && (
                      <div>
                        <label htmlFor="bufferMinutes" className="mb-2 block text-base font-medium text-chalk">
                          {t('buffer_minutes')}
                        </label>
                        <div className="flex items-center gap-3">
                          <Input
                            id="bufferMinutes"
                            type="number"
                            min={0}
                            max={60}
                            value={bufferMinutes}
                            onChange={e => setBufferMinutes(Number(e.target.value))}
                            className="w-32"
                          />
                          <span className="text-base text-chalk-dim">
                            {t('buffer_hint', { minutes: bufferMinutes })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-chalk-dim">
                          {t('buffer_default_hint')}
                        </p>
                      </div>
                    )}

                    <div>
                      <label htmlFor="reviewDelayMinutes" className="mb-2 block text-base font-medium text-chalk">
                        {t('allow_review')}
                      </label>
                      <select
                        id="reviewDelayMinutes"
                        value={reviewDelayMinutes === null ? '' : reviewDelayMinutes}
                        onChange={e => setReviewDelayMinutes(e.target.value === '' ? null : Number(e.target.value))}
                        className={cn(s.field, 'w-full')}
                      >
                        <option value="">{t('no_review')}</option>
                        <option value="10">{t('allow_review_10')}</option>
                        <option value="20">{t('allow_review_20')}</option>
                        <option value="30">{t('allow_review_30')}</option>
                        <option value="60">{t('allow_review_60')}</option>
                      </select>
                      <p className="mt-1 text-sm text-chalk-dim">
                        {reviewDelayMinutes === null
                          ? t('no_review_hint')
                          : t('review_hint', { minutes: reviewDelayMinutes })}
                      </p>
                    </div>
                  </>
                );
              })()}

              {createSessionError && (
                <div className="rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-3 text-base text-chalk-pink">
                  {createSessionError}
                </div>
              )}

              <div className="flex gap-2 border-t border-chalk-faint pt-4">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setShowCreateSessionModal(false);
                    setSelectedQuizId('');
                    setQuizSearchQuery('');
                    setSelectedTags([]);
                    setScheduledStartTime('');
                    setDurationMinutes(null);
                    setSessionName('');
                    setBufferMinutes(5);
                    setReviewDelayMinutes(null);
                    setCreateSessionError(null);
                  }}
                >
                  {t('cancel')}
                </Button>
                <Button
                  variant="solid"
                  className="flex-1"
                  disabled={createSessionBusy || !selectedQuizId}
                  onClick={() => void createSession()}
                >
                  {createSessionBusy ? t('creating') : t('create_session_button')}
                </Button>
              </div>
            </div>
          )}
        </div>
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
