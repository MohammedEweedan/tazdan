'use client';

import { LegacyList } from '@/components/cockpit/LegacyList';
import { dateTime, money, shortId } from '@/lib/cockpit/format';

export default function FeesPage() {
  return <LegacyList title="Fee ledger" subtitle="Every fee charged, in the currency it was charged in." tabs={[
    { key: 'fees', label: 'Fees', path: '/admin/data/platform-fees', columns: [{ key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) }, { key: 'source', label: 'Source', render: (r: any) => r.source ?? r.refType ?? r.type }, { key: 'amount', label: 'Amount', align: 'right' as const, render: (r: any) => money(r.amount, r.currency ?? r.asset) }, { key: 'amountUsd', label: 'USD', align: 'right', render: (r: any) => r.amountUsd == null ? '—' : money(r.amountUsd, 'USD') }, { key: 'reference', label: 'Reference', render: (r: any) => r.reference ?? shortId(r.refId) }] },
  ]} />;
}
