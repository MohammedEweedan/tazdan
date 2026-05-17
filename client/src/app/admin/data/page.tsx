'use client';

/**
 * Universal admin data browser — one page, many tabs, full DB visibility.
 *
 * Each tab paginates through one extended admin endpoint added in
 * Phase 3.1 (server/src/controllers/adminExtras.controller.ts). The
 * goal is *visibility first* — admins can drill into every model. Per
 * model, write-actions (resolve dispute, revoke key, etc.) are exposed
 * via inline row buttons where the server supports them.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Heading, Text, Button, Table, Thead, Tbody, Tr, Th, Td, Badge,
  useColorModeValue, useToast, Spinner, Flex, HStack, Tabs, TabList,
  TabPanels, Tab, TabPanel, Select, Input, IconButton,
} from '@chakra-ui/react';
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { adminAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Loader = (page: number, ...args: any[]) => Promise<any>;

interface TabConfig {
  key: string;
  label: string;
  // The loader returns the axios response; we extract `.data.items` and `.data.totalPages`.
  loader: Loader;
  /** Columns: header label + accessor function returning the cell content. */
  columns: { label: string; cell: (row: any) => React.ReactNode }[];
  /** Optional row-level actions rendered in the last column. */
  rowActions?: (row: any, refresh: () => void, toast: any) => React.ReactNode;
  /** Optional filter dropdown rendered in the toolbar. */
  filterKey?: string;
  filterOptions?: { label: string; value: string }[];
}

const fmt = (v: any, digits = 2) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const TABS: TabConfig[] = [
  {
    key: 'p2p-listings',
    label: 'P2P Listings',
    loader: (page, status) => adminAPI.getP2PListings(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'ACTIVE', value: 'ACTIVE' },
      { label: 'CANCELLED', value: 'CANCELLED' },
      { label: 'COMPLETED', value: 'COMPLETED' },
    ],
    columns: [
      { label: 'Side',     cell: (r) => <Badge colorScheme={r.side === 'BUY' ? 'green' : 'red'}>{r.side}</Badge> },
      { label: 'User',     cell: (r) => r.user?.email ?? r.userId },
      { label: 'Asset',    cell: (r) => r.baseAsset ?? r.currency },
      { label: 'Price',    cell: (r) => fmt(r.price, 4) },
      { label: 'Amount',   cell: (r) => fmt(r.amount, 6) },
      { label: 'Status',   cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'Created',  cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'p2p-trades',
    label: 'P2P Trades',
    loader: (page, status) => adminAPI.getP2PTrades(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'AWAITING_ESCROW', value: 'AWAITING_ESCROW' },
      { label: 'ESCROW_FUNDED',   value: 'ESCROW_FUNDED' },
      { label: 'PAYMENT_SENT',    value: 'PAYMENT_SENT' },
      { label: 'COMPLETED',       value: 'COMPLETED' },
      { label: 'DISPUTED',        value: 'DISPUTED' },
      { label: 'CANCELLED',       value: 'CANCELLED' },
    ],
    columns: [
      { label: 'Reference', cell: (r) => <Text fontFamily="mono" fontSize="xs">{r.reference}</Text> },
      { label: 'Buyer',     cell: (r) => r.buyer?.email ?? r.buyerId },
      { label: 'Seller',    cell: (r) => r.seller?.email ?? r.sellerId },
      { label: 'Crypto',    cell: (r) => `${fmt(r.cryptoAmount, 6)} ${r.baseAsset ?? r.currency}` },
      { label: 'Fiat',      cell: (r) => `${fmt(r.fiatAmount, 2)} ${r.fiatAsset ?? r.fiatCurrency}` },
      { label: 'Status',    cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'Created',   cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'p2p-disputes',
    label: 'P2P Disputes',
    loader: (page, status) => adminAPI.getP2PDisputes(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'OPEN', value: 'OPEN' },
      { label: 'INVESTIGATING', value: 'INVESTIGATING' },
      { label: 'RESOLVED', value: 'RESOLVED' },
      { label: 'CLOSED', value: 'CLOSED' },
    ],
    columns: [
      { label: 'Trade',    cell: (r) => <Text fontFamily="mono" fontSize="xs">{r.tradeId?.slice(0, 8)}…</Text> },
      { label: 'Raised By', cell: (r) => r.raisedById },
      { label: 'Reason',   cell: (r) => r.reason ?? '—' },
      { label: 'Status',   cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'Created',  cell: (r) => formatDate(r.createdAt) },
    ],
    rowActions: (row, refresh, toast) =>
      row.status !== 'RESOLVED' && row.status !== 'CLOSED' ? (
        <Button size="xs" colorScheme="green" onClick={async () => {
          try {
            await adminAPI.resolveP2PDispute(row.id, { resolution: 'Resolved by admin', status: 'RESOLVED' });
            toast({ title: 'Resolved', status: 'success' });
            refresh();
          } catch (e: any) {
            toast({ title: e.response?.data?.error ?? 'Failed', status: 'error' });
          }
        }}>Resolve</Button>
      ) : null,
  },
  {
    key: 'cards',
    label: 'Cards',
    loader: (page, status) => adminAPI.getCards(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'ACTIVE',    value: 'ACTIVE' },
      { label: 'FROZEN',    value: 'FROZEN' },
      { label: 'CANCELLED', value: 'CANCELLED' },
    ],
    columns: [
      { label: 'Holder',    cell: (r) => r.cardHolder ?? r.user?.email },
      { label: 'Last4',     cell: (r) => <Text fontFamily="mono">**** {r.last4}</Text> },
      { label: 'Tier',      cell: (r) => <Badge colorScheme="purple">{r.tier}</Badge> },
      { label: 'Currency',  cell: (r) => r.currency },
      { label: 'Spent (mo)', cell: (r) => fmt(r.spentMonth, 2) },
      { label: 'Status',    cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'Issued',    cell: (r) => formatDate(r.issuedAt) },
    ],
  },
  {
    key: 'card-transactions',
    label: 'Card Txns',
    loader: (page, declined) => adminAPI.getCardTransactions(page, declined as any),
    filterKey: 'declined',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'Approved', value: 'false' },
      { label: 'Declined', value: 'true' },
    ],
    columns: [
      { label: 'User',     cell: (r) => r.user?.email ?? r.userId },
      { label: 'Merchant', cell: (r) => r.merchant ?? '—' },
      { label: 'Type',     cell: (r) => <Badge>{r.type}</Badge> },
      { label: 'Amount',   cell: (r) => `${fmt(r.amount, 2)} ${r.currency}` },
      { label: 'Status',   cell: (r) => r.declined ? <Badge colorScheme="red">DECLINED</Badge> : <Badge colorScheme="green">OK</Badge> },
      { label: 'Date',     cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'messages',
    label: 'Messages',
    loader: (page) => adminAPI.getMessages(page),
    columns: [
      { label: 'From',    cell: (r) => r.sender?.email ?? r.senderId },
      { label: 'To',      cell: (r) => r.receiver?.email ?? r.receiverId },
      { label: 'Kind',    cell: (r) => <Badge>{r.kind ?? 'TEXT'}</Badge> },
      { label: 'Body',    cell: (r) => <Text noOfLines={1} maxW="320px">{r.content ?? '—'}</Text> },
      { label: 'Created', cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    loader: (page, status) => adminAPI.getMessageReports(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'PENDING',  value: 'PENDING' },
      { label: 'REVIEWED', value: 'REVIEWED' },
      { label: 'DISMISSED', value: 'DISMISSED' },
    ],
    columns: [
      { label: 'Reporter', cell: (r) => r.reporterId },
      { label: 'Target',   cell: (r) => r.reportedUserId ?? '—' },
      { label: 'Reason',   cell: (r) => <Text noOfLines={1} maxW="320px">{r.reason ?? '—'}</Text> },
      { label: 'Status',   cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'Created',  cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'referrals',
    label: 'Referrals',
    loader: (page, status) => adminAPI.getReferrals(page, status),
    columns: [
      { label: 'Referrer', cell: (r) => r.referrerId },
      { label: 'Referee',  cell: (r) => r.refereeId ?? '—' },
      { label: 'Amount',   cell: (r) => `${fmt(r.amount, 2)} ${r.currency}` },
      { label: 'Status',   cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'Created',  cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'sessions',
    label: 'Sessions',
    loader: (page) => adminAPI.getSessions(page),
    columns: [
      { label: 'User',     cell: (r) => r.user?.email ?? r.userId },
      { label: 'IP',       cell: (r) => r.ipAddress ?? '—' },
      { label: 'UA',       cell: (r) => <Text noOfLines={1} maxW="320px">{r.userAgent ?? '—'}</Text> },
      { label: 'Expires',  cell: (r) => r.expiresAt ? formatDate(r.expiresAt) : '—' },
      { label: 'Created',  cell: (r) => formatDate(r.createdAt) },
    ],
    rowActions: (row, refresh, toast) => (
      <Button size="xs" colorScheme="red" onClick={async () => {
        try {
          await adminAPI.revokeSession(row.id);
          toast({ title: 'Session revoked', status: 'success' });
          refresh();
        } catch (e: any) {
          toast({ title: e.response?.data?.error ?? 'Failed', status: 'error' });
        }
      }}>Revoke</Button>
    ),
  },
  {
    key: 'api-keys',
    label: 'API Keys',
    loader: (page) => adminAPI.getApiKeys(page),
    columns: [
      { label: 'Name',     cell: (r) => r.name ?? '—' },
      { label: 'User',     cell: (r) => r.userId },
      { label: 'Created',  cell: (r) => formatDate(r.createdAt) },
      { label: 'Revoked',  cell: (r) => r.revokedAt ? formatDate(r.revokedAt) : <Badge colorScheme="green">ACTIVE</Badge> },
    ],
    rowActions: (row, refresh, toast) =>
      !row.revokedAt ? (
        <Button size="xs" colorScheme="red" onClick={async () => {
          try {
            await adminAPI.revokeApiKey(row.id);
            toast({ title: 'Key revoked', status: 'success' });
            refresh();
          } catch (e: any) {
            toast({ title: e.response?.data?.error ?? 'Failed', status: 'error' });
          }
        }}>Revoke</Button>
      ) : null,
  },
  {
    key: 'login-history',
    label: 'Logins',
    loader: (page) => adminAPI.getLoginHistory(page),
    columns: [
      { label: 'User',    cell: (r) => r.user?.email ?? r.userId },
      { label: 'IP',      cell: (r) => r.ipAddress ?? '—' },
      { label: 'Success', cell: (r) => r.success ? <Badge colorScheme="green">YES</Badge> : <Badge colorScheme="red">NO</Badge> },
      { label: 'When',    cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    loader: (page, direction) => adminAPI.getWhatsAppMessages(page, direction),
    filterKey: 'direction',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'IN',  value: 'IN' },
      { label: 'OUT', value: 'OUT' },
    ],
    columns: [
      { label: 'Direction', cell: (r) => <Badge colorScheme={r.direction === 'IN' ? 'blue' : 'purple'}>{r.direction}</Badge> },
      { label: 'Phone',     cell: (r) => r.phoneNumber },
      { label: 'Body',      cell: (r) => <Text noOfLines={2} maxW="360px">{r.message}</Text> },
      { label: 'Status',    cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'When',      cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'onramps',
    label: 'On-ramps',
    loader: (page, status) => adminAPI.getOnRamps(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'QUOTED',    value: 'QUOTED' },
      { label: 'PENDING',   value: 'PENDING' },
      { label: 'COMPLETED', value: 'COMPLETED' },
      { label: 'FAILED',    value: 'FAILED' },
    ],
    columns: [
      { label: 'User',     cell: (r) => r.user?.email ?? r.userId },
      { label: 'Provider', cell: (r) => r.provider },
      { label: 'In',       cell: (r) => `${fmt(r.fiatAmount, 2)} ${r.fiatCurrency}` },
      { label: 'Out',      cell: (r) => `${fmt(r.cryptoAmount, 8)} ${r.cryptoCurrency}` },
      { label: 'Status',   cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'When',     cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'offramps',
    label: 'Off-ramps',
    loader: (page, status) => adminAPI.getOffRamps(page, status),
    filterKey: 'status',
    filterOptions: [
      { label: 'All', value: '' },
      { label: 'QUOTED',    value: 'QUOTED' },
      { label: 'PENDING',   value: 'PENDING' },
      { label: 'COMPLETED', value: 'COMPLETED' },
      { label: 'FAILED',    value: 'FAILED' },
    ],
    columns: [
      { label: 'User',     cell: (r) => r.user?.email ?? r.userId },
      { label: 'Provider', cell: (r) => r.provider },
      { label: 'In',       cell: (r) => `${fmt(r.cryptoAmount, 8)} ${r.cryptoCurrency}` },
      { label: 'Out',      cell: (r) => `${fmt(r.fiatAmount, 2)} ${r.fiatCurrency}` },
      { label: 'Status',   cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'When',     cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'markets',
    label: 'Markets',
    loader: (page) => adminAPI.getMarkets(page),
    columns: [
      { label: 'Symbol',     cell: (r) => r.symbol },
      { label: 'Display',    cell: (r) => r.displayName },
      { label: 'Rank',       cell: (r) => r.rank },
      { label: 'Active',     cell: (r) => r.isActive ? <Badge colorScheme="green">YES</Badge> : <Badge>NO</Badge> },
    ],
    rowActions: (row, refresh, toast) => (
      <Button size="xs" onClick={async () => {
        try {
          await adminAPI.toggleMarket(row.id, !row.isActive);
          toast({ title: 'Updated', status: 'success' });
          refresh();
        } catch (e: any) {
          toast({ title: e.response?.data?.error ?? 'Failed', status: 'error' });
        }
      }}>{row.isActive ? 'Disable' : 'Enable'}</Button>
    ),
  },
  {
    key: 'onchain',
    label: 'On-chain',
    loader: (page) => adminAPI.getOnChainTransactions(page),
    columns: [
      { label: 'Type',   cell: (r) => <Badge>{r.type}</Badge> },
      { label: 'Asset',  cell: (r) => `${r.asset} / ${r.network}` },
      { label: 'Hash',   cell: (r) => <Text fontFamily="mono" fontSize="xs">{r.txHash ? r.txHash.slice(0, 14) + '…' : '—'}</Text> },
      { label: 'Amount', cell: (r) => fmt(r.amount, 8) },
      { label: 'Status', cell: (r) => <Badge>{r.status}</Badge> },
      { label: 'When',   cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'transfers',
    label: 'Transfers',
    loader: (page) => adminAPI.getTransfers(page),
    columns: [
      { label: 'Ref',      cell: (r) => <Text fontFamily="mono" fontSize="xs">{r.reference}</Text> },
      { label: 'From',     cell: (r) => r.senderId },
      { label: 'To',       cell: (r) => r.receiverId },
      { label: 'Amount',   cell: (r) => `${fmt(r.amount, 4)} ${r.currency}` },
      { label: 'Fee',      cell: (r) => fmt(r.fee, 4) },
      { label: 'When',     cell: (r) => formatDate(r.createdAt) },
    ],
  },
  {
    key: 'platform-banks',
    label: 'Platform Banks',
    loader: () => adminAPI.getPlatformBanks(),
    columns: [
      { label: 'Currency', cell: (r) => <Badge>{r.currency}</Badge> },
      { label: 'Country',  cell: (r) => r.country },
      { label: 'Bank',     cell: (r) => r.bankName },
      { label: 'Holder',   cell: (r) => r.accountName },
      { label: 'IBAN/Acct', cell: (r) => <Text fontFamily="mono" fontSize="xs">{r.iban ?? r.accountNumber}</Text> },
      { label: 'SWIFT',    cell: (r) => r.swift ?? '—' },
      { label: 'Active',   cell: (r) => r.isActive ? <Badge colorScheme="green">YES</Badge> : <Badge>NO</Badge> },
    ],
    rowActions: (row, refresh, toast) => (
      <Button size="xs" onClick={async () => {
        try {
          await adminAPI.updatePlatformBank(row.id, { isActive: !row.isActive });
          toast({ title: 'Updated', status: 'success' });
          refresh();
        } catch (e: any) {
          toast({ title: e.response?.data?.error ?? 'Failed', status: 'error' });
        }
      }}>{row.isActive ? 'Disable' : 'Enable'}</Button>
    ),
  },
  {
    key: 'notifications',
    label: 'Notifications',
    loader: (page) => adminAPI.getNotifications(page),
    columns: [
      { label: 'User',    cell: (r) => r.userId },
      { label: 'Title',   cell: (r) => r.title },
      { label: 'Body',    cell: (r) => <Text noOfLines={1} maxW="320px">{r.message}</Text> },
      { label: 'Type',    cell: (r) => <Badge>{r.type}</Badge> },
      { label: 'Read',    cell: (r) => r.isRead ? <Badge>READ</Badge> : <Badge colorScheme="blue">NEW</Badge> },
      { label: 'When',    cell: (r) => formatDate(r.createdAt) },
    ],
  },
];

export default function AdminDataPage() {
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');

  const [activeIdx, setActiveIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const config = TABS[activeIdx];

  const load = async () => {
    setLoading(true);
    try {
      const res = await config.loader(page, filter || undefined);
      const data = res.data;
      setRows(data.items ?? data.deposits ?? data.users ?? data.cards ?? data.transactions ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e: any) {
      toast({ title: e.response?.data?.error ?? 'Failed to load', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); setFilter(''); setSearch(''); }, [activeIdx]);
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeIdx, page, filter]);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <Box>
      <Heading size="lg" mb={2}>Data Browser</Heading>
      <Text color="gray.500" mb={6}>Complete admin visibility into every Prisma model.</Text>

      <Tabs
        index={activeIdx}
        onChange={setActiveIdx}
        variant="soft-rounded"
        colorScheme="brand"
        isLazy
      >
        <TabList overflowX="auto" pb={2} mb={4} sx={{ scrollbarWidth: 'thin' }}>
          {TABS.map((t) => <Tab key={t.key} flexShrink={0}>{t.label}</Tab>)}
        </TabList>

        <TabPanels>
          {TABS.map((t, i) => (
            <TabPanel key={t.key} px={0}>
              {activeIdx === i && (
                <>
                  <HStack mb={4} spacing={2} wrap="wrap">
                    {t.filterOptions && t.filterKey && (
                      <Select size="sm" maxW="200px" value={filter} onChange={(e) => setFilter(e.target.value)}>
                        {t.filterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    )}
                    <Input
                      size="sm" maxW="280px"
                      placeholder="Search in page (client-side)"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <IconButton size="sm" aria-label="refresh" icon={<FiRefreshCw />} onClick={load} isLoading={loading} />
                  </HStack>

                  <Box bg={cardBg} borderWidth="1px" borderColor={cardBorder} rounded="xl" overflow="auto">
                    {loading ? (
                      <Flex justify="center" py={10}><Spinner color="brand.500" /></Flex>
                    ) : filteredRows.length === 0 ? (
                      <Flex justify="center" py={10}><Text color="gray.500">No data</Text></Flex>
                    ) : (
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            {t.columns.map((c) => <Th key={c.label}>{c.label}</Th>)}
                            {t.rowActions && <Th>Actions</Th>}
                          </Tr>
                        </Thead>
                        <Tbody>
                          {filteredRows.map((row) => (
                            <Tr key={row.id}>
                              {t.columns.map((c, ci) => <Td key={ci}>{c.cell(row)}</Td>)}
                              {t.rowActions && <Td>{t.rowActions(row, load, toast)}</Td>}
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    )}
                  </Box>

                  {totalPages > 1 && (
                    <HStack mt={4} justify="center">
                      <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} isDisabled={page <= 1}>Prev</Button>
                      <Text>{page} / {totalPages}</Text>
                      <Button size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} isDisabled={page >= totalPages}>Next</Button>
                    </HStack>
                  )}
                </>
              )}
            </TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </Box>
  );
}
