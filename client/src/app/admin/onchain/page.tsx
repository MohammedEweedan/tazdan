'use client';

import { LegacyList, call } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function OnchainPage() {
  return <LegacyList title="On-chain" subtitle="On-chain withdrawals waiting to be marked sent, the on-chain record and the withdrawal whitelist." tabs={[
    { key: 'pending', label: 'Withdrawals', path: '/admin/on-chain-txs', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'asset', label: 'Asset', render: (r: any) => r.asset ?? r.currency }, { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: any) => money(r.amount, r.currency ?? r.asset) }, { key: 'toAddress', label: 'To', render: (r: any) => shortId(r.toAddress ?? r.walletAddress, 12) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }],
      actions: [{ label: 'Mark sent', perm: 'withdrawals.approve', show: (r: any) => !r.txHash, fields: [{ key: 'txHash', label: 'Transaction hash' }], run: (r: any, v) => call(`/admin/on-chain-txs/${r.id}/sent`, 'PUT', { txHash: v.txHash }) }] },
    { key: 'all', label: 'On-chain record', path: '/admin/onchain-transactions', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'type', label: 'Type' }, { key: 'asset', label: 'Asset' }, { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: any) => money(r.amount, r.currency ?? r.asset) }, { key: 'txHash', label: 'Hash', render: (r: any) => shortId(r.txHash, 14) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
    { key: 'whitelist', label: 'Whitelist', path: '/admin/withdrawal-whitelist', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'address', label: 'Address', render: (r: any) => shortId(r.address, 16) }, { key: 'network', label: 'Network' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
