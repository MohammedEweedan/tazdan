'use client';

import { LegacyList, call } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function P2pPage() {
  return <LegacyList title="P2P" subtitle="Listings, trades and disputes. Resolving a dispute releases or returns the escrow." tabs={[
    { key: 'listings', label: 'Listings', path: '/admin/p2p/listings', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'side', label: 'Side' }, { key: 'pair', label: 'Pair', render: (r: any) => `${r.baseAsset ?? r.currency}/${r.fiatAsset ?? r.fiatCurrency}` }, { key: 'price', label: 'Price', align: 'right' }, { key: 'amount', label: 'Amount', align: 'right' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
    { key: 'trades', label: 'Trades', path: '/admin/p2p/trades', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'id', label: 'Trade', render: (r: any) => shortId(r.id) }, { key: 'cryptoAmount', label: 'Amount', align: 'right', render: (r: any) => money(r.cryptoAmount ?? r.amount, r.baseAsset ?? r.currency) }, { key: 'fiatAmount', label: 'Fiat', align: 'right', render: (r: any) => money(r.fiatAmount, r.fiatAsset ?? r.fiatCurrency) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
    { key: 'disputes', label: 'Disputes', path: '/admin/p2p/disputes', empty: 'No disputes.', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'tradeId', label: 'Trade', render: (r: any) => shortId(r.tradeId ?? r.id) }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }],
      actions: [{ label: 'Resolve', perm: 'disputes.resolve', danger: true, show: (r: any) => !['RESOLVED', 'CLOSED'].includes(r.status),
        fields: [{ key: 'outcome', label: 'Escrow goes to', type: 'select', options: [{ value: 'BUYER', label: 'Buyer (release)' }, { value: 'SELLER', label: 'Seller (return)' }] }, { key: 'resolution', label: 'Resolution (recorded)', type: 'textarea' }],
        run: (r: any, v) => call(`/admin/p2p/disputes/${r.id}/resolve`, 'PUT', { outcome: v.outcome, resolution: v.resolution }) }] },
  ]} />;
}
