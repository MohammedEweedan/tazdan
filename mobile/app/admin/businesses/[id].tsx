/**
 * One business — company, owner and verification, team, API keys, webhooks,
 * payout batches and payouts, with KYB decisions and batch release.
 */
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AdminScreen } from '@/components/admin/AdminScreen';
import {
  ActionSheet, Btn, Empty, ErrorNote, KV, Pill, Row, Section, ago, cockpitCall, dateTime, money, num,
  useCockpit, useCockpitRefresh, useStaff,
} from '@/components/admin/cockpit';
import { useThemedPalette } from '@/store/themeStore';

export default function AdminBusiness() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useThemedPalette();
  const router = useRouter();
  const { can } = useStaff();
  const refresh = useCockpitRefresh();
  const q = useCockpit<any>(id ? `/cockpit/businesses/${id}` : null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [batch, setBatch] = useState<{ id: string; approve: boolean } | null>(null);
  const d = q.data;
  const b = d?.business;
  const review = can('businesses.kyb.review');

  return (
    <AdminScreen title={b ? b.tradingName ?? b.companyName : 'Business'} subtitle={b ? `${b.legalName ?? b.companyName} · ${b.country}` : undefined}
      refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}>
      <ErrorNote error={q.error} onRetry={() => q.refetch()} />
      {!b ? <Empty loading={q.isLoading} text="Business not found." /> : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
            <Pill label={b.kybStatus} />
            {review && b.kybStatus !== 'APPROVED' ? <Btn small label="Approve KYB" onPress={() => setDecision('APPROVED')} /> : null}
            {review && b.kybStatus !== 'REJECTED' ? <Btn small tone="danger" label={b.kybStatus === 'APPROVED' ? 'Revoke verification' : 'Reject'} onPress={() => setDecision('REJECTED')} /> : null}
          </View>
          <Section title="Company">
            <KV items={[
              ['Registration no.', b.registrationNo ?? '—'], ['Tax ID', b.taxId ?? '—'], ['Industry', b.industry ?? '—'],
              ['Website', b.website ?? '—'], ['Declared monthly volume', b.monthlyVolumeUsd ? `$${num(b.monthlyVolumeUsd)}` : '—'],
              ['Payout approval threshold', b.approvalThresholdUsd ? `$${num(b.approvalThresholdUsd)}` : 'not set'], ['Use case', b.useCase ?? '—'],
            ]} />
          </Section>
          <Section title="Owner & verification">
            <KV items={[
              ['Owner', `${b.user.firstName} ${b.user.lastName}`], ['Email', b.user.email], ['Account', b.user.status], ['Owner KYC', b.user.kycStatus],
              ['KYB reviewed', b.kybReviewedAt ? dateTime(b.kybReviewedAt) : '—'], ['KYB notes', b.kybNotes ?? '—'],
            ]} />
            <View style={{ paddingVertical: 8 }}><Btn small tone="ghost" label="Open owner" onPress={() => router.push(`/admin/customer/${b.user.id}` as any)} /></View>
          </Section>
          <Section title="Balances">
            {d.wallets.filter((w: any) => Number(w.balance) > 0 || Number(w.frozen) > 0).map((w: any, i: number, all: any[]) => (
              <Row key={w.currency} last={i === all.length - 1} title={money(w.balance, w.currency)} subtitle={`Held ${money(w.frozen, w.currency)}`} />
            ))}
            {!d.wallets.some((w: any) => Number(w.balance) > 0) ? <Empty text="No balances." /> : null}
          </Section>
          <Section title="Payout batches" subtitle="Batches held for compliance review can be released or rejected">
            {b.payoutBatches.length ? b.payoutBatches.map((r: any, i: number) => (
              <Row key={r.id} last={i === b.payoutBatches.length - 1} title={`${r.reference} · ${money(r.totalAmount, r.currency)}`} subtitle={`${r.count} payments · ${r.source ?? 'APP'}`} meta={dateTime(r.createdAt)}
                right={<View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Pill label={r.status} />
                  {r.status === 'COMPLIANCE_REVIEW' && can('compliance.decide') ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Btn small label="Release" onPress={() => setBatch({ id: r.id, approve: true })} />
                      <Btn small tone="danger" label="Reject" onPress={() => setBatch({ id: r.id, approve: false })} />
                    </View>
                  ) : null}
                </View>} />
            )) : <Empty text="No batches." />}
          </Section>
          <Section title="Recent payouts">
            {b.payouts.length ? b.payouts.slice(0, 20).map((r: any, i: number, all: any[]) => (
              <Row key={r.id} last={i === all.length - 1} title={`${money(r.amount, r.currency)} → ${r.recipientHandle ?? r.recipientEmail ?? r.recipientUserId?.slice(0, 8) ?? '—'}`}
                subtitle={r.failureReason ?? `${r.reference} · fee ${money(r.feeAmount, r.currency)}`} meta={dateTime(r.createdAt)} right={<Pill label={r.status} />} />
            )) : <Empty text="No payouts." />}
          </Section>
          <Section title="Team">
            {b.team.length ? b.team.map((m: any, i: number) => (
              <Row key={m.id ?? m.email} last={i === b.team.length - 1} title={m.email} subtitle={m.role} meta={m.joinedAt ? `Joined ${ago(m.joinedAt)}` : 'Invited'} right={<Pill label={m.status} />} />
            )) : <Empty text="No team members." />}
          </Section>
          <Section title="API keys" subtitle="Prefix only; secrets are never shown">
            {b.apiKeys.length ? b.apiKeys.map((k: any, i: number) => (
              <Row key={k.id} last={i === b.apiKeys.length - 1} title={`${k.name} · ${k.prefix}…`} subtitle={k.permissions.join(', ')} meta={`${k.usageCount} calls · last used ${k.lastUsedAt ? ago(k.lastUsedAt) : 'never'}`}
                right={<Pill label={k.isActive ? 'ACTIVE' : 'DISABLED'} />} />
            )) : <Empty text="No API keys." />}
          </Section>
          <Section title="Webhooks">
            {b.webhooks.length ? b.webhooks.map((w: any, i: number) => (
              <Row key={w.id} last={i === b.webhooks.length - 1} title={w.url} subtitle={w.events.join(', ')} right={<Pill label={w.status} />} />
            )) : <Empty text="No webhook endpoints." />}
          </Section>
          <Section title="Compliance cases">
            {d.cases.length ? d.cases.map((c: any, i: number) => (
              <Row key={c.id} last={i === d.cases.length - 1} title={`${c.reference} · ${c.type}`} right={<Pill label={c.status} />} onPress={() => router.push(`/admin/compliance/${c.id}` as any)} />
            )) : <Empty text="No cases." />}
          </Section>
        </>
      )}
      <ActionSheet visible={Boolean(decision)} onClose={() => setDecision(null)} danger={decision === 'REJECTED'}
        title={decision === 'APPROVED' ? 'Approve KYB' : 'Reject KYB'} confirmLabel={decision === 'APPROVED' ? 'Approve' : 'Reject'} reasonLabel="Note"
        description={decision === 'APPROVED' ? 'The business name and logo become visible to payers, and payouts open.' : 'Business payouts and merchant branding stop.'}
        onSubmit={async (_v, note) => { await cockpitCall(`/cockpit/businesses/${id}/kyb`, 'POST', { decision, note }); await refresh(); }} />
      <ActionSheet visible={Boolean(batch)} onClose={() => setBatch(null)} danger={batch?.approve === false}
        title={batch?.approve ? 'Release payout batch' : 'Reject payout batch'} confirmLabel={batch?.approve ? 'Release' : 'Reject'} reasonLabel="Note"
        onSubmit={async (_v, note) => { await cockpitCall(`/cockpit/businesses/batches/${batch!.id}/review`, 'POST', { approve: batch!.approve, note }); await refresh(); }} />
    </AdminScreen>
  );
}
