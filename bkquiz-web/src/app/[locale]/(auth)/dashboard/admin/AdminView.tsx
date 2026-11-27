'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldLabel, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';

type Status = 'pending' | 'approved' | 'rejected';
type RequestRow = {
  id: string;
  organization: string;
  note: string | null;
  status: Status;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  user: { id: string; name: string | null; email: string | null };
};
type TeacherRow = {
  id: string;
  name: string | null;
  email: string | null;
  organization: string | null;
  approvedAt: string | null;
  classCount: number;
  quizCount: number;
};
type Tab = 'pending' | 'reviewed' | 'teachers';

function tabClass(active: boolean) {
  return `px-4 py-2 text-base font-medium transition-colors ${active ? 'border-b-2 border-chalk-yellow text-chalk' : 'text-chalk-dim hover:text-chalk'}`;
}

/** Duyệt yêu cầu làm giáo viên và quản lý danh sách giáo viên. */
export function AdminView(props: { currentUserId: string }) {
  const t = useTranslations('Admin');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('pending');
  const [counts, setCounts] = useState<Record<Status, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<RequestRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [revoking, setRevoking] = useState<TeacherRow | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d)) : '—');

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    try {
      if (which === 'teachers') {
        const res = await fetch('/api/admin/teachers');
        const json = await res.json() as { teachers?: TeacherRow[] };
        setTeachers(json.teachers ?? []);
        return;
      }
      const statuses: Status[] = which === 'pending' ? ['pending'] : ['approved', 'rejected'];
      const results = await Promise.all(statuses.map(st => fetch(`/api/admin/teacher-requests?status=${st}`).then(r => r.json() as Promise<{ requests?: RequestRow[]; counts?: Record<Status, number> }>)));
      const rows = results.flatMap(r => r.requests ?? []);
      rows.sort((a, b) => (b.reviewedAt ?? b.updatedAt).localeCompare(a.reviewedAt ?? a.updatedAt));
      setRequests(which === 'pending' ? rows.reverse() : rows);
      if (results[0]?.counts) {
        setCounts(results[0].counts);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function review(row: RequestRow, action: 'approve' | 'reject', reviewNote?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/teacher-requests/${row.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reviewNote }),
      });
      const name = row.user.name ?? row.user.email ?? '';
      if (!res.ok) {
        setToast({ message: t('action_failed'), type: 'error' });
      } else {
        setToast({ message: action === 'approve' ? t('approved_toast', { name }) : t('rejected_toast', { name }), type: 'success' });
      }
      setRejecting(null);
      setRejectNote('');
      await load(tab);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(row: TeacherRow) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/teachers/${row.id}`, { method: 'DELETE' });
      setToast(res.ok
        ? { message: t('revoked_toast', { name: row.name ?? row.email ?? '' }), type: 'success' }
        : { message: t('action_failed'), type: 'error' });
      setRevoking(null);
      await load('teachers');
    } finally {
      setBusy(false);
    }
  }

  const person = (u: { name: string | null; email: string | null }) => (
    <div className="min-w-0">
      <div className="truncate text-base font-medium text-chalk">{u.name ?? u.email ?? '—'}</div>
      <div className="truncate text-sm text-chalk-dim">{u.email}</div>
    </div>
  );

  return (
    <div className="space-y-7">
      <Card className="p-5 md:p-6">
        <h1 className="font-chalk text-[1.6rem] leading-tight chalk-glow text-chalk md:text-[2rem]">{t('title')}</h1>
        <p className="mt-2 text-base text-chalk-dim">{t('description')}</p>
      </Card>

      <Card className="p-5 md:p-6">
        <div className="flex flex-wrap gap-2 border-b border-chalk-faint" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'pending'} className={tabClass(tab === 'pending')} onClick={() => setTab('pending')}>
            {t('tab_pending', { count: counts.pending })}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'reviewed'} className={tabClass(tab === 'reviewed')} onClick={() => setTab('reviewed')}>
            {t('tab_reviewed')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'teachers'} className={tabClass(tab === 'teachers')} onClick={() => setTab('teachers')}>
            {t('tab_teachers')}
          </button>
        </div>

        <div className="mt-4 space-y-3" role="tabpanel">
          {loading
            ? <div className="py-6 text-center text-chalk-dim">{t('loading')}</div>
            : tab === 'teachers'
              ? (teachers.length === 0
                  ? <div className="py-6 text-center text-chalk-dim">{t('no_teachers')}</div>
                  : teachers.map(row => (
                      <div key={row.id} className="flex flex-col gap-3 rounded-hand border border-chalk-faint bg-white/2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                        {person(row)}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-chalk-dim">
                          {row.organization ? <span>{row.organization}</span> : null}
                          <span>{t('teacher_stats', { classes: row.classCount, quizzes: row.quizCount })}</span>
                          {row.id === props.currentUserId
                            ? <Badge variant="neutral">{t('you')}</Badge>
                            : (
                                <Button size="sm" variant="ghost" className="text-chalk-pink hover:text-chalk-pink" disabled={busy} onClick={() => setRevoking(row)}>
                                  {t('revoke')}
                                </Button>
                              )}
                        </div>
                      </div>
                    )))
              : (requests.length === 0
                  ? <div className="py-6 text-center text-chalk-dim">{tab === 'pending' ? t('no_pending') : t('no_reviewed')}</div>
                  : requests.map(row => (
                      <div key={row.id} className="space-y-2 rounded-hand border border-chalk-faint bg-white/2 px-4 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          {person(row.user)}
                          {row.status === 'pending'
                            ? (
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button size="sm" variant="primary" disabled={busy} onClick={() => void review(row, 'approve')}>{t('approve')}</Button>
                                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRejecting(row)}>{t('reject')}</Button>
                                </div>
                              )
                            : <Badge variant={row.status === 'approved' ? 'success' : 'neutral'}>{row.status === 'approved' ? t('status_approved') : t('status_rejected')}</Badge>}
                        </div>
                        <div className="text-base text-chalk">
                          <span className="text-chalk-dim">{t('organization')}</span>
                          {' '}
                          {row.organization}
                        </div>
                        {row.note ? <p className="text-base whitespace-pre-line text-chalk/85">{row.note}</p> : null}
                        <div className="text-sm text-chalk-dim">
                          {t('submitted_at', { date: fmt(row.updatedAt) })}
                          {row.reviewedAt ? ` · ${t('reviewed_at', { date: fmt(row.reviewedAt) })}` : ''}
                        </div>
                        {row.reviewNote ? <p className="text-sm text-chalk-dim">{t('review_note', { note: row.reviewNote })}</p> : null}
                      </div>
                    )))}
        </div>
      </Card>

      <Modal
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        dismissible={!busy}
        title={t('reject_title', { name: rejecting?.user.name ?? rejecting?.user.email ?? '' })}
        footer={(
          <>
            <Button onClick={() => setRejecting(null)} disabled={busy}>{t('cancel')}</Button>
            <Button variant="solid" loading={busy} onClick={() => rejecting && void review(rejecting, 'reject', rejectNote.trim() || undefined)}>{t('reject')}</Button>
          </>
        )}
      >
        <FieldLabel htmlFor="reject-note">{t('reject_note_label')}</FieldLabel>
        <Textarea id="reject-note" value={rejectNote} onChange={e => setRejectNote(e.target.value)} maxLength={500} rows={3} placeholder={t('reject_note_placeholder')} />
      </Modal>

      <Modal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        dismissible={!busy}
        title={t('revoke_title', { name: revoking?.name ?? revoking?.email ?? '' })}
        footer={(
          <>
            <Button onClick={() => setRevoking(null)} disabled={busy}>{t('cancel')}</Button>
            <Button variant="solid" loading={busy} onClick={() => revoking && void revoke(revoking)}>{t('revoke')}</Button>
          </>
        )}
      >
        <p className="text-base text-chalk">{t('revoke_body')}</p>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
