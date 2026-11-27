'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FieldHint, FieldLabel, Input } from '@/components/ui/Input';
import { Toast } from '@/components/ui/Toast';

const NAME_MAX = 80;

/** Hồ sơ: đổi tên hiển thị (hiện trong danh sách thành viên, bảng điểm, trang Theo dõi); email chỉ đọc. */
export function ProfileForm(props: { email: string | null; name: string | null }) {
  const t = useTranslations('UserProfile');
  const router = useRouter();
  const [name, setName] = useState(props.name ?? '');
  const [saved, setSaved] = useState(props.name ?? '');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const trimmed = name.trim();
  const unchanged = trimmed.replace(/\s+/g, ' ') === saved;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json().catch(() => null) as { user?: { name: string }; error?: string; retryAfterSeconds?: number } | null;
      if (!res.ok || !json?.user) {
        setToast({
          message: json?.error === 'RATE_LIMITED' ? t('rate_limited', { seconds: json.retryAfterSeconds ?? 60 }) : t('save_failed'),
          type: 'error',
        });
        return;
      }
      setName(json.user.name);
      setSaved(json.user.name);
      setToast({ message: t('saved'), type: 'success' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 p-5 md:p-6">
      <form
        className="max-w-xl space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div>
          <div className="text-base text-chalk-dim">{t('email')}</div>
          <div className="mt-1 font-medium text-chalk">{props.email ?? '-'}</div>
          <FieldHint>{t('email_hint')}</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor="profile-name">{t('name')}</FieldLabel>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Input
              id="profile-name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={NAME_MAX}
              autoComplete="name"
              disabled={busy}
              className="flex-1"
              aria-describedby="profile-name-hint"
            />
            <Button type="submit" variant="primary" size="sm" disabled={busy || trimmed === '' || unchanged}>
              {t('save')}
            </Button>
          </div>
          <FieldHint id="profile-name-hint">{t('name_hint', { max: NAME_MAX })}</FieldHint>
        </div>
      </form>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </Card>
  );
}
