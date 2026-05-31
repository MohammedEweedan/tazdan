/**
 * Admin Platform Banks — full CRUD over the deposit-rail bank accounts.
 *  • List banks (active/inactive badge)
 *  • Tap → detail sheet with edit / delete / toggle-active
 *  • + button → create sheet
 */

import { useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useThemedPalette, useTheme } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { adminService } from '@/services';
import { LoadingPulse } from '@/components/ui/LoadingPulse';
import { TopGradient } from '@/components/ui/ScreenShell';

interface BankForm {
  bankName: string;
  currency: string;
  country: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swift: string;
  sortCode: string;
  routingNumber: string;
  branch: string;
  memo: string;
  isActive: boolean;
}

const EMPTY: BankForm = {
  bankName: '', currency: 'USD', country: '',
  accountName: '', accountNumber: '', iban: '', swift: '',
  sortCode: '', routingNumber: '', branch: '', memo: '',
  isActive: true,
};

export default function AdminPlatformBanks() {
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [editing, setEditing] = useState<{ id?: string; form: BankForm } | null>(null);

  const q = useQuery({
    queryKey: ['admin-platform-banks'],
    queryFn: () => adminService.rawPlatformBanks({ page: 1, limit: 100 }),
    enabled: user?.role === 'ADMIN',
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const payload = editing.form;
      if (editing.id) return adminService.updatePlatformBank(editing.id, payload);
      return adminService.createPlatformBank(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-platform-banks'] });
      setEditing(null);
      Alert.alert('Saved', 'Platform bank updated.');
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not save'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminService.deletePlatformBank(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-platform-banks'] });
      setEditing(null);
    },
    onError: (e: any) => Alert.alert('Failed', e?.response?.data?.error ?? 'Could not delete'),
  });

  const items: any[] = q.data?.items ?? [];
  if (user?.role !== 'ADMIN') return null;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <TopGradient />
      <StatusBar style={themeMode === 'light' ? 'dark' : 'light'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={p.fg} />
          </Pressable>
          <Text style={{ flex: 1, color: p.fg, fontSize: 18, fontWeight: '600' }}>Platform Banks</Text>
          <Pressable
            onPress={() => setEditing({ form: { ...EMPTY } })}
            hitSlop={8}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: p.fg, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={20} color={p.bg} />
          </Pressable>
        </View>

        {q.isLoading ? (
          <LoadingPulse fullscreen icon="business-outline" label="Loading banks…" />
        ) : (
          <ScrollView
            refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={p.fg} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          >
            {items.map((row) => (
              <Pressable
                key={row.id}
                onPress={() => setEditing({ id: row.id, form: { ...EMPTY, ...row } })}
                style={({ pressed }) => ({
                  backgroundColor: p.bgElev,
                  borderWidth: 1,
                  borderColor: row.isActive ? p.border : 'rgba(239,68,68,0.3)',
                  borderRadius: 14, padding: 16, marginBottom: 10,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ color: p.fg, fontSize: 15, fontWeight: '600' }}>{row.bankName}</Text>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: row.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }}>
                    <Text style={{ color: row.isActive ? '#22c55e' : '#ef4444', fontSize: 10, fontWeight: '600' }}>
                      {row.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: p.fgMuted, fontSize: 13 }}>{row.currency} · {row.country}</Text>
                {row.iban && <Text style={{ color: p.fgFaint, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{row.iban}</Text>}
                {row.accountName && <Text style={{ color: p.fgFaint, fontSize: 11 }}>{row.accountName}</Text>}
              </Pressable>
            ))}
            {items.length === 0 && !q.isLoading && (
              <View style={{ alignItems: 'center', paddingTop: 60 }}>
                <Ionicons name="business-outline" size={40} color={p.fgFaint} />
                <Text style={{ color: p.fgMuted, marginTop: 12, fontWeight: '600' }}>No platform banks yet</Text>
                <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 6, textAlign: 'center' }}>
                  Tap + to add a deposit rail
                </Text>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, maxHeight: '92%' }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: p.border, marginBottom: 14 }} />
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
              {editing?.id ? 'Edit bank' : 'Add platform bank'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {editing && (
                <>
                  <Field label="Bank name *" value={editing.form.bankName}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, bankName: v } })} p={p} />
                  <Field label="Currency * (e.g. USD)" value={editing.form.currency}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, currency: v.toUpperCase() } })} p={p} autoCap />
                  <Field label="Country" value={editing.form.country}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, country: v } })} p={p} />
                  <Field label="Account holder name" value={editing.form.accountName}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, accountName: v } })} p={p} />
                  <Field label="Account number" value={editing.form.accountNumber}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, accountNumber: v } })} p={p} />
                  <Field label="IBAN" value={editing.form.iban}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, iban: v } })} p={p} />
                  <Field label="SWIFT / BIC" value={editing.form.swift}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, swift: v } })} p={p} />
                  <Field label="Sort code" value={editing.form.sortCode}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, sortCode: v } })} p={p} />
                  <Field label="Routing number" value={editing.form.routingNumber}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, routingNumber: v } })} p={p} />
                  <Field label="Branch" value={editing.form.branch}
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, branch: v } })} p={p} />
                  <Field label="Memo / instructions" value={editing.form.memo} multiline
                    onChange={(v) => setEditing({ ...editing, form: { ...editing.form, memo: v } })} p={p} />

                  <Pressable
                    onPress={() => setEditing({ ...editing, form: { ...editing.form, isActive: !editing.form.isActive } })}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 }}
                  >
                    <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>Active (visible to users)</Text>
                    <View style={{
                      width: 40, height: 22, borderRadius: 11,
                      backgroundColor: editing.form.isActive ? '#22c55e' : p.pillBg,
                      borderWidth: 1, borderColor: editing.form.isActive ? '#22c55e' : p.border,
                      justifyContent: 'center', paddingHorizontal: 2,
                    }}>
                      <View style={{
                        width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
                        alignSelf: editing.form.isActive ? 'flex-end' : 'flex-start',
                      }} />
                    </View>
                  </Pressable>
                </>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setEditing(null)} style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: p.fg, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              {editing?.id && (
                <Pressable
                  onPress={() => Alert.alert('Delete bank?', 'This cannot be undone.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate(editing.id!) },
                  ])}
                  style={{ width: 50, height: 50, borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </Pressable>
              )}
              <Pressable
                onPress={() => saveMut.mutate()}
                disabled={!editing?.form.bankName || !editing?.form.currency || saveMut.isPending}
                style={{
                  flex: 2, height: 50, borderRadius: 12,
                  backgroundColor: p.fg,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: (!editing?.form.bankName || !editing?.form.currency) ? 0.5 : 1,
                }}
              >
                <Text style={{ color: p.bg, fontWeight: '700' }}>
                  {saveMut.isPending ? 'Saving…' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChange, p, multiline, autoCap }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  p: any;
  multiline?: boolean;
  autoCap?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>{label.toUpperCase()}</Text>
      <View style={{ backgroundColor: p.bgElev, borderRadius: 12, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, paddingVertical: multiline ? 10 : 0, minHeight: multiline ? 70 : 44, justifyContent: 'center' }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          autoCapitalize={autoCap ? 'characters' : 'sentences'}
          style={{
            color: p.fg, fontSize: 14, fontWeight: '500',
            textAlignVertical: multiline ? 'top' : 'center',
            minHeight: multiline ? 50 : undefined,
          }}
        />
      </View>
    </View>
  );
}
