'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldHint, FieldLabel, Input, Textarea } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';

export type TeacherRequestInfo = {
  status: 'pending' | 'approved' | 'rejected';
  organization: string;
  note: string | null;
  reviewNote: string | null;
} | null;

/**
 * Đăng ký làm giáo viên (khi chưa là giáo viên): xem trạng thái yêu cầu, gửi / gửi lại.
 * Quản trị viên duyệt ở /dashboard/admin; được duyệt thì tài khoản có thêm vai trò giáo viên.
 */
export function TeacherRequestCard(props: { request: TeacherRequestInfo }) {
  const t = useTranslations('UserProfile');
  const [request, setRequest] = useState<TeacherRequestInfo>(props.request);
  const [editing, setEditing] = useState(!props.request || props.request.status === 'rejected');
  const [organization, setOrganization] = useState(props.request?.organization ?? '');
  const [note, setNote] = useState(props.request?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  async function submit() {
    if (organization.trim().length < 2) {
      setToast({ message: t('teacher_request_org_required'), type: 'error' });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/user/teacher-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organization, note }),
      });
      const json = await res.json().catch(() => null) as { request?: NonNullable<TeacherRequestInfo>; error?: string } | null;
      if (!res.ok || !json?.request) {
        setToast({ message: t('teacher_request_failed'), type: 'error' });
        return;
      }
      setRequest(json.request);
      setEditing(false);
      setToast({ message: t('teacher_request_sent'), type: 'success' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 p-5 md:p-6">
      <h3 className="text-lg font-semibold text-chalk">{t('teacher_request_title')}</h3>

      {request?.status === 'pending' && !editing
        ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-hand border border-chalk-yellow/40 bg-chalk-yellow/10 p-3 text-base text-chalk-yellow">
                {t('teacher_request_pending', { organization: request.organization })}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>{t('teacher_request_edit')}</Button>
            </div>
          )
        : null}

      {request?.status === 'rejected'
        ? (
            <div className="mt-3 rounded-hand border border-chalk-pink/40 bg-chalk-pink/10 p-3 text-base text-chalk-pink">
              {request.reviewNote ? t('teacher_request_rejected_note', { note: request.reviewNote }) : t('teacher_request_rejected')}
            </div>
          )
        : null}

      {editing
        ? (
            <form
              className="mt-3 max-w-xl space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <p className="text-base text-chalk-dim">{t('teacher_request_intro')}</p>
              <div>
                <FieldLabel htmlFor="tr-organization">{t('teacher_request_org_label')}</FieldLabel>
                <Input id="tr-organization" value={organization} onChange={e => setOrganization(e.target.value)} maxLength={200} disabled={busy} autoComplete="organization" />
              </div>
              <div>
                <FieldLabel htmlFor="tr-note">{t('teacher_request_note_label')}</FieldLabel>
                <Textarea id="tr-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} rows={3} disabled={busy} />
                <FieldHint>{t('teacher_request_hint')}</FieldHint>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" variant="primary" loading={busy}>
                  {request ? t('teacher_request_resend') : t('teacher_request_send')}
                </Button>
                {request?.status === 'pending'
                  ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>{t('teacher_request_cancel')}</Button>
                  : null}
              </div>
            </form>
          )
        : null}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Card>
  );
}
