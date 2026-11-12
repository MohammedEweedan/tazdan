'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function OrdersPage() {
  return <LegacyList title="Orders" subtitle="Crypto buy and sell orders." tabs={[
    { key: 'orders', label: 'Orders', path: '/admin/orders', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'side', label: 'Side' }, { key: 'asset', label: 'Asset' }, { key: 'cryptoAmount', label: 'Amount', align: 'right' }, { key: 'fiatAmount', label: 'Fiat', align: 'right', render: (r: any) => money(r.fiatAmount, r.settlementCurrency ?? 'USD') }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
