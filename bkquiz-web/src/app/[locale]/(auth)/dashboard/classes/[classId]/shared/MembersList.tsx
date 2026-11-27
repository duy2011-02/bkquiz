'use client';

import type { Member } from '../types';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '../types';

type MembersListProps = {
  members: Member[];
  isOwner: boolean;
  onAddMember?: () => void;
  ownerTeacherId?: string;
  busy?: boolean;
  onRemoveMember?: (member: Member, ban: boolean) => void;
};

export function MembersList(props: MembersListProps) {
  const { members, isOwner, onAddMember, ownerTeacherId, busy, onRemoveMember } = props;
  const t = useTranslations('Classes.detail');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {isOwner && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-base font-medium text-chalk">
            {t('member_count', { count: members.length })}
          </div>
          {onAddMember && (
            <Button variant="primary" size="sm" className="" onClick={onAddMember}>
              {t('add_member')}
            </Button>
          )}
        </div>
      )}
      {members.length === 0
        ? (
            <div className="py-8 text-center text-base text-chalk-dim">
              {t('no_members_yet')}
            </div>
          )
        : members.map((m, idx) => (
            <div
              key={m.userId}
              className="rounded-hand border border-chalk-faint bg-white/2 transition-all duration-200 hover:border-chalk-yellow/30"
              style={{ animationDelay: `${idx * 30}ms` }}
            >
              <div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 md:grid md:grid-cols-[2fr_auto_120px_100px] md:gap-4">
                  <div className="min-w-0 basis-full md:basis-auto">
                    <div className="truncate text-base font-medium text-chalk">
                      {m.user.name ?? m.user.email ?? 'N/A'}
                    </div>
                    <div className="mt-1 text-sm text-chalk-dim">
                      {m.user.email}
                    </div>
                  </div>
                  <Badge
                    variant={m.roleInClass === 'teacher' ? 'success' : 'neutral'}
                    className="text-sm"
                  >
                    {m.roleInClass === 'teacher' ? t('role_teacher') : t('role_student')}
                  </Badge>
                  <div className="text-sm text-chalk-dim">
                    <span className="font-mono">{formatDate(m.joinedAt, locale)}</span>
                  </div>
                  <div className="hidden text-sm text-chalk-dim md:block">
                    <span>-</span>
                  </div>
                </div>
                {isOwner && onRemoveMember && m.userId !== ownerTeacherId
                  ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onRemoveMember(m, false)}>
                          {t('remove_member')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-chalk-pink hover:text-chalk-pink"
                          disabled={busy}
                          onClick={() => onRemoveMember(m, true)}
                        >
                          {t('ban_member')}
                        </Button>
                      </div>
                    )
                  : (
                      <div className="hidden items-center gap-2 md:flex">
                        <span className="text-sm text-chalk-dim">→</span>
                      </div>
                    )}
              </div>
            </div>
          ))}
    </div>
  );
}
