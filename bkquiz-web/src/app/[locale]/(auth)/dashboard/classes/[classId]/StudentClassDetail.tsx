'use client';

import type { ClassInfo, Member, Session } from './types';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ClassHeader } from './shared/ClassHeader';
import { MembersList } from './shared/MembersList';
import { SessionsList } from './shared/SessionsList';
import { StatsCards } from './shared/StatsCards';

type StudentClassDetailProps = {
  classId: string;
};

export function StudentClassDetail(props: StudentClassDetailProps) {
  const { classId } = props;
  const t = useTranslations('Classes.detail');
  const tClasses = useTranslations('Classes');
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeTab, setActiveTab] = useState<'members' | 'sessions'>('members');
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const router = useRouter();

  async function leaveClass() {
    if (!classInfo || !window.confirm(t('confirm_leave_class', { name: classInfo.name }))) {
      return;
    }
    setLeaving(true);
    setLeaveError(null);
    try {
      const res = await fetch(`/api/classes/${classId}/members/me`, { method: 'DELETE' });
      if (!res.ok) {
        setLeaveError(t('error_generic'));
        return;
      }
      router.push('/dashboard/classes');
    } finally {
      setLeaving(false);
    }
  }

  async function loadClassInfo() {
    const res = await fetch(`/api/classes/${classId}`, { method: 'GET' });
    const json = await res.json() as ClassInfo | { error?: string };
    if (!res.ok) {
      return;
    }
    setClassInfo(json as ClassInfo);
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
    try {
      const res = await fetch(`/api/classes/${classId}/sessions`, { method: 'GET' });
      const json = await res.json() as { sessions?: Session[]; error?: string };
      if (!res.ok) {
        console.error('Failed to load sessions:', json.error);
        return;
      }
      setSessions(json.sessions ?? []);
    } catch (err) {
      console.error('Error loading sessions:', err);
    }
  }

  useEffect(() => {
    void Promise.all([loadClassInfo(), loadMembers(), loadSessions()]);
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
            {tClasses('meta_title')}
          </Link>
          <span>·</span>
          <span className="text-chalk">{classInfo.name}</span>
          <Badge variant="info" className="ml-2 px-1.5 py-0.5 text-sm">
            {t('role_student')}
          </Badge>
        </div>
      </nav>

      {/* Class Header */}
      <ClassHeader classInfo={classInfo} isOwner={isOwner} />

      {/* Stats Cards */}
      <StatsCards members={members} sessions={sessions} isOwner={isOwner} />

      {/* Tabs */}
      <Card className="border-chalk-blue/20 p-5 md:p-6">
        <div className="flex gap-2 border-b border-chalk-faint">
          <button
            type="button"
            className={`px-4 py-2 text-base font-medium transition-colors ${
              activeTab === 'members'
                ? 'border-b-2 border-chalk-blue text-chalk'
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
                ? 'border-b-2 border-chalk-blue text-chalk'
                : 'text-chalk-dim hover:text-chalk'
            }`}
            onClick={() => setActiveTab('sessions')}
          >
            {t('my_sessions')}
          </button>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {activeTab === 'members' && (
            <MembersList members={members} isOwner={isOwner} />
          )}

          {activeTab === 'sessions' && (
            <SessionsList sessions={sessions} isStudent />
          )}
        </div>
      </Card>

      {!isOwner && (
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-chalk-pink hover:text-chalk-pink"
            disabled={leaving}
            onClick={() => void leaveClass()}
          >
            {t('leave_class')}
          </Button>
          <div className="text-sm text-chalk-dim">{leaveError ?? t('leave_class_hint')}</div>
        </div>
      )}
    </div>
  );
}
