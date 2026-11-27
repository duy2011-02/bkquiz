'use client';

import type { ClassInfo } from '../types';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import QRCode from 'react-qr-code';
import s from '@/components/chalk/chalk.module.css';
import { ChalkRoom } from '@/components/chalk/ChalkRoom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Toast } from '@/components/ui/Toast';
import { cn } from '@/utils/cn';
import { formatDate } from '../types';

type ClassHeaderProps = {
  classInfo: ClassInfo;
  isOwner: boolean;
  onCreateSession?: () => void;
};

export function ClassHeader(props: ClassHeaderProps) {
  const { classInfo, isOwner, onCreateSession } = props;
  const t = useTranslations('Classes.detail');
  const tClasses = useTranslations('Classes');
  const locale = useLocale();
  const [showQRCode, setShowQRCode] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Generate join URL
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/dashboard/classes?join=${classInfo.classCode}`
    : '';

  function shortenUrl(url: string) {
    if (url.length <= 50) {
      return url;
    }
    return `${url.slice(0, 25)}...${url.slice(-25)}`;
  }

  return (
    <Card
      className={`p-5 transition-all  duration-200 md:p-6  ${
        isOwner ? 'border-chalk-yellow/20' : 'border-chalk-blue/20'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 font-chalk text-[1.6rem] leading-tight chalk-glow text-chalk md:text-[2rem]">
              {classInfo.name}
            </h1>
            <Badge variant={isOwner ? 'success' : 'neutral'}>
              {isOwner ? t('role_owner') : t('role_student')}
            </Badge>
            {classInfo.archivedAt ? <Badge variant="neutral">{tClasses('archived_badge')}</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-base text-chalk-dim">
            <span>
              {tClasses('class_code')}
              {' '}
              <span className="font-mono">{classInfo.classCode}</span>
            </span>
            <span>·</span>
            <span>
              {t('member_count', { count: classInfo.memberCount })}
            </span>
            <span>·</span>
            <span>
              {t('created_at')}
              {' '}
              {formatDate(classInfo.createdAt, locale)}
            </span>
          </div>
          <div className="mt-2 text-sm text-chalk-dim">
            {t('owner_label')}
            {' '}
            {classInfo.ownerTeacher.name ?? classInfo.ownerTeacher.email ?? 'N/A'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className=""
              onClick={() => setShowQRCode(true)}
            >
              {t('qr_code_button')}
            </Button>
          )}
          {isOwner && onCreateSession && (
            <Button
              variant="primary"
              size="sm"
              className=""
              onClick={onCreateSession}
            >
              {t('create_session_plus')}
            </Button>
          )}
          <Link href="/dashboard/classes" className={cn(s.btn, s.btnSm, '')}>{t('back')}</Link>
        </div>
      </div>

      {classInfo.archivedAt
        ? (
            <div className="mt-4 rounded-hand border border-chalk-yellow/40 bg-chalk-yellow/10 p-3 text-base text-chalk-yellow">
              {isOwner ? t('archived_note_teacher') : t('archived_note_student')}
            </div>
          )
        : null}

      {/* QR Code Modal - Full Screen giống Teacher Screen */}
      {/* Projector view of the class code: full chalkboard, like the teacher screen */}
      {showQRCode && (
        <div role="dialog" aria-modal="true" aria-label={t('qr_modal_title')}>
          <ChalkRoom
            lockViewport
            className="fixed inset-0 z-modal overflow-y-auto"
            ledge={(
              <Button variant="ledge" onClick={() => setShowQRCode(false)}>
                {t('close')}
              </Button>
            )}
          >
            <header className={s.header}>
              <div className="min-w-0">
                <h2 className={cn(s.title, s.chalk)}>{t('qr_modal_title')}</h2>
                <p className={cn(s.meta, s.dim)}>{classInfo.name}</p>
              </div>
            </header>
            <div className={s.rule} />

            <div className="grid flex-1 items-center gap-8 py-4 lg:grid-cols-2">
              {/* QR code on paper */}
              <div className="flex flex-col items-center gap-3">
                <div className={s.dim}>{t('qr_for_students')}</div>
                {joinUrl
                  ? (
                      <div className="w-full max-w-[min(60vh,420px)] rounded-[10px] border-4 border-wood bg-paper p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]">
                        <QRCode value={joinUrl} size={420} style={{ width: '100%', height: 'auto' }} />
                      </div>
                    )
                  : (
                      <div className="w-full max-w-[min(60vh,420px)]">
                        <div className="bk-skeleton aspect-square w-full" />
                        <div className={cn(s.dim, 'mt-2 text-center')}>{t('loading_qr')}</div>
                      </div>
                    )}
              </div>

              {/* Class code, big enough for the back row */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className={s.dim}>{t('class_code_label')}</div>
                <div className="font-mono text-[clamp(3rem,6.5vw,7.5rem)] leading-none font-bold chalk-glow tracking-[0.3em] text-chalk-yellow">
                  {classInfo.classCode}
                </div>
                <div className="w-full max-w-md">
                  <div className={cn(s.dim, 'font-mono text-sm break-all')}>
                    {joinUrl ? shortenUrl(joinUrl) : '...'}
                  </div>
                  <div className={cn(s.dim, 'mt-1')}>{t('scan_qr_hint')}</div>
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    setToast({ message: t('link_copied'), type: 'success' });
                  }}
                >
                  {t('copy_share_link')}
                </Button>
                <div className={cn(s.note, s.blue, 'max-w-md')}>{t('projector_hint')}</div>
              </div>
            </div>
          </ChalkRoom>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Card>
  );
}
