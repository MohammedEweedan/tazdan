'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function DataPage() {
  return <LegacyList title="Database" subtitle="Raw records (contact details need customers.pii)." tabs={[
    { key: 'tx', label: 'Transactions', path: '/admin/data/transactions', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'type', label: 'Type' }, { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: any) => money(r.amount, r.currency ?? r.asset) }, { key: 'reference', label: 'Reference' }] },
    { key: 'wallets', label: 'Wallets', path: '/admin/data/wallets', columns: [{ key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'currency', label: 'Currency' }, { key: 'balance', label: 'Balance', align: 'right', render: (r: any) => money(r.balance, r.currency) }, { key: 'frozen', label: 'Held', align: 'right', render: (r: any) => money(r.frozen, r.currency) }] },
    { key: 'banks', label: 'Bank accounts', path: '/admin/data/bank-accounts', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'bankName', label: 'Bank' }, { key: 'accountName', label: 'Account name' }] },
    { key: 'p2p', label: 'P2P trades', path: '/admin/data/p2p-trades', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'id', label: 'Trade', render: (r: any) => shortId(r.id) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
