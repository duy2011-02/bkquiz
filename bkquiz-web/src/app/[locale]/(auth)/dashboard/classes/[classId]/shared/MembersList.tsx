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
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="grid min-w-0 flex-1 grid-cols-[1fr_auto_auto_auto] items-center gap-4 md:grid-cols-[2fr_auto_120px_100px]">
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-chalk">
                      {m.user.name ?? m.user.email ?? 'N/A'}
                    </div>
                    <div className="mt-1 text-sm text-chalk-dim">
                      {m.user.email}
                    </div>
                  </div>
                  <Badge
                    variant={m.roleInClass === 'teacher' ? 'success' : (m.roleInClass === 'ta' ? 'info' : 'neutral')}
                    className="text-sm"
                  >
                    {m.roleInClass === 'teacher' ? t('role_teacher') : (m.roleInClass === 'ta' ? t('role_ta') : t('role_student'))}
                  </Badge>
                  <div className="text-sm text-chalk-dim">
                    <span className="font-mono">{formatDate(m.joinedAt, locale)}</span>
                  </div>
                  <div className="text-sm text-chalk-dim">
                    <span>-</span>
                  </div>
                </div>
                {isOwner && onRemoveMember && m.userId !== ownerTeacherId
                  ? (
                      <div className="flex items-center gap-2">
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
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-chalk-dim">→</span>
                      </div>
                    )}
              </div>
            </div>
          ))}
    </div>
  );
}
