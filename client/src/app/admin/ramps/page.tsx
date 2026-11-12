'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { StatusBadge } from '@/components/cockpit/ui';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function RampsPage() {
  return <LegacyList title="On/off ramps" subtitle="Card top-ups and off-ramp payouts through ramp providers." tabs={[
    { key: 'on', label: 'On-ramps', path: '/admin/onramps', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'provider', label: 'Provider' }, { key: 'fiat', label: 'Paid', align: 'right', render: (r: any) => money(r.fiatAmount, r.fiatCurrency) }, { key: 'crypto', label: 'Credited', align: 'right', render: (r: any) => money(r.cryptoAmount, r.cryptoCurrency) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
    { key: 'off', label: 'Off-ramps', path: '/admin/offramps', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'userId', label: 'Customer', render: (r: any) => r.user ? `${r.user.firstName ?? ''} ${r.user.lastName ?? ''}`.trim() || shortId(r.userId) : shortId(r.userId) }, { key: 'provider', label: 'Provider' }, { key: 'crypto', label: 'Sold', align: 'right', render: (r: any) => money(r.cryptoAmount, r.cryptoCurrency) }, { key: 'fiat', label: 'Paid out', align: 'right', render: (r: any) => money(r.fiatAmount, r.fiatCurrency) }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> }] },
  ]} />;
}
