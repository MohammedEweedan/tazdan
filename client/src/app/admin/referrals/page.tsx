'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function ReferralsPage() {
  return <LegacyList title="Referrals" subtitle="Referral rewards." tabs={[
    { key: 'rewards', label: 'Rewards', path: '/admin/referrals', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'referrerId', label: 'Referrer', render: (r: any) => shortId(r.referrerId ?? r.userId) }, { key: 'refereeId', label: 'Referred', render: (r: any) => shortId(r.refereeId) }, { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: any) => money(r.amount, r.currency ?? r.asset) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
