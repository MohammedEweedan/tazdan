'use client';

/**
 * A cockpit page over one or more legacy /api/admin list endpoints (the ones
 * the mobile admin console uses): tabs, paging, a raw-record panel and row
 * actions. Each action names its permission; actions that change state ask
 * for a reason (where the endpoint takes one) and fields.
 */
import { useState, type ReactNode } from 'react';
import {
  Box, Button, HStack, Input, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader,
  ModalOverlay, Select, Tab, TabList, Tabs, Text, Textarea,
} from '@chakra-ui/react';
import { api } from '@/lib/cockpit/api';
import { useApi } from '@/lib/cockpit/useApi';
import { useCan } from '@/components/cockpit/CockpitShell';
import { DataTable, ErrorBox, JsonView, PageHeader, Pagination, Panel, type Column } from '@/components/cockpit/ui';

export interface ActionField { key: string; label: string; type?: 'text' | 'textarea' | 'select'; options?: Array<{ value: string; label: string }>; optional?: boolean; placeholder?: string }
export interface RowAction {
  label: string;
  perm: string;
  danger?: boolean;
  fields?: ActionField[];
  show?: (row: any) => boolean;
  run: (row: any, values: Record<string, string>) => Promise<unknown>;
}
export interface ListTab { key: string; label: string; path: string; columns: Column<any>[]; actions?: RowAction[]; empty?: string }

/** The first array in a legacy response (items, orders, txs, flags…). */
export function pickRows(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  const arr = Object.values(data).find((v) => Array.isArray(v));
  return (arr as any[]) ?? [];
}

export function ActionModal({ action, row, onClose, onDone }: { action: RowAction | null; row: any; onClose: () => void; onDone: () => Promise<void> | void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = (action?.fields ?? []).every((f) => f.optional || (values[f.key] ?? (f.type === 'select' ? f.options?.[0]?.value : '') ?? '').trim());
  return (
    <Modal isOpen={Boolean(action)} onClose={() => { if (!busy) { setValues({}); setErr(null); onClose(); } }} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">{action?.label}</ModalHeader>
        <ModalCloseButton isDisabled={busy} />
        <ModalBody display="grid" gap={3}>
          {(action?.fields ?? []).map((f) => (
            <Box key={f.key}>
              <Text fontSize="xs" fontWeight={600} mb={1}>{f.label}{f.optional ? ' (optional)' : ''}</Text>
              {f.type === 'select' ? (
                <Select size="sm" value={values[f.key] ?? f.options?.[0]?.value} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ) : f.type === 'textarea' ? (
                <Textarea size="sm" rows={3} value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              ) : (
                <Input size="sm" value={values[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              )}
            </Box>
          ))}
          {!action?.fields?.length ? <Text fontSize="sm">Confirm this action.</Text> : null}
          {err ? <Text color="red.400" fontSize="sm">{err}</Text> : null}
        </ModalBody>
        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose} isDisabled={busy}>Cancel</Button>
          <Button colorScheme={action?.danger ? 'red' : 'brand'} isLoading={busy} isDisabled={!ready}
            onClick={async () => {
              if (!action) return;
              setBusy(true); setErr(null);
              const filled = Object.fromEntries((action.fields ?? []).map((f) => [f.key, (values[f.key] ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '')).trim()]));
              try { await action.run(row, filled); setValues({}); onClose(); await onDone(); } catch (e: any) { setErr(e?.message ?? 'Action failed'); } finally { setBusy(false); }
            }}>
            {action?.label}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export function LegacyList({ title, subtitle, tabs, header }: { title: string; subtitle?: string; tabs: ListTab[]; header?: ReactNode }) {
  const can = useCan();
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [action, setAction] = useState<{ action: RowAction; row: any } | null>(null);
  const t = tabs[tab];
  const { data, error, loading, reload } = useApi<any>(t.path, { page, limit: 25 });
  const rows = pickRows(data);
  const actions = (t.actions ?? []).filter((a) => can(a.perm));
  const columns: Column<any>[] = actions.length ? [...t.columns, {
    key: '_actions', label: '', align: 'right',
    render: (r: any) => (
      <HStack justify="flex-end" spacing={1}>
        {actions.filter((a) => !a.show || a.show(r)).map((a) => (
          <Button key={a.label} size="xs" variant="outline" colorScheme={a.danger ? 'red' : undefined}
            onClick={(e) => { e.stopPropagation(); setAction({ action: a, row: r }); }}>{a.label}</Button>
        ))}
      </HStack>
    ),
  }] : t.columns;

  return (
    <Box>
      <PageHeader title={title} subtitle={subtitle} />
      {header}
      {tabs.length > 1 ? (
        <Tabs size="sm" colorScheme="brand" index={tab} onChange={(i) => { setTab(i); setPage(1); setSelected(null); }} mb={4}>
          <TabList>{tabs.map((x) => <Tab key={x.key}>{x.label}</Tab>)}</TabList>
        </Tabs>
      ) : null}
      <ErrorBox error={error} onRetry={reload} />
      <Box display="grid" gridTemplateColumns={{ base: '1fr', xl: selected ? '1.6fr 1fr' : '1fr' }} gap={4}>
        <Panel pad={false}>
          <DataTable loading={loading} rows={rows.map((r, i) => ({ ...r, id: r.id ?? `${i}` }))} onRowClick={setSelected} empty={t.empty ?? 'Nothing here.'} columns={columns} />
          {data?.total ? <Pagination page={page} total={data.total} limit={25} onPage={setPage} /> : null}
        </Panel>
        {selected ? (
          <Panel title="Record" actions={<Text as="button" fontSize="12px" onClick={() => setSelected(null)}>Close</Text>}>
            <JsonView value={selected} />
          </Panel>
        ) : null}
      </Box>
      <ActionModal action={action?.action ?? null} row={action?.row} onClose={() => setAction(null)} onDone={reload} />
    </Box>
  );
}

/** Small helper for the common call shape. */
export const call = (path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) => api(path, { method, body });
