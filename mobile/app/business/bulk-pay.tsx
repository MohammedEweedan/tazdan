/**
 * Bulk Pay — send payouts to multiple recipients in one batch.
 *
 * Flow:
 *   ① Build recipient list (handle/email + amount + currency + note)
 *   ② Preview  — calls /business/bulk-pay/preview (dry-run)
 *   ③ Confirm  — shows totals, fee, invalid rows
 *   ④ Submit   — calls /business/bulk-pay, shows batchId
 */

import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, TextInput, View,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { BulkPayRecipient, BulkPayPreview, BusinessPayout } from '@/types/business';

const ACCENT = '#226dff';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'USDT', 'AED', 'SAR', 'EGP'];

function makeDraft(): BulkPayRecipient & { _id: string } {
  return { _id: Math.random().toString(36).slice(2), handle: '', email: '', amount: 0, currency: 'USD', note: '' };
}

type DraftRow = BulkPayRecipient & { _id: string };

type Step = 'build' | 'preview' | 'done';

/* ─── Recipient Row Editor ─────────────────────────────────────── */
function RecipientEditor({
  row,
  index,
  onChange,
  onRemove,
  palette: p,
}: {
  row: DraftRow;
  index: number;
  onChange: (id: string, patch: Partial<DraftRow>) => void;
  onRemove: (id: string) => void;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const [currOpen, setCurrOpen] = useState(false);
  const inp: any = {
    color: p.fg, fontSize: 14, fontWeight: '500',
    padding: 0, flex: 1,
  };

  return (
    <View style={{
      borderRadius: 16, borderWidth: 1, borderColor: p.border,
      backgroundColor: p.bgElev, marginBottom: 10, overflow: 'hidden',
    }}>
      {/* Row header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4,
        borderBottomWidth: 1, borderBottomColor: p.border,
      }}>
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          backgroundColor: `${ACCENT}20`, alignItems: 'center', justifyContent: 'center', marginRight: 8,
        }}>
          <Text style={{ color: ACCENT, fontSize: 10, fontWeight: '800' }}>{index + 1}</Text>
        </View>
        <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', flex: 1 }}>Recipient {index + 1}</Text>
        <Pressable onPress={() => onRemove(row._id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={p.redFg} />
        </Pressable>
      </View>

      {/* Handle or email */}
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>
          HANDLE OR EMAIL
        </Text>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 6,
          backgroundColor: p.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
          borderWidth: 1, borderColor: p.border,
        }}>
          <Text style={{ color: p.fgFaint, fontSize: 14 }}>@</Text>
          <TextInput
            style={[inp]}
            placeholder="handle or email@example.com"
            placeholderTextColor={p.fgFaint}
            value={row.handle || row.email || ''}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={(v) => {
              if (v.includes('@') && v.includes('.')) {
                onChange(row._id, { email: v, handle: '' });
              } else {
                onChange(row._id, { handle: v.replace(/^@/, ''), email: '' });
              }
            }}
          />
        </View>
      </View>

      {/* Amount + Currency */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>
            AMOUNT
          </Text>
          <View style={{
            backgroundColor: p.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
            borderWidth: 1, borderColor: p.border,
          }}>
            <TextInput
              style={[inp]}
              placeholder="0.00"
              placeholderTextColor={p.fgFaint}
              keyboardType="decimal-pad"
              value={row.amount ? String(row.amount) : ''}
              onChangeText={(v) => onChange(row._id, { amount: parseFloat(v) || 0 })}
            />
          </View>
        </View>

        <View style={{ width: 90 }}>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>
            CURRENCY
          </Text>
          <Pressable
            onPress={() => setCurrOpen((o) => !o)}
            style={{
              backgroundColor: p.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10,
              borderWidth: 1, borderColor: currOpen ? ACCENT : p.border,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{row.currency}</Text>
            <Ionicons name={currOpen ? 'chevron-up' : 'chevron-down'} size={12} color={p.fgMuted} />
          </Pressable>
        </View>
      </View>

      {/* Currency picker dropdown */}
      {currOpen && (
        <View style={{
          marginHorizontal: 14, marginBottom: 6,
          borderRadius: 12, borderWidth: 1, borderColor: p.border,
          backgroundColor: p.bg, overflow: 'hidden',
        }}>
          {CURRENCIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => { onChange(row._id, { currency: c }); setCurrOpen(false); }}
              style={({ pressed }) => ({
                paddingHorizontal: 12, paddingVertical: 10,
                backgroundColor: c === row.currency
                  ? `${ACCENT}14`
                  : pressed ? p.bgElev : 'transparent',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              })}
            >
              <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{c}</Text>
              {c === row.currency && <Ionicons name="checkmark" size={14} color={ACCENT} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Note */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>
          NOTE (OPTIONAL)
        </Text>
        <View style={{
          backgroundColor: p.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9,
          borderWidth: 1, borderColor: p.border,
        }}>
          <TextInput
            style={[inp]}
            placeholder="e.g. Invoice #INV-001"
            placeholderTextColor={p.fgFaint}
            value={row.note ?? ''}
            onChangeText={(v) => onChange(row._id, { note: v })}
          />
        </View>
      </View>
    </View>
  );
}

/* ─── Preview / Confirm Panel ──────────────────────────────────── */
function PreviewPanel({
  preview,
  batchNote,
  onNoteChange,
  onSubmit,
  onBack,
  submitting,
  palette: p,
}: {
  preview: BulkPayPreview;
  batchNote: string;
  onNoteChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting: boolean;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  return (
    <View style={{ gap: 14 }}>
      {/* Summary card */}
      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev, overflow: 'hidden' }}>
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: p.border }}>
          <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6 }}>PREVIEW</Text>
        </View>
        {[
          { label: 'Recipients', value: String(preview.recipients) },
          { label: 'Total amount', value: `${Number(preview.totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${preview.currency}` },
          { label: 'Total fee', value: `${Number(preview.totalFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${preview.currency}` },
          { label: 'Net total', value: `${(Number(preview.totalAmount) + Number(preview.totalFee)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${preview.currency}` },
        ].map(({ label, value }, i, arr) => (
          <View key={label} style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 12,
            borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: p.border,
          }}>
            <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>{label}</Text>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Invalid rows */}
      {preview.invalid.length > 0 && (
        <View style={{
          borderRadius: 16, borderWidth: 1, borderColor: `${p.redFg}40`,
          backgroundColor: 'rgba(248,113,113,0.08)', padding: 14,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="warning-outline" size={16} color={p.redFg} />
            <Text style={{ color: p.redFg, fontSize: 12.5, fontWeight: '700' }}>
              {preview.invalid.length} invalid row{preview.invalid.length !== 1 ? 's' : ''} — will be skipped
            </Text>
          </View>
          {preview.invalid.map((inv) => (
            <Text key={inv.row} style={{ color: p.redFg, fontSize: 11.5, fontWeight: '500', marginBottom: 2 }}>
              Row {inv.row}: {inv.reason}
            </Text>
          ))}
        </View>
      )}

      {/* Batch note */}
      <View>
        <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8 }}>
          BATCH NOTE (OPTIONAL)
        </Text>
        <View style={{
          borderRadius: 12, borderWidth: 1, borderColor: p.border,
          backgroundColor: p.bgElev, paddingHorizontal: 12, paddingVertical: 10,
        }}>
          <TextInput
            style={{ color: p.fg, fontSize: 14, fontWeight: '500', padding: 0 }}
            placeholder="e.g. September payroll"
            placeholderTextColor={p.fgFaint}
            value={batchNote}
            onChangeText={onNoteChange}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Pressable
          onPress={onSubmit}
          disabled={submitting || preview.valid.length === 0}
          style={({ pressed }) => ({
            flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
            backgroundColor: ACCENT,
            opacity: pressed || submitting || preview.valid.length === 0 ? 0.6 : 1,
          })}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                Send to {preview.valid.length} recipient{preview.valid.length !== 1 ? 's' : ''}
              </Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

/* ─── Done Screen ──────────────────────────────────────────────── */
function DonePanel({
  batchId,
  payouts,
  onDone,
  palette: p,
}: {
  batchId: string;
  payouts: BusinessPayout[];
  onDone: () => void;
  palette: ReturnType<typeof useThemedPalette>;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(batchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ alignItems: 'center', gap: 20, paddingTop: 16 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: p.greenBg, borderWidth: 1, borderColor: `${p.greenFg}40`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name="checkmark-circle" size={40} color={p.greenFg} />
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>
          Batch submitted
        </Text>
        <Text style={{ color: p.fgMuted, fontSize: 13, fontWeight: '500', textAlign: 'center' }}>
          {payouts.length} payout{payouts.length !== 1 ? 's' : ''} are being processed.
        </Text>
      </View>

      <Pressable
        onPress={copy}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
          backgroundColor: p.bgElev, borderWidth: 1, borderColor: p.border,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600' }}>Batch ID:</Text>
        <Text style={{ color: p.fg, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {batchId.slice(0, 8)}…{batchId.slice(-6)}
        </Text>
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? p.greenFg : p.fgFaint} />
      </Pressable>

      <Pressable
        onPress={onDone}
        style={({ pressed }) => ({
          width: '100%', paddingVertical: 16, borderRadius: 16, alignItems: 'center',
          backgroundColor: ACCENT, opacity: pressed ? 0.8 : 1, marginTop: 8,
        })}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Done</Text>
      </Pressable>
    </View>
  );
}

/* ─── Main Screen ──────────────────────────────────────────────── */
export default function BulkPay() {
  const router   = useRouter();
  const p        = useThemedPalette();
  const h        = useHaptics();
  const mode     = useTheme((s) => s.mode);

  const [drafts,     setDrafts]     = useState<DraftRow[]>([makeDraft()]);
  const [step,       setStep]       = useState<Step>('build');
  const [preview,    setPreview]    = useState<BulkPayPreview | null>(null);
  const [batchNote,  setBatchNote]  = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchId,    setBatchId]    = useState('');
  const [payouts,    setPayouts]    = useState<BusinessPayout[]>([]);

  const updateRow = useCallback((id: string, patch: Partial<DraftRow>) => {
    setDrafts((prev) => prev.map((d) => (d._id === id ? { ...d, ...patch } : d)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setDrafts((prev) => (prev.length > 1 ? prev.filter((d) => d._id !== id) : prev));
  }, []);

  const addRow = () => {
    h.selection();
    setDrafts((prev) => [...prev, makeDraft()]);
  };

  const handlePreview = async () => {
    const valid = drafts.filter(
      (d) => (d.handle || d.email) && d.amount > 0
    );
    if (valid.length === 0) {
      Alert.alert('Nothing to preview', 'Add at least one recipient with an amount.');
      return;
    }
    setPreviewing(true);
    h.selection();
    try {
      const recipients: BulkPayRecipient[] = valid.map(({ handle, email, amount, currency, note }) =>
        handle ? { handle, amount, currency, ...(note ? { note } : {}) }
               : { email, amount, currency, ...(note ? { note } : {}) }
      );
      const result = await businessService.previewBulkPay({
        recipients,
        currency: valid[0].currency,
      });
      setPreview(result);
      setStep('preview');
      h.success();
    } catch (err: any) {
      h.error();
      Alert.alert('Preview failed', err?.response?.data?.message ?? 'Please check your recipients and try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview) return;
    setSubmitting(true);
    h.selection();
    try {
      const recipients: BulkPayRecipient[] = drafts
        .filter((d) => (d.handle || d.email) && d.amount > 0)
        .map(({ handle, email, amount, currency, note }) =>
          handle ? { handle, amount, currency, ...(note ? { note } : {}) }
                 : { email, amount, currency, ...(note ? { note } : {}) }
        );
      const result = await businessService.submitBulkPay({
        recipients,
        currency: recipients[0]?.currency ?? 'USD',
        ...(batchNote ? { note: batchNote } : {}),
      });
      setBatchId(result.batchId);
      setPayouts(result.payouts);
      setStep('done');
      h.success();
    } catch (err: any) {
      h.error();
      Alert.alert('Submission failed', err?.response?.data?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
        }}>
          <Pressable
            onPress={() => {
              if (step === 'preview') { setStep('build'); return; }
              router.back();
            }}
            hitSlop={8}
            style={{
              width: 36, height: 36, borderRadius: 18, backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={20} color={p.fg} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.fg, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>
              {step === 'done' ? 'Batch sent' : 'Bulk Pay'}
            </Text>
            {step === 'build' && (
              <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '500' }}>
                {drafts.length} recipient{drafts.length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>

          {/* Step indicator */}
          {step !== 'done' && (
            <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
              {(['build', 'preview'] as const).map((s, i) => (
                <View key={s} style={{
                  width: s === step ? 20 : 6, height: 6, borderRadius: 3,
                  backgroundColor: s === step ? ACCENT : p.border,
                }} />
              ))}
            </View>
          )}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'build' && (
              <>
                <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginBottom: 12, marginTop: 8 }}>
                  RECIPIENTS
                </Text>

                {drafts.map((row, i) => (
                  <RecipientEditor
                    key={row._id}
                    row={row}
                    index={i}
                    onChange={updateRow}
                    onRemove={removeRow}
                    palette={p}
                  />
                ))}

                {/* Add recipient */}
                <Pressable
                  onPress={addRow}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    paddingVertical: 14, borderRadius: 14,
                    borderWidth: 1, borderColor: `${ACCENT}40`, borderStyle: 'dashed',
                    backgroundColor: `${ACCENT}08`,
                    opacity: pressed ? 0.7 : 1, marginBottom: 20,
                  })}
                >
                  <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
                  <Text style={{ color: ACCENT, fontSize: 13, fontWeight: '700' }}>Add recipient</Text>
                </Pressable>

                {/* Preview CTA */}
                <Pressable
                  onPress={handlePreview}
                  disabled={previewing}
                  style={({ pressed }) => ({
                    paddingVertical: 16, borderRadius: 16, alignItems: 'center',
                    backgroundColor: ACCENT,
                    opacity: pressed || previewing ? 0.7 : 1,
                  })}
                >
                  {previewing
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>Preview batch</Text>
                  }
                </Pressable>
              </>
            )}

            {step === 'preview' && preview && (
              <PreviewPanel
                preview={preview}
                batchNote={batchNote}
                onNoteChange={setBatchNote}
                onSubmit={handleSubmit}
                onBack={() => setStep('build')}
                submitting={submitting}
                palette={p}
              />
            )}

            {step === 'done' && (
              <DonePanel
                batchId={batchId}
                payouts={payouts}
                onDone={() => router.replace('/business' as never)}
                palette={p}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
