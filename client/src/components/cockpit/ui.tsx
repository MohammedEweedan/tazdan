'use client';

/**
 * Cockpit UI kit — built on the site's Chakra theme (brand blue #63a1db as
 * accent, charcoal dark surfaces). Dense, calm, institutional: thin borders,
 * no decorative gradients, numbers in tabular figures.
 */
import { ReactNode, useState } from 'react';
import {
  Badge, Box, Button, Flex, HStack, Heading, Icon, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, Skeleton, Stack, Table, Tbody, Td, Text, Textarea, Th, Thead, Tr,
  useColorModeValue, Alert, AlertIcon, AlertDescription, Tooltip, Code,
} from '@chakra-ui/react';
import { FiArrowDownRight, FiArrowUpRight, FiMinus, FiCheckCircle, FiAlertTriangle, FiAlertOctagon, FiClock, FiInfo, FiSlash } from 'react-icons/fi';
import { useT } from '@/lib/cockpit/i18n';
import { pctText } from '@/lib/cockpit/format';

export function useCockpitColors() {
  return {
    page: useColorModeValue('#F4F5F7', '#16181C'),
    surface: useColorModeValue('#FFFFFF', '#1E2127'),
    surface2: useColorModeValue('#F8F9FA', '#262A31'),
    border: useColorModeValue('#E3E5E8', '#2E333B'),
    text: useColorModeValue('#111317', '#F2F3F5'),
    muted: useColorModeValue('#5B616B', '#A3A9B3'),
    faint: useColorModeValue('#8A9099', '#7A808A'),
    accent: '#63a1db',
    accentText: useColorModeValue('#3E78AE', '#8BBCE8'),
    accentSoft: useColorModeValue('rgba(99,161,219,0.12)', 'rgba(99,161,219,0.16)'),
    series1: useColorModeValue('#2a78d6', '#3987e5'),
    seriesPrev: useColorModeValue('#9AA0A9', '#6E747E'),
    good: '#0ca30c',
    warning: '#fab219',
    serious: '#ec835a',
    critical: '#d03b3b',
  };
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  const c = useCockpitColors();
  return (
    <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3} mb={5}>
      <Box>
        <Heading as="h1" fontSize="xl" fontWeight={700} letterSpacing="-0.01em" color={c.text}>{title}</Heading>
        {subtitle ? <Text fontSize="sm" color={c.muted} mt={1}>{subtitle}</Text> : null}
      </Box>
      {actions ? <HStack spacing={2} flexWrap="wrap">{actions}</HStack> : null}
    </Flex>
  );
}

export function Panel({ title, subtitle, actions, children, pad = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean }) {
  const c = useCockpitColors();
  return (
    <Box bg={c.surface} border="1px solid" borderColor={c.border} borderRadius="10px" overflow="hidden">
      {title ? (
        <Flex px={4} py={3} borderBottom="1px solid" borderColor={c.border} justify="space-between" align="center" gap={3} flexWrap="wrap">
          <Box minW={{ base: '100%', sm: '140px' }} flex="1 1 auto">
            <Text fontSize="sm" fontWeight={600} color={c.text}>{title}</Text>
            {subtitle ? <Text fontSize="xs" color={c.muted}>{subtitle}</Text> : null}
          </Box>
          {actions ? <HStack spacing={2} flexWrap="wrap" maxW="100%" sx={{ '& > *': { maxW: '100%' } }}>{actions}</HStack> : null}
        </Flex>
      ) : null}
      <Box p={pad ? 4 : 0}>{children}</Box>
    </Box>
  );
}

/** KPI tile: label, headline number, change vs previous period (arrow + text, never colour alone). */
export function Stat({ label, value, delta, hint, invert = false }: { label: string; value: ReactNode; delta?: number | null; hint?: ReactNode; invert?: boolean }) {
  const c = useCockpitColors();
  const t = useT();
  const hasDelta = delta !== undefined;
  const up = (delta ?? 0) > 0;
  const flat = delta === 0;
  const good = invert ? !up : up;
  const deltaColor = flat || delta === null ? c.muted : good ? c.good : c.critical;
  return (
    <Box bg={c.surface} border="1px solid" borderColor={c.border} borderRadius="10px" px={4} py={3}>
      <Text fontSize="xs" color={c.muted} fontWeight={500}>{label}</Text>
      <Text fontSize="2xl" fontWeight={700} color={c.text} mt={1} sx={{ fontVariantNumeric: 'tabular-nums' }} lineHeight="1.2">{value}</Text>
      {hasDelta ? (
        <HStack spacing={1} mt={1}>
          <Icon as={flat || delta === null ? FiMinus : up ? FiArrowUpRight : FiArrowDownRight} color={deltaColor} boxSize={3.5} />
          <Text fontSize="xs" color={deltaColor} fontWeight={600}>{pctText(delta)}</Text>
          <Text fontSize="xs" color={c.faint}>{t('vs previous period')}</Text>
        </HStack>
      ) : hint ? <Text fontSize="xs" color={c.faint} mt={1}>{hint}</Text> : null}
    </Box>
  );
}

const STATUS_TONE: Record<string, 'good' | 'warning' | 'serious' | 'critical' | 'neutral' | 'info'> = {
  ACTIVE: 'good', APPROVED: 'good', CONFIRMED: 'good', COMPLETED: 'good', PAID: 'good', RECONCILED: 'good', MATCHED: 'good',
  EXECUTED: 'good', ENABLED: 'good', CLEAR: 'good', RESOLVED: 'good', CLOSED: 'neutral', LIVE: 'good', OK: 'good', DELIVERED: 'good',
  PENDING: 'warning', WAITING_CONFIRMATION: 'warning', PROCESSING: 'info', OPEN: 'warning', ASSIGNED: 'info', INVESTIGATING: 'info',
  AWAITING_INFORMATION: 'warning', REVIEW: 'warning', MANUAL_REVIEW: 'warning', COMPLIANCE_PENDING: 'warning', FUNDING_PENDING: 'warning',
  SETTLEMENT_PENDING: 'warning', PAYOUT_PENDING: 'info', RECONCILIATION_PENDING: 'info', ROUTED: 'info', ROUTING: 'info', FUNDED: 'info',
  SANDBOX_ONLY: 'info', SANDBOX: 'info', MAINTENANCE: 'warning', PARTIAL: 'warning', POTENTIAL_MATCH: 'serious', ESCALATED: 'serious',
  SUSPENDED: 'serious', DISPUTED: 'serious', REQUEST_INFORMATION: 'warning', CHALLENGE: 'warning', DELAY: 'warning', PENDING_APPROVAL: 'warning',
  REJECTED: 'critical', FAILED: 'critical', BANNED: 'critical', BLOCKED: 'critical', FREEZE: 'critical', CANCELLED: 'neutral',
  EXPIRED: 'neutral', REFUNDED: 'neutral', REFUND_PENDING: 'warning', DISABLED: 'neutral', NOT_ACTIVATED: 'neutral', MOCK: 'neutral',
  AMOUNT_MISMATCH: 'critical', MISSING_INTERNAL: 'critical', MISSING_EXTERNAL: 'critical', DUPLICATE: 'critical', CURRENCY_MISMATCH: 'critical',
  FEE_MISMATCH: 'serious', STATUS_MISMATCH: 'serious', LATE_SETTLEMENT: 'serious', CONFIRMED_MATCH: 'critical', FALSE_POSITIVE: 'neutral',
  LOW: 'neutral', MEDIUM: 'warning', HIGH: 'serious', CRITICAL: 'critical', PAUSED: 'warning', PRODUCTION: 'good',
  EXCEPTION: 'critical', EVIDENCED: 'good', TRADE: 'info', UNBACKED: 'serious',
};

export function StatusBadge({ value }: { value: string | null | undefined }) {
  const c = useCockpitColors();
  if (!value) return <Text as="span" color={c.faint}>—</Text>;
  const tone = STATUS_TONE[value] ?? 'neutral';
  const map = {
    good: { color: c.good, icon: FiCheckCircle },
    warning: { color: '#B07A00', icon: FiClock },
    serious: { color: '#C2602F', icon: FiAlertTriangle },
    critical: { color: c.critical, icon: FiAlertOctagon },
    info: { color: c.accentText, icon: FiInfo },
    neutral: { color: c.muted, icon: FiSlash },
  }[tone];
  return (
    <HStack as="span" spacing={1} display="inline-flex" px={2} py="2px" borderRadius="6px" border="1px solid" borderColor={c.border} bg={c.surface2}>
      <Icon as={map.icon} color={map.color} boxSize={3} />
      <Text as="span" fontSize="11px" fontWeight={600} color={c.text} letterSpacing="0.02em">{value.replace(/_/g, ' ')}</Text>
    </HStack>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  const scheme = mode === 'PRODUCTION' ? 'green' : mode === 'SANDBOX' ? 'blue' : 'gray';
  const label = mode === 'SANDBOX' ? 'SANDBOX — not live' : mode === 'MOCK' ? 'MOCK — dev only' : mode;
  return <Badge colorScheme={scheme} variant="subtle" fontSize="10px">{label}</Badge>;
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export function DataTable<T extends Record<string, any>>({ columns, rows, onRowClick, empty, loading }: {
  columns: Column<T>[]; rows: T[] | null | undefined; onRowClick?: (row: T) => void; empty?: string; loading?: boolean;
}) {
  const c = useCockpitColors();
  const t = useT();
  const hover = useColorModeValue('#F6F8FA', '#242830');
  if (loading && !rows) return <Stack p={4}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h="20px" />)}</Stack>;
  if (!rows?.length) return <Text p={6} textAlign="center" fontSize="sm" color={c.muted}>{empty ?? t('No records')}</Text>;
  return (
    <Box overflowX="auto">
      <Table size="sm" variant="unstyled">
        <Thead>
          <Tr borderBottom="1px solid" borderColor={c.border}>
            {columns.map((col) => (
              <Th key={col.key} textAlign={col.align ?? 'start'} color={c.muted} fontSize="11px" fontWeight={600} textTransform="none" letterSpacing="0" py={2} px={3} w={col.width} whiteSpace="nowrap">
                {col.label}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row, i) => (
            <Tr key={row.id ?? i} borderBottom="1px solid" borderColor={c.border} _last={{ borderBottom: 'none' }}
              cursor={onRowClick ? 'pointer' : undefined} _hover={onRowClick ? { bg: hover } : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((col) => (
                <Td key={col.key} textAlign={col.align ?? 'start'} px={3} py={2} fontSize="13px" color={c.text} sx={{ fontVariantNumeric: 'tabular-nums' }} verticalAlign="top"
                  whiteSpace={/At$/.test(col.key) || col.align === 'right' ? 'nowrap' : undefined}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
}

export function KV({ items, columns = 2 }: { items: Array<[string, ReactNode]>; columns?: number }) {
  const c = useCockpitColors();
  return (
    <Box display="grid" gridTemplateColumns={{ base: '1fr', md: `repeat(${columns}, minmax(0,1fr))` }} gap={3}>
      {items.map(([k, v]) => (
        <Box key={k} minW={0}>
          <Text fontSize="11px" color={c.muted} fontWeight={500}>{k}</Text>
          <Box fontSize="13px" color={c.text} wordBreak="break-word" sx={{ fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</Box>
        </Box>
      ))}
    </Box>
  );
}

export function Loading({ lines = 4 }: { lines?: number }) {
  return <Stack>{Array.from({ length: lines }, (_, i) => <Skeleton key={i} h="18px" borderRadius="4px" />)}</Stack>;
}

export function ErrorBox({ error, onRetry }: { error: { message: string; status?: number } | null; onRetry?: () => void }) {
  if (!error) return null;
  const forbidden = error.status === 403;
  return (
    <Alert status={forbidden ? 'warning' : 'error'} borderRadius="8px" fontSize="sm">
      <AlertIcon />
      <AlertDescription flex="1">{forbidden ? `Your role does not include this view. (${error.message})` : error.message}</AlertDescription>
      {onRetry && !forbidden ? <Button size="xs" onClick={onRetry}>Retry</Button> : null}
    </Alert>
  );
}

export function Mono({ children, copy }: { children: ReactNode; copy?: string }) {
  const c = useCockpitColors();
  const [copied, setCopied] = useState(false);
  return (
    <Tooltip label={copied ? 'Copied' : copy ? 'Copy' : undefined} isDisabled={!copy} hasArrow>
      <Text as="span" fontFamily="mono" fontSize="12px" color={c.text} cursor={copy ? 'pointer' : undefined}
        onClick={copy ? (e) => { e.stopPropagation(); void navigator.clipboard?.writeText(copy); setCopied(true); setTimeout(() => setCopied(false), 1200); } : undefined}>
        {children}
      </Text>
    </Tooltip>
  );
}

export function JsonView({ value }: { value: unknown }) {
  const c = useCockpitColors();
  if (value === null || value === undefined) return <Text color={c.faint} fontSize="sm">—</Text>;
  return (
    <Code display="block" whiteSpace="pre-wrap" p={3} borderRadius="6px" fontSize="11px" bg={c.surface2} color={c.text} maxH="320px" overflow="auto">
      {JSON.stringify(value, null, 2)}
    </Code>
  );
}

/**
 * Confirmation for any privileged action: a written reason is required and
 * goes to the audit trail with the action.
 */
export function ReasonModal({ isOpen, onClose, title, description, confirmLabel, danger, minLength = 5, onConfirm }: {
  isOpen: boolean; onClose: () => void; title: string; description?: ReactNode; confirmLabel?: string; danger?: boolean;
  minLength?: number; onConfirm: (reason: string) => Promise<void> | void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = reason.trim().length >= minLength;
  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) { setReason(''); setErr(null); onClose(); } }} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">{title}</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody>
          {description ? <Box fontSize="sm" mb={3}>{description}</Box> : null}
          <Text fontSize="xs" fontWeight={600} mb={1}>{t('Reason')} <Text as="span" fontWeight={400} opacity={0.7}>(recorded in the audit trail)</Text></Text>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder={`At least ${minLength} characters`} autoFocus />
          {err ? <Text color="red.400" fontSize="sm" mt={2}>{err}</Text> : null}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose} isDisabled={busy}>{t('Cancel')}</Button>
          <Button colorScheme={danger ? 'red' : 'brand'} isDisabled={!valid} isLoading={busy}
            onClick={async () => {
              setBusy(true); setErr(null);
              try { await onConfirm(reason.trim()); setReason(''); onClose(); } catch (e: any) { setErr(e?.message ?? 'Action failed'); } finally { setBusy(false); }
            }}>
            {confirmLabel ?? t('Confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const c = useCockpitColors();
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <Flex justify="space-between" align="center" px={4} py={2} borderTop="1px solid" borderColor={c.border}>
      <Text fontSize="xs" color={c.muted}>{total.toLocaleString('en-GB')} records · page {page} of {pages}</Text>
      <HStack>
        <Button size="xs" variant="outline" isDisabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="xs" variant="outline" isDisabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </HStack>
    </Flex>
  );
}

export function Grid({ children, min = '220px' }: { children: ReactNode; min?: string }) {
  return <Box display="grid" gridTemplateColumns={`repeat(auto-fill, minmax(min(${min}, 100%), 1fr))`} gap={3}>{children}</Box>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warning'; children: ReactNode }) {
  return (
    <Alert status={tone} borderRadius="8px" fontSize="sm" variant="left-accent">
      <AlertIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
