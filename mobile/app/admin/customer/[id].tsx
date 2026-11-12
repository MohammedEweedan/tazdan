/**
 * One customer — identity, limits, money, activity, security and risk, with
 * freeze, sign-out, feature restriction, device revoke and case controls.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, KV, Note, Pill, Row, Section, Segments, Stats, ago, cockpitCall, dateTime, money, shortId,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

const FEATURES = ['withdrawals', 'deposits', 'p2p', 'fx', 'remittance', 'blockchain', 'cards', 'transfers', 'business_payouts', 'lydt'];
const CASE_TYPES = ['AML', 'KYC', 'FRAUD', 'SANCTIONS', 'PEP', 'SOURCE_OF_FUNDS', 'SOURCE_OF_WEALTH', 'OTHER'];
type Tab = 'overview' | 'money' | 'activity' | 'security' | 'risk' | 'audit';
type Action = 'freeze' | 'unfreeze' | 'signout' | 'restrict' | 'lift' | 'case' | null;

export default function AdminCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>(id ? `/cockpit/customers/${id}` : null);
  const [tab, setTab] = useState<Tab>('overview');
  const [action, setAction] = useState<Action>(null);
  const [device, setDevice] = useState<any>(null);
  const d = q.data;
  const u = d?.identity;
  const frozen = u && u.status !== 'ACTIVE';

  return (
    <AdminScreen title={u ? `${u.firstName} ${u.lastName}` : 'Customer'} subtitle={u ? `@${u.username ?? '—'} · ${u.kycTier} · ${u.accountType}` : undefined}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {!d ? <Empty loading={q.isLoading} text="Customer not found." /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Pill label={u.status} /><Pill label={u.kycStatus} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {can('customers.freeze') ? (frozen
              ? <Btn small label="Unfreeze" onPress={() => setAction('unfreeze')} />
              : <Btn small tone="danger" label="Freeze account" onPress={() => setAction('freeze')} />) : null}
            {can('customers.sessions.revoke') ? <Btn small tone="ghost" label="Sign out everywhere" onPress={() => setAction('signout')} /> : null}
            {can('customers.limits') ? <Btn small tone="ghost" label="Restrict a feature" onPress={() => setAction('restrict')} /> : null}
            {can('customers.limits') ? <Btn small tone="ghost" label="Lift a restriction" onPress={() => setAction('lift')} /> : null}
            {can('compliance.case.manage') ? <Btn small tone="ghost" label="Open case" onPress={() => setAction('case')} /> : null}
            {can('controls.read') ? <Btn small tone="ghost" label="Availability" onPress={() => router.push('/admin/availability' as any)} /> : null}
          </View>
          {!d.piiVisible ? <Note tone="warn">Contact details are masked for your role (needs customers.pii).</Note> : null}
          <Stats items={[
            { label: 'Risk score', value: d.risk.latestScore ?? '—' },
            { label: 'Open cases', value: d.risk.cases.filter((x: any) => x.status !== 'CLOSED').length },
            { label: 'Active sessions', value: d.security.sessions.length },
            { label: 'AML flags', value: d.risk.amlFlags.length },
          ]} />
          <Segments value={tab} onChange={setTab} options={[
            { key: 'overview', label: 'Overview' }, { key: 'money', label: 'Money' }, { key: 'activity', label: 'Activity' },
            { key: 'security', label: 'Security' }, { key: 'risk', label: 'Risk' }, { key: 'audit', label: 'Audit' },
          ]} />

          {tab === 'overview' ? (
            <>
              <Section title="Identity & contact">
                <KV items={[
                  ['Email', u.email], ['Phone', u.phone ?? '—'], ['Country', u.country ?? '—'], ['Customer ID', u.id],
                  ['Joined', dateTime(u.createdAt)], ['Last sign-in', dateTime(u.lastLoginAt)],
                ]} />
              </Section>
              <Section title="KYC & limits">
                <KV items={[
                  ['KYC status', u.kycStatus], ['Tier', u.kycTier], ['Documents', `${d.kycDocuments.length} submitted`],
                  ...Object.entries<any>(d.limits ?? {}).map(([k, h]) => [k, `$${Number(h.daily.used).toFixed(0)} / $${Number(h.daily.limit).toLocaleString()} today`] as [string, string]),
                ]} />
              </Section>
              <Section title="Account controls">
                {d.controls.length ? d.controls.map((c: any, i: number) => (
                  <Row key={c.id ?? i} last={i === d.controls.length - 1} title={`${c.scope} ${c.key}`} subtitle={c.reason} right={<Pill label={c.blocked ? 'BLOCKED' : 'ACTIVE'} />} />
                )) : <Empty text="No controls on this account." />}
              </Section>
            </>
          ) : null}

          {tab === 'money' ? (
            <>
              <Section title="Wallets" subtitle="Balance · held · available">
                {d.balances.wallets.length ? d.balances.wallets.map((w: any, i: number) => (
                  <Row key={w.currency} last={i === d.balances.wallets.length - 1} title={money(w.balance, w.currency)}
                    subtitle={`Held ${money(w.frozen, w.currency)} · available ${money(Number(w.balance) - Number(w.frozen), w.currency)}`} />
                )) : <Empty text="No wallets." />}
              </Section>
              <Section title="Ledger accounts" subtitle="Double-entry balances (authoritative)">
                {d.balances.ledgerAccounts.length ? d.balances.ledgerAccounts.map((a: any, i: number) => (
                  <Row key={`${a.type}:${a.currency}`} last={i === d.balances.ledgerAccounts.length - 1} title={`${a.type} · ${a.currency}`} right={<Pill label={money(a.balance, a.currency)} tone="muted" />} />
                )) : <Empty text="No ledger accounts." />}
              </Section>
              {d.balances.cryptoWallet ? (
                <Section title="Custody addresses">
                  <KV items={[
                    ['ETH / EVM', d.balances.cryptoWallet.ethAddress ?? '—'], ['BTC', d.balances.cryptoWallet.btcAddress ?? '—'],
                    ['SOL', d.balances.cryptoWallet.solAddress ?? '—'], ['TRON', d.balances.cryptoWallet.tronAddress ?? '—'],
                  ]} />
                </Section>
              ) : null}
            </>
          ) : null}

          {tab === 'activity' ? (
            <>
              <Section title="History">
                {d.activity.transactions.length ? d.activity.transactions.slice(0, 40).map((t: any, i: number, all: any[]) => (
                  <Row key={t.id} last={i === all.length - 1} title={`${t.type} · ${money(t.amount, t.currency)}`} subtitle={t.description ?? t.reference ?? ''} meta={dateTime(t.createdAt)}
                    right={t.metadata?.status ? <Pill label={t.metadata.status} /> : undefined}
                    onPress={() => router.push(`/admin/transaction/transaction/${t.id}` as any)} />
                )) : <Empty text="No transactions." />}
              </Section>
              <Section title="Deposits & withdrawals">
                {[...d.activity.deposits.map((x: any) => ({ ...x, kind: 'deposit' })), ...d.activity.withdrawals.map((x: any) => ({ ...x, kind: 'withdrawal' }))]
                  .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 30).map((x, i, all) => (
                    <Row key={`${x.kind}:${x.id}`} last={i === all.length - 1} title={`${x.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} · ${money(x.amount, x.currency)}`} meta={ago(x.createdAt)}
                      right={<Pill label={x.status} />} onPress={() => router.push(`/admin/transaction/${x.kind}/${x.id}` as any)} />
                  ))}
                {!d.activity.deposits.length && !d.activity.withdrawals.length ? <Empty text="None." /> : null}
              </Section>
              <Section title="P2P trades">
                {d.activity.p2pTrades.length ? d.activity.p2pTrades.map((t: any, i: number) => (
                  <Row key={t.id} last={i === d.activity.p2pTrades.length - 1} title={`${t.buyerId === u.id ? 'Buyer' : 'Seller'} · ${money(t.cryptoAmount, t.baseAsset ?? t.currency)}`} meta={ago(t.createdAt)}
                    right={<Pill label={t.status} />} onPress={() => router.push(`/admin/transaction/p2p_trade/${t.id}` as any)} />
                )) : <Empty text="No P2P trades." />}
              </Section>
              <Section title="Remittances">
                {d.activity.remittances.length ? d.activity.remittances.map((r: any, i: number) => (
                  <Row key={r.id} last={i === d.activity.remittances.length - 1} title={`${r.reference} · ${r.corridor?.code ?? ''}`}
                    subtitle={`${money(r.sendAmount, r.sourceCurrency)} → ${money(r.receiveAmount, r.destCurrency)}`} meta={ago(r.createdAt)}
                    right={<Pill label={r.state} />} onPress={() => router.push(`/admin/remittance/${r.id}` as any)} />
                )) : <Empty text="No remittances." />}
              </Section>
            </>
          ) : null}

          {tab === 'security' ? (
            <>
              <Section title="Active sessions">
                {d.security.sessions.length ? d.security.sessions.map((s: any, i: number) => (
                  <Row key={s.id} last={i === d.security.sessions.length - 1} title={s.deviceName ?? s.userAgent ?? 'Session'} subtitle={s.ipAddress ?? '—'} meta={`Last used ${ago(s.lastUsedAt ?? s.updatedAt ?? s.createdAt)}`} />
                )) : <Empty text="No active sessions." />}
              </Section>
              <Section title="Trusted devices">
                {d.security.devices.length ? d.security.devices.map((x: any, i: number) => (
                  <Row key={x.id} last={i === d.security.devices.length - 1} title={x.label ?? 'Device'} subtitle={`Trusted ${ago(x.createdAt)}`}
                    right={can('customers.sessions.revoke') ? <Btn small tone="danger" label="Revoke" onPress={() => setDevice(x)} /> : undefined} />
                )) : <Empty text="No trusted devices." />}
              </Section>
              <Section title="Sign-in history">
                {d.security.logins.slice(0, 20).map((l: any, i: number, all: any[]) => (
                  <Row key={l.id ?? i} last={i === all.length - 1} title={l.ipAddress ?? '—'} subtitle={l.userAgent ?? ''} meta={dateTime(l.createdAt)} right={<Pill label={l.success === false ? 'FAILED' : 'OK'} />} />
                ))}
              </Section>
            </>
          ) : null}

          {tab === 'risk' ? (
            <>
              <Section title="Compliance cases">
                {d.risk.cases.length ? d.risk.cases.map((c: any, i: number) => (
                  <Row key={c.id} last={i === d.risk.cases.length - 1} title={`${c.reference} · ${c.type}`} subtitle={c.title} meta={ago(c.createdAt)}
                    right={<Pill label={c.status} />} onPress={() => router.push(`/admin/compliance/${c.id}` as any)} />
                )) : <Empty text="No cases." />}
              </Section>
              <Section title="AML flags">
                {d.risk.amlFlags.length ? d.risk.amlFlags.map((f: any, i: number) => (
                  <Row key={f.id} last={i === d.risk.amlFlags.length - 1} title={f.reason ?? f.type ?? 'Flag'} meta={ago(f.createdAt)} right={<Pill label={f.status ?? (f.resolved ? 'RESOLVED' : 'OPEN')} />} />
                )) : <Empty text="No AML flags." />}
              </Section>
              <Section title="Risk decisions">
                {d.risk.decisions.length ? d.risk.decisions.slice(0, 20).map((r: any, i: number, all: any[]) => (
                  <Row key={r.id ?? i} last={i === all.length - 1} title={`${r.subjectType} · score ${r.score}`} subtitle={r.triggeredRules.join(', ') || '—'} meta={ago(r.createdAt)} right={<Pill label={r.outcome} />} />
                )) : <Empty text="No risk decisions recorded." />}
              </Section>
              <Section title="Sanctions / PEP screening">
                {d.risk.screening.length ? d.risk.screening.map((s: any, i: number) => (
                  <Row key={s.id ?? i} last={i === d.risk.screening.length - 1} title={s.subjectType} subtitle={s.listsChecked.join(', ') || 'no lists loaded'} meta={ago(s.screenedAt)} right={<Pill label={s.status} />} />
                )) : <Empty text="No screening results yet." />}
              </Section>
            </>
          ) : null}

          {tab === 'audit' ? (
            <Section title="Privileged actions on this customer">
              {d.audit.length ? d.audit.map((a: any, i: number) => (
                <Row key={a.id} last={i === d.audit.length - 1} title={a.action} subtitle={a.newValues?._reason ?? ''} meta={`${dateTime(a.createdAt)} · ${shortId(a.userId)}`} />
              )) : <Empty text="No privileged actions recorded." />}
            </Section>
          ) : null}
        </>
      )}

      <ActionSheet visible={action === 'freeze'} onClose={() => setAction(null)} danger title="Freeze account" confirmLabel="Freeze"
        description="Stops all new money movement and signs the customer out. Cancellations and refunds still work."
        onSubmit={async (_v, reason) => { await cockpitCall(`/cockpit/customers/${id}/freeze`, 'POST', { reason }); await refresh(); }} />
      <ActionSheet visible={action === 'unfreeze'} onClose={() => setAction(null)} title="Unfreeze account" confirmLabel="Unfreeze"
        onSubmit={async (_v, reason) => { await cockpitCall(`/cockpit/customers/${id}/unfreeze`, 'POST', { reason }); await refresh(); }} />
      <ActionSheet visible={action === 'signout'} onClose={() => setAction(null)} title="Sign out everywhere" confirmLabel="Sign out all sessions"
        onSubmit={async (_v, reason) => { await cockpitCall(`/cockpit/customers/${id}/revoke-sessions`, 'POST', { reason }); await refresh(); }} />
      <ActionSheet visible={action === 'restrict' || action === 'lift'} onClose={() => setAction(null)} danger={action === 'restrict'}
        title={action === 'restrict' ? 'Restrict a feature' : 'Lift a restriction'} confirmLabel={action === 'restrict' ? 'Restrict' : 'Lift'}
        fields={[{ key: 'feature', label: 'Feature', type: 'select', options: FEATURES.map((f) => ({ value: f, label: f.replace(/_/g, ' ') })) }]}
        onSubmit={async (v, reason) => { await cockpitCall(`/cockpit/customers/${id}/restrictions`, 'POST', { feature: v.feature, blocked: action === 'restrict', reason }); await refresh(); }} />
      <ActionSheet visible={action === 'case'} onClose={() => setAction(null)} title="Open compliance case" confirmLabel="Open case" reasonLabel="Summary"
        fields={[
          { key: 'type', label: 'Type', type: 'select', options: CASE_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })) },
          { key: 'priority', label: 'Priority', type: 'select', initial: 'MEDIUM', options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((x) => ({ value: x, label: x })) },
        ]}
        onSubmit={async (v, summary) => {
          await cockpitCall(`/cockpit/customers/${id}/cases`, 'POST', { type: v.type, priority: v.priority, title: `${v.type} review — ${u.firstName} ${u.lastName}`, summary });
          await refresh();
        }} />
      <ActionSheet visible={Boolean(device)} onClose={() => setDevice(null)} danger title="Revoke trusted device" confirmLabel="Revoke"
        description="The device must pass step-up verification again on next use."
        onSubmit={async (_v, reason) => { await cockpitCall(`/cockpit/customers/${id}/devices/${device.id}/revoke`, 'POST', { reason }); await refresh(); }} />
    </AdminScreen>
  );
}
