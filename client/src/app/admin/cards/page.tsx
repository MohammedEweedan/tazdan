'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function CardsPage() {
  return <LegacyList title="Cards" subtitle="Issued cards and card transactions." tabs={[
    { key: 'cards', label: 'Cards', path: '/admin/cards', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'last4', label: 'Card', render: (r: any) => `•••• ${r.last4 ?? '—'}` }, { key: 'tier', label: 'Tier' }, { key: 'balance', label: 'Balance', align: 'right', render: (r: any) => money(r.balance, r.currency) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
    { key: 'tx', label: 'Transactions', path: '/admin/card-transactions', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'merchant', label: 'Merchant' }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: any) => money(r.amount, r.currency ?? r.asset) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
