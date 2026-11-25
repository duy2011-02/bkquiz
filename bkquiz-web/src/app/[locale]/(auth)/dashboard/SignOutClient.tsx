'use client';

import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

type SignOutClientProps = {
  label?: string;
  buttonVariant?: 'ghost' | 'ledge';
  className?: string;
};

export function SignOutClient({ label, buttonVariant = 'ghost', className }: SignOutClientProps) {
  const t = useTranslations('DashboardLayout');
  const displayLabel = label ?? t('sign_out');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      // Xóa cookie dev role nếu đang ở dev mode (server sẽ kiểm tra)
      try {
        await fetch('/api/dev/signout', { method: 'POST' });
      } catch {
        // Ignore nếu không phải dev mode hoặc API không tồn tại
      }
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Error signing out:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={buttonVariant}
      onClick={handleSignOut}
      loading={isLoading}
      className={className}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" x2="9" y1="12" y2="12" />
      </svg>
      <span>{isLoading ? t('signing_out') : displayLabel}</span>
    </Button>
  );
}
