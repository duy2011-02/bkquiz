'use client';

import type { Member, Session } from '../types';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';

type StatsCardsProps = {
  members: Member[];
  sessions: Session[];
  isOwner: boolean;
};

export function StatsCards(props: StatsCardsProps) {
  const { members, sessions, isOwner } = props;
  const t = useTranslations('Classes.detail');

  return (
    <div
      className="grid gap-4 md:grid-cols-4"
    >
      <Card
        className={`p-4 transition-all duration-200   ${
          isOwner ? '' : 'border-chalk-blue/20'
        }`}
      >
        <div className="text-sm text-chalk-dim">{t('stat_members')}</div>
        <div className={`mt-1 text-2xl font-semibold ${isOwner ? 'text-chalk' : 'text-chalk-blue'}`}>
          {members.length}
        </div>
      </Card>
      <Card
        className={`p-4 transition-all duration-200   ${
          isOwner ? '' : 'border-chalk-blue/20'
        }`}
      >
        <div className="text-sm text-chalk-dim">{t('stat_total_sessions')}</div>
        <div className={`mt-1 text-2xl font-semibold ${isOwner ? 'text-chalk' : 'text-chalk-blue'}`}>
          {sessions.length}
        </div>
      </Card>
      <Card
        className={`p-4 transition-all duration-200   ${
          isOwner ? '' : 'border-chalk-blue/20'
        }`}
      >
        <div className="text-sm text-chalk-dim">{t('stat_active_sessions')}</div>
        <div className={`mt-1 text-2xl font-semibold ${isOwner ? 'text-chalk' : 'text-chalk-blue'}`}>
          {sessions.filter(s => s.status === 'active').length}
        </div>
      </Card>
      <Card
        className={`p-4 transition-all duration-200   ${
          isOwner ? '' : 'border-chalk-blue/20'
        }`}
      >
        <div className="text-sm text-chalk-dim">{t('stat_ended_sessions')}</div>
        <div className={`mt-1 text-2xl font-semibold ${isOwner ? 'text-chalk' : 'text-chalk-blue'}`}>
          {sessions.filter(s => s.status === 'ended').length}
        </div>
      </Card>
    </div>
  );
}
