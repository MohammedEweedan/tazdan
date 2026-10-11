'use client';

import { useState } from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import {
  Box, Button, HStack, Link, Menu, MenuButton, MenuItem, MenuList, Select, Tab, TabList, TabPanel, TabPanels, Tabs, Text, useDisclosure,
} from '@chakra-ui/react';
import { FiChevronDown } from 'react-icons/fi';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { ago, dateTime, money, shortId } from '@/lib/cockpit/format';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, Grid, KV, Loading, Mono, Notice, PageHeader, Panel, ReasonModal, Stat, StatusBadge, useCockpitColors } from '@/components/cockpit/ui';

const FEATURES = ['withdrawals', 'deposits', 'transfers', 'remittance', 'fx', 'p2p', 'cards', 'blockchain'];

export default function Customer360() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const c = useCockpitColors();
  const { data, error, loading, reload } = useApi<any>(`/cockpit/customers/${id}`);
  const freeze = useDisclosure();
  const unfreeze = useDisclosure();
  const logoutAll = useDisclosure();
  const restrict = useDisclosure();
  const caseModal = useDisclosure();
  const [feature, setFeature] = useState('withdrawals');
  const [restrictBlocked, setRestrictBlocked] = useState(true);
  const [caseType, setCaseType] = useState('KYC');
  const [device, setDevice] = useState<any>(null);

  if (loading && !data) return <Loading lines={10} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return null;
  const u = data.identity;
  const frozen = u.status !== 'ACTIVE';
  const blockedFeatures = data.controls.filter((x: any) => x.blocked && x.key.includes(':')).map((x: any) => x.key.split(':')[1]);

  return (
    <Box>
      <PageHeader
        title={`${u.firstName} ${u.lastName}`}
        subtitle={<HStack spacing={2} flexWrap="wrap"><Text>@{u.username ?? '—'}</Text><StatusBadge value={u.status} /><StatusBadge value={u.kycStatus} /><Text fontSize="xs">{u.kycTier} · {u.accountType} · joined {new Date(u.createdAt).toLocaleDateString('en-GB')}</Text></HStack>}
        actions={
          <>
            {can('customers.freeze') ? (frozen
              ? <Button size="sm" onClick={unfreeze.onOpen}>Unfreeze</Button>
              : <Button size="sm" colorScheme="red" variant="outline" onClick={freeze.onOpen}>Freeze account</Button>) : null}
            <Menu>
              <MenuButton as={Button} size="sm" rightIcon={<FiChevronDown />}>Actions</MenuButton>
              <MenuList fontSize="sm">
                <MenuItem isDisabled={!can('customers.sessions.revoke')} onClick={logoutAll.onOpen}>Force sign-out everywhere</MenuItem>
                <MenuItem isDisabled={!can('customers.limits')} onClick={() => { setRestrictBlocked(true); restrict.onOpen(); }}>Restrict a feature…</MenuItem>
                <MenuItem isDisabled={!can('customers.limits')} onClick={() => { setRestrictBlocked(false); restrict.onOpen(); }}>Lift a feature restriction…</MenuItem>
                <MenuItem isDisabled={!can('compliance.case.manage')} onClick={caseModal.onOpen}>Open compliance case…</MenuItem>
              </MenuList>
            </Menu>
          </>
        }
      />
      {!data.piiVisible ? <Box mb={3}><Notice>Contact details are masked for your role (needs customers.pii).</Notice></Box> : null}
      {blockedFeatures.length ? <Box mb={3}><Notice tone="warning">Restricted on this account: {blockedFeatures.join(', ')}</Notice></Box> : null}

      <Grid min="180px">
        <Stat label="Latest risk score" value={data.risk.latestScore ?? '—'} hint={data.risk.latestOutcome ?? 'no decisions yet'} />
        <Stat label="Open cases" value={data.risk.cases.filter((x: any) => x.status !== 'CLOSED').length} hint={`${data.risk.amlFlags.length} AML flags`} />
        <Stat label="Active sessions" value={data.security.sessions.length} hint={`${data.security.devices.length} trusted devices`} />
        <Stat label="2FA" value={u.twoFactorEnabled ? 'Enabled' : 'Off'} hint={u.emailVerified ? 'email verified' : 'email unverified'} />
      </Grid>

      <Tabs mt={5} size="sm" colorScheme="brand" isLazy>
        <TabList flexWrap="wrap">
          <Tab>Profile & risk</Tab><Tab>Balances</Tab><Tab>Activity</Tab><Tab>Remittance</Tab><Tab>Security</Tab><Tab>Cases & support</Tab><Tab>Audit</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
              <Panel title="Identity & contact">
                <KV items={[
                  ['Customer ID', <Mono key="id" copy={u.id}>{u.id}</Mono>], ['Email', u.email], ['Phone', u.phone ?? '—'],
                  ['Country', u.country ?? '—'], ['Date of birth', u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('en-GB') : '—'],
                  ['Base currency', u.baseCurrency], ['Last sign-in', `${dateTime(u.lastLoginAt)}${u.lastLoginIp ? ` · ${u.lastLoginIp}` : ''}`],
                  ['Failed sign-ins', `${u.failedLoginAttempts}${u.lockoutUntil ? ` · locked until ${dateTime(u.lockoutUntil)}` : ''}`],
                ]} />
              </Panel>
              <Panel title="KYC & limits">
                <KV items={[['KYC status', <StatusBadge key="k" value={u.kycStatus} />], ['Tier', u.kycTier], ['Documents', `${data.kycDocuments.length} submitted`]]} />
                {data.limits ? (
                  <Box mt={4}>
                    <DataTable rows={Object.entries(data.limits).map(([action, h]: any) => ({ id: action, action, ...h }))} columns={[
                      { key: 'action', label: 'Action' },
                      { key: 'perTx', label: 'Per transaction', align: 'right', render: (r: any) => `$${Number(r.perTx).toLocaleString()}` },
                      { key: 'daily', label: 'Daily used / limit', align: 'right', render: (r: any) => `$${r.daily.used.toFixed(0)} / $${r.daily.limit.toLocaleString()}` },
                      { key: 'monthly', label: 'Monthly used / limit', align: 'right', render: (r: any) => `$${r.monthly.used.toFixed(0)} / $${r.monthly.limit.toLocaleString()}` },
                    ]} />
                  </Box>
                ) : null}
              </Panel>
              <Panel title="Risk decisions" pad={false}>
                <DataTable rows={data.risk.decisions} empty="No risk decisions recorded." columns={[
                  { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                  { key: 'subjectType', label: 'Subject' },
                  { key: 'outcome', label: 'Outcome', render: (r: any) => <StatusBadge value={r.outcome} /> },
                  { key: 'score', label: 'Score', align: 'right' },
                  { key: 'triggeredRules', label: 'Rules', render: (r: any) => r.triggeredRules.join(', ') || '—' },
                ]} />
              </Panel>
              <Panel title="Sanctions / PEP screening" pad={false}>
                <DataTable rows={data.risk.screening} empty="No screening results yet." columns={[
                  { key: 'screenedAt', label: 'When', render: (r: any) => ago(r.screenedAt) },
                  { key: 'subjectType', label: 'Subject' },
                  { key: 'status', label: 'Result', render: (r: any) => <StatusBadge value={r.status} /> },
                  { key: 'listsChecked', label: 'Lists', render: (r: any) => r.listsChecked.join(', ') || 'none loaded' },
                ]} />
              </Panel>
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Box display="grid" gap={4}>
              <Panel title="Wallets" subtitle="balance · held (reserved for pending withdrawals, budgets, claim links) · available" pad={false}>
                <DataTable rows={data.balances.wallets} columns={[
                  { key: 'currency', label: 'Currency' },
                  { key: 'balance', label: 'Balance', align: 'right', render: (r: any) => money(r.balance, r.currency) },
                  { key: 'frozen', label: 'Held', align: 'right', render: (r: any) => money(r.frozen, r.currency) },
                  { key: 'available', label: 'Available', align: 'right', render: (r: any) => money(Number(r.balance) - Number(r.frozen), r.currency) },
                ]} />
              </Panel>
              <Panel title="Ledger accounts" subtitle="double-entry balances (authoritative)" pad={false} actions={<Link as={NextLink} href={`/admin/ledger?userId=${u.id}`} fontSize="xs">Ledger history →</Link>}>
                <DataTable rows={data.balances.ledgerAccounts} columns={[
                  { key: 'type', label: 'Account' }, { key: 'currency', label: 'Currency' },
                  { key: 'balance', label: 'Ledger balance', align: 'right', render: (r: any) => money(r.balance, r.currency) },
                ]} />
              </Panel>
              {data.balances.cryptoWallet ? (
                <Panel title="Custody addresses & on-chain balances">
                  <KV items={[
                    ['ETH / EVM', <Mono key="e" copy={data.balances.cryptoWallet.ethAddress}>{data.balances.cryptoWallet.ethAddress}</Mono>],
                    ['BTC', <Mono key="b" copy={data.balances.cryptoWallet.btcAddress}>{data.balances.cryptoWallet.btcAddress}</Mono>],
                    ['SOL', <Mono key="s" copy={data.balances.cryptoWallet.solAddress}>{data.balances.cryptoWallet.solAddress}</Mono>],
                    ['TRON', <Mono key="t" copy={data.balances.cryptoWallet.tronAddress}>{data.balances.cryptoWallet.tronAddress}</Mono>],
                    ['ETH', data.balances.cryptoWallet.ethBalance], ['BTC', data.balances.cryptoWallet.btcBalance], ['SOL', data.balances.cryptoWallet.solBalance],
                    ['USDT (ERC20 / TRC20)', `${data.balances.cryptoWallet.usdtErc20Bal} / ${data.balances.cryptoWallet.usdtTrc20Bal}`],
                  ]} />
                </Panel>
              ) : null}
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Box display="grid" gap={4}>
              <Panel title="History" pad={false}>
                <DataTable rows={data.activity.transactions} columns={[
                  { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
                  { key: 'type', label: 'Type' },
                  { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => money(r.amount, r.currency) },
                  { key: 'reference', label: 'Reference', render: (r: any) => <Link as={NextLink} href={`/admin/transactions/transaction/${r.id}`}><Mono>{r.reference ?? shortId(r.id)}</Mono></Link> },
                  { key: 'status', label: 'Status', render: (r: any) => r.metadata?.status ? <StatusBadge value={r.metadata.status} /> : '—' },
                  { key: 'description', label: 'Description' },
                ]} />
              </Panel>
              <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
                <Panel title="Deposits" pad={false}>
                  <DataTable rows={data.activity.deposits} columns={[
                    { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                    { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => <Link as={NextLink} href={`/admin/transactions/deposit/${r.id}`}>{money(r.amount, r.currency)}</Link> },
                    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                  ]} />
                </Panel>
                <Panel title="Withdrawals" pad={false}>
                  <DataTable rows={data.activity.withdrawals} columns={[
                    { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                    { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => <Link as={NextLink} href={`/admin/transactions/withdrawal/${r.id}`}>{money(r.amount, r.currency)}</Link> },
                    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                  ]} />
                </Panel>
                <Panel title="P2P trades" pad={false}>
                  <DataTable rows={data.activity.p2pTrades} columns={[
                    { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                    { key: 'side', label: 'Role', render: (r: any) => (r.buyerId === u.id ? 'Buyer' : 'Seller') },
                    { key: 'cryptoAmount', label: 'Amount', align: 'right', render: (r: any) => <Link as={NextLink} href={`/admin/transactions/p2p_trade/${r.id}`}>{money(r.cryptoAmount, r.baseAsset ?? r.currency)}</Link> },
                    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                  ]} />
                </Panel>
                <Panel title="Claim links & cards" pad={false}>
                  <DataTable rows={[...data.activity.claimLinks.map((x: any) => ({ ...x, kind: 'Claim link' })), ...data.activity.cards.map((x: any) => ({ ...x, kind: `Card •••• ${x.last4}`, amount: null }))]} columns={[
                    { key: 'kind', label: 'Item' },
                    { key: 'amount', label: 'Amount', align: 'right', render: (r: any) => r.amount ? money(r.amount, r.asset) : (r.issuerName ?? '—') },
                    { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                  ]} />
                </Panel>
              </Box>
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Box display="grid" gap={4}>
              <Panel title="Remittances" pad={false}>
                <DataTable rows={data.activity.remittances} empty="No remittances." columns={[
                  { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                  { key: 'reference', label: 'Reference', render: (r: any) => <Link as={NextLink} href={`/admin/remittance/${r.id}`}><Mono>{r.reference}</Mono></Link> },
                  { key: 'corridor', label: 'Corridor', render: (r: any) => r.corridor?.code },
                  { key: 'send', label: 'Send', align: 'right', render: (r: any) => money(r.sendAmount, r.sourceCurrency) },
                  { key: 'receive', label: 'Receive', align: 'right', render: (r: any) => money(r.receiveAmount, r.destCurrency) },
                  { key: 'state', label: 'State', render: (r: any) => <StatusBadge value={r.state} /> },
                ]} />
              </Panel>
              <Panel title="Beneficiaries" pad={false}>
                <DataTable rows={data.activity.beneficiaries} empty="No beneficiaries." columns={[
                  { key: 'fullName', label: 'Name' }, { key: 'country', label: 'Country' }, { key: 'currency', label: 'Currency' },
                  { key: 'payoutMethod', label: 'Payout' },
                  { key: 'screeningStatus', label: 'Screening', render: (r: any) => <StatusBadge value={r.screeningStatus} /> },
                  { key: 'createdAt', label: 'Added', render: (r: any) => ago(r.createdAt) },
                ]} />
              </Panel>
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
              <Panel title="Active sessions" pad={false}>
                <DataTable rows={data.security.sessions} empty="No active sessions." columns={[
                  { key: 'createdAt', label: 'Issued', render: (r: any) => ago(r.createdAt) },
                  { key: 'ipAddress', label: 'IP' },
                  { key: 'userAgent', label: 'Client', render: (r: any) => <Text noOfLines={1} maxW="260px">{r.userAgent ?? '—'}</Text> },
                ]} />
              </Panel>
              <Panel title="Trusted devices" pad={false}>
                <DataTable rows={data.security.devices} empty="No trusted devices." columns={[
                  { key: 'label', label: 'Device', render: (r: any) => r.label ?? r.deviceType ?? '—' },
                  { key: 'location', label: 'Location', render: (r: any) => r.location ?? r.ipAddress ?? '—' },
                  { key: 'lastSeenAt', label: 'Last seen', render: (r: any) => ago(r.lastSeenAt) },
                  { key: 'x', label: '', align: 'right', render: (r: any) => can('customers.sessions.revoke') ? <Button size="xs" variant="ghost" onClick={() => setDevice(r)}>Revoke</Button> : null },
                ]} />
              </Panel>
              <Panel title="Sign-in history" pad={false}>
                <DataTable rows={data.security.logins} columns={[
                  { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
                  { key: 'ipAddress', label: 'IP' }, { key: 'location', label: 'Location' },
                  { key: 'success', label: 'Result', render: (r: any) => <StatusBadge value={r.success ? 'OK' : 'FAILED'} /> },
                ]} />
              </Panel>
              <Panel title="Security events" pad={false}>
                <DataTable rows={data.security.events} empty="No security events." columns={[
                  { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                  { key: 'type', label: 'Event' }, { key: 'severity', label: 'Severity', render: (r: any) => <StatusBadge value={r.severity} /> },
                  { key: 'ipAddress', label: 'IP' },
                ]} />
              </Panel>
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: '1fr 1fr' }} gap={4}>
              <Panel title="Compliance cases" pad={false}>
                <DataTable rows={data.risk.cases} empty="No cases." columns={[
                  { key: 'reference', label: 'Case', render: (r: any) => <Mono>{r.reference}</Mono> },
                  { key: 'type', label: 'Type' }, { key: 'priority', label: 'Priority', render: (r: any) => <StatusBadge value={r.priority} /> },
                  { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                ]} />
              </Panel>
              <Panel title="AML flags" pad={false}>
                <DataTable rows={data.risk.amlFlags} empty="No AML flags." columns={[
                  { key: 'type', label: 'Type' }, { key: 'severity', label: 'Severity', render: (r: any) => <StatusBadge value={r.severity} /> },
                  { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                  { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                ]} />
              </Panel>
              <Panel title="Support escalations" pad={false}>
                <DataTable rows={data.support.escalations} empty="No escalations." columns={[
                  { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status', render: (r: any) => <StatusBadge value={r.status} /> },
                  { key: 'createdAt', label: 'When', render: (r: any) => ago(r.createdAt) },
                ]} />
              </Panel>
              <Panel title="Account controls" pad={false}>
                <DataTable rows={data.controls} empty="No controls on this account." columns={[
                  { key: 'key', label: 'Scope', render: (r: any) => (r.key.includes(':') ? r.key.split(':')[1] : 'entire account') },
                  { key: 'blocked', label: 'State', render: (r: any) => <StatusBadge value={r.blocked ? 'BLOCKED' : 'ACTIVE'} /> },
                  { key: 'reason', label: 'Reason' },
                  { key: 'updatedAt', label: 'Changed', render: (r: any) => ago(r.updatedAt) },
                ]} />
              </Panel>
            </Box>
          </TabPanel>

          <TabPanel px={0}>
            <Panel title="Privileged actions on this customer" pad={false}>
              <DataTable rows={data.audit} empty="No privileged actions recorded." columns={[
                { key: 'createdAt', label: 'When', render: (r: any) => dateTime(r.createdAt) },
                { key: 'action', label: 'Action' },
                { key: 'userId', label: 'Staff', render: (r: any) => <Mono>{shortId(r.userId)}</Mono> },
                { key: 'reason', label: 'Reason', render: (r: any) => r.newValues?._reason ?? '—' },
                { key: 'ipAddress', label: 'IP' },
              ]} />
            </Panel>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ReasonModal isOpen={freeze.isOpen} onClose={freeze.onClose} danger title="Freeze account" confirmLabel="Freeze"
        description={<Text>Suspends the account, signs out every session and blocks all money movement. Existing reservations (pending withdrawals, escrow) are preserved.</Text>}
        onConfirm={async (reason) => { await api(`/cockpit/customers/${id}/freeze`, { method: 'POST', body: { reason } }); await reload(); }} />
      <ReasonModal isOpen={unfreeze.isOpen} onClose={unfreeze.onClose} title="Unfreeze account" confirmLabel="Unfreeze"
        onConfirm={async (reason) => { await api(`/cockpit/customers/${id}/unfreeze`, { method: 'POST', body: { reason } }); await reload(); }} />
      <ReasonModal isOpen={logoutAll.isOpen} onClose={logoutAll.onClose} title="Force sign-out everywhere" confirmLabel="Sign out all sessions"
        onConfirm={async (reason) => { await api(`/cockpit/customers/${id}/revoke-sessions`, { method: 'POST', body: { reason } }); await reload(); }} />
      <ReasonModal isOpen={restrict.isOpen} onClose={restrict.onClose} title={restrictBlocked ? 'Restrict a feature' : 'Lift a restriction'} danger={restrictBlocked}
        description={<Select size="sm" value={feature} onChange={(e) => setFeature(e.target.value)}>{FEATURES.map((f) => <option key={f} value={f}>{f}</option>)}</Select>}
        onConfirm={async (reason) => { await api(`/cockpit/customers/${id}/restrictions`, { method: 'POST', body: { feature, blocked: restrictBlocked, reason } }); await reload(); }} />
      <ReasonModal isOpen={caseModal.isOpen} onClose={caseModal.onClose} title="Open compliance case" confirmLabel="Open case" minLength={5}
        description={<Select size="sm" value={caseType} onChange={(e) => setCaseType(e.target.value)}>{['KYC', 'AML', 'SANCTIONS', 'PEP', 'FRAUD', 'SOURCE_OF_FUNDS', 'SOURCE_OF_WEALTH', 'OTHER'].map((f) => <option key={f} value={f}>{f}</option>)}</Select>}
        onConfirm={async (reason) => { await api(`/cockpit/customers/${id}/cases`, { method: 'POST', body: { type: caseType, title: `${caseType} review — ${u.firstName} ${u.lastName}`, summary: reason } }); await reload(); }} />
      <ReasonModal isOpen={Boolean(device)} onClose={() => setDevice(null)} title="Revoke trusted device" confirmLabel="Revoke"
        description={<Text>The next sensitive action from this device will need a security code again.</Text>}
        onConfirm={async (reason) => { await api(`/cockpit/customers/${id}/devices/${device.id}/revoke`, { method: 'POST', body: { reason } }); setDevice(null); await reload(); }} />
      <Box h={6} /><Text fontSize="11px" color={c.faint}>All actions on this page are recorded with your identity, reason, IP and the before/after state.</Text>
    </Box>
  );
}
