'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FieldHint, FieldLabel, Input, Textarea } from '@/components/ui/Input';
import { getI18nPath } from '@/utils/Helpers';

/** Chọn "Sinh viên / học sinh" hoặc "Giáo viên" (kèm trường / đơn vị, ghi chú cho quản trị viên). */
export function OnboardingForm() {
  const t = useTranslations('Onboarding');
  const locale = useLocale();
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [organization, setOrganization] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (role === 'teacher' && organization.trim().length < 2) {
      setError(t('organization_required'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(role === 'teacher' ? { role, organization, note } : { role }),
      });
      const json = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok && json?.error !== 'ALREADY_ONBOARDED') {
        setError(t('submit_failed'));
        return;
      }
      // Tải lại toàn trang để layout dashboard đọc trạng thái mới
      window.location.assign(getI18nPath('/dashboard', locale));
    } catch {
      setError(t('submit_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">{t('role_legend')}</legend>
        {(['student', 'teacher'] as const).map(value => (
          <label key={value} className="grid grid-cols-[auto_1fr] items-start gap-x-3 text-base">
            <input
              type="radio"
              name="onboarding-role"
              value={value}
              checked={role === value}
              onChange={() => setRole(value)}
              disabled={busy}
              className="mt-1"
            />
            <span className="font-medium text-chalk">{value === 'student' ? t('role_student') : t('role_teacher')}</span>
            <span className="col-start-2 text-sm text-chalk-dim">{value === 'student' ? t('role_student_hint') : t('role_teacher_hint')}</span>
          </label>
        ))}
      </fieldset>

      {role === 'teacher' && (
        <div className="space-y-3">
          <div>
            <FieldLabel htmlFor="onboarding-organization">{t('organization_label')}</FieldLabel>
            <Input
              id="onboarding-organization"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
              maxLength={200}
              placeholder={t('organization_placeholder')}
              disabled={busy}
              autoComplete="organization"
            />
          </div>
          <div>
            <FieldLabel htmlFor="onboarding-note">{t('note_label')}</FieldLabel>
            <Textarea
              id="onboarding-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t('note_placeholder')}
              disabled={busy}
            />
            <FieldHint>{t('teacher_review_hint')}</FieldHint>
          </div>
        </div>
      )}

      {error ? <p role="alert" className="text-base text-chalk-pink">{error}</p> : null}

      <Button type="submit" variant="solid" className="w-full" loading={busy}>
        {role === 'teacher' ? t('submit_teacher') : t('submit_student')}
      </Button>
    </form>
  );
}
