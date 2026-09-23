import { StackHeader, HeaderTextButton } from '@/components/ui/ScreenHeader';
/**
 * API Key management screen.
 *
 * Lists active + revoked keys. Allows creating a new key with scoped
 * permissions and optional expiry. Shows the raw key ONCE at creation.
 * Swipe-to-reveal or long-press → revoke with confirmation.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable,
  RefreshControl, ScrollView, View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

import { brand, useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { BusinessApiKey, ApiKeyPermission, ApiKeyCreateResponse } from '@/types/business';
import { TopGradient } from '@/components/ui/ScreenShell';

const ACCENT = '#737373';

const PERM_META: Record<ApiKeyPermission, { label: string; desc: string; icon: any }> = {
  PAYOUTS:   { label: 'Payouts',    desc: 'Create and query payouts',       icon: 'send-outline' },
  BALANCES:  { label: 'Balances',   desc: 'Read wallet balances',            icon: 'wallet-outline' },
  RATES:     { label: 'FX Rates',   desc: 'Query live FX rates',             icon: 'trending-up-outline' },
  WEBHOOKS:  { label: 'Webhooks',   desc: 'Manage webhook endpoints',        icon: 'globe-outline' },
  READ_ONLY: { label: 'Read only',  desc: 'Read anything, write nothing',    icon: 'eye-outline' },
};

const ALL_PERMS: ApiKeyPermission[] = ['PAYOUTS', 'BALANCES', 'RATES', 'WEBHOOKS', 'READ_ONLY'];

export default function ApiKeysScreen() {
  const router = useRouter();
  const p      = useThemedPalette();
  const h      = useHaptics();
  const mode   = useTheme((s) => s.mode);

  const [keys,       setKeys]       = useState<BusinessApiKey[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<ApiKeyCreateResponse | null>(null);

  const load = useCallback(async () => {
    try { setKeys(await businessService.listApiKeys()); }
    catch { /* network error */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const revoke = (key: BusinessApiKey) => {
    Alert.alert(
      'Revoke API key?',
      `"${key.name}" will stop working immediately. Any integrations using this key will break.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke', style: 'destructive',
          onPress: async () => {
            h.warning();
            try {
              await businessService.revokeApiKey(key.id);
              h.success();
              setKeys((prev) => prev.map((k) => k.id === key.id ? { ...k, status: 'REVOKED' } : k));
            } catch (e: any) {
              Alert.alert('Failed', e?.response?.data?.error ?? 'Try again.');
            }
          },
        },
      ]
    );
  };

  const activeKeys  = keys.filter((k) => k.status === 'ACTIVE');
  const revokedKeys = keys.filter((k) => k.status !== 'ACTIVE');

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <TopGradient />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="API Keys" right={<HeaderTextButton label="New key" icon="add" onPress={() => setCreateOpen(true)} />} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 64 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ACCENT} />}
        >
          {loading ? (
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <ActivityIndicator color={ACCENT} size="large" />
            </View>
          ) : (
            <>
              {/* Active keys */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 8, marginBottom: 10 }}>
                ACTIVE KEYS ({activeKeys.length})
              </Text>
              {activeKeys.length > 0 ? (
                <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev }}>
                  {activeKeys.map((key, i) => (
                    <KeyRow
                      key={key.id}
                      apiKey={key}
                      palette={p}
                      accent={ACCENT}
                      isLast={i === activeKeys.length - 1}
                      onRevoke={() => revoke(key)}
                      onCopy={() => {
                        Clipboard.setStringAsync(`${key.prefix}…${key.last4}`);
                        h.selection();
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View style={{
                  padding: 28, borderRadius: 18, borderWidth: 1, borderColor: p.border,
                  backgroundColor: p.bgElev, alignItems: 'center',
                }}>
                  <Ionicons name="key-outline" size={32} color={p.fgFaint} />
                  <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600', marginTop: 12 }}>No active keys</Text>
                  <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 4, textAlign: 'center' }}>
                    Create an API key to start integrating tazdan payouts.
                  </Text>
                </View>
              )}

              {/* Revoked keys */}
              {revokedKeys.length > 0 && (
                <>
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                    REVOKED KEYS
                  </Text>
                  <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev, opacity: 0.6 }}>
                    {revokedKeys.map((key, i) => (
                      <KeyRow
                        key={key.id}
                        apiKey={key}
                        palette={p}
                        accent={ACCENT}
                        isLast={i === revokedKeys.length - 1}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Docs note */}
              <View style={{
                marginTop: 24, padding: 14, borderRadius: 14,
                backgroundColor: `${ACCENT}0A`, borderWidth: 1, borderColor: `${ACCENT}33`,
                flexDirection: 'row', gap: 10, alignItems: 'flex-start',
              }}>
                <Ionicons name="information-circle-outline" size={16} color={ACCENT} style={{ marginTop: 1 }} />
                <Text style={{ color: p.fgMuted, fontSize: 12, lineHeight: 17, flex: 1 }}>
                  Keys are shown once at creation. Use them in the{' '}
                  <Text style={{ color: ACCENT, fontWeight: '700' }}>Authorization: Bearer</Text>
                  {' '}header. See docs.tazdan.com for the full API reference.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Create key modal */}
      <CreateKeyModal
        visible={createOpen}
        palette={p}
        accent={ACCENT}
        onClose={() => setCreateOpen(false)}
        onCreate={async (payload) => {
          const created = await businessService.createApiKey(payload);
          setCreatedKey(created);
          setCreateOpen(false);
          setKeys((prev) => [created, ...prev]);
        }}
      />

      {/* Show raw key once */}
      {createdKey && (
        <NewKeyRevealModal
          apiKey={createdKey}
          palette={p}
          accent={ACCENT}
          onDone={() => setCreatedKey(null)}
        />
      )}
    </View>
  );
}

/* ── Key row ─────────────────────────────────────────────────────── */

function KeyRow({ apiKey, palette: p, accent, isLast, onRevoke, onCopy }: {
  apiKey: BusinessApiKey; palette: ReturnType<typeof useThemedPalette>; accent: string;
  isLast: boolean; onRevoke?: () => void; onCopy?: () => void;
}) {
  const isActive = apiKey.status === 'ACTIVE';
  return (
    <View style={{
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: p.border,
      gap: 8,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            backgroundColor: isActive ? `${accent}18` : p.bgRaised,
            borderWidth: 1, borderColor: isActive ? `${accent}40` : p.divider,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Ionicons name="key" size={14} color={isActive ? accent : p.fgFaint} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {apiKey.name}
            </Text>
            <Text style={{ color: p.fgFaint, fontSize: 11, fontWeight: '600', marginTop: 1, fontVariant: ['tabular-nums'] }}>
              {apiKey.prefix}••••{apiKey.last4}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {onCopy && (
            <Pressable onPress={onCopy} hitSlop={8}
              style={({ pressed }) => ({
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: pressed ? p.bgRaised : 'transparent',
                alignItems: 'center', justifyContent: 'center',
              })}>
              <Ionicons name="copy-outline" size={15} color={p.fgMuted} />
            </Pressable>
          )}
          {onRevoke && isActive && (
            <Pressable onPress={onRevoke} hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                backgroundColor: pressed ? 'rgba(248,113,113,0.15)' : 'rgba(248,113,113,0.08)',
                borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
              })}>
              <Text style={{ color: '#f87171', fontSize: 11, fontWeight: '700' }}>Revoke</Text>
            </Pressable>
          )}
          {!isActive && (
            <View style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
              backgroundColor: p.bgRaised,
            }}>
              <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700' }}>REVOKED</Text>
            </View>
          )}
        </View>
      </View>

      {/* Permissions */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
        {apiKey.permissions.map((perm) => (
          <View key={perm} style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
            backgroundColor: `${accent}14`, borderWidth: 1, borderColor: `${accent}30`,
          }}>
            <Text style={{ color: accent, fontSize: 10, fontWeight: '700' }}>
              {PERM_META[perm]?.label ?? perm}
            </Text>
          </View>
        ))}
      </View>

      {/* Last used + expiry */}
      <Text style={{ color: p.fgFaint, fontSize: 10.5, fontWeight: '600' }}>
        {apiKey.lastUsedAt
          ? `Last used ${new Date(apiKey.lastUsedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : 'Never used'}
        {apiKey.expiresAt
          ? ` · Expires ${new Date(apiKey.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          : ''}
      </Text>
    </View>
  );
}

/* ── Create key modal ────────────────────────────────────────────── */

function CreateKeyModal({ visible, palette: p, accent, onClose, onCreate }: {
  visible: boolean; palette: ReturnType<typeof useThemedPalette>; accent: string;
  onClose: () => void;
  onCreate: (payload: { name: string; permissions: ApiKeyPermission[]; expiresInDays?: number }) => Promise<void>;
}) {
  const h = useHaptics();
  const [name, setName]           = useState('');
  const [perms, setPerms]         = useState<Set<ApiKeyPermission>>(new Set(['PAYOUTS', 'BALANCES']));
  const [expiry, setExpiry]       = useState<number | null>(null);
  const [loading, setLoading]     = useState(false);

  const EXPIRY_OPTIONS = [
    { label: 'No expiry',  value: null },
    { label: '30 days',    value: 30 },
    { label: '90 days',    value: 90 },
    { label: '1 year',     value: 365 },
  ];

  const togglePerm = (perm: ApiKeyPermission) => {
    h.selection();
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm); else next.add(perm);
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim() || perms.size === 0) return;
    setLoading(true);
    try {
      await onCreate({ name: name.trim(), permissions: [...perms], expiresInDays: expiry ?? undefined });
      setName(''); setPerms(new Set(['PAYOUTS', 'BALANCES'])); setExpiry(null);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.error ?? 'Could not create key. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: p.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 36, paddingHorizontal: 22 }}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
          </View>

          <Text style={{ color: p.fg, fontSize: 19, fontWeight: '800', marginBottom: 20 }}>New API key</Text>

          {/* Name */}
          <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '700', marginBottom: 6 }}>KEY NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Production payouts"
            placeholderTextColor={p.fgFaint}
            style={{
              color: p.fg, backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border, borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 14,
              fontSize: 15, fontWeight: '600', marginBottom: 20,
            }}
          />

          {/* Permissions */}
          <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '700', marginBottom: 10 }}>PERMISSIONS</Text>
          {ALL_PERMS.map((perm) => {
            const meta    = PERM_META[perm];
            const active  = perms.has(perm);
            return (
              <Pressable key={perm} onPress={() => togglePerm(perm)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 6,
                  backgroundColor: active ? `${accent}12` : pressed ? p.bgElev : 'transparent',
                  borderWidth: 1, borderColor: active ? `${accent}44` : p.border,
                })}>
                <View style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: active ? `${accent}20` : p.bgRaised,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Ionicons name={meta.icon} size={16} color={active ? accent : p.fgMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 13.5, fontWeight: '700' }}>{meta.label}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 1 }}>{meta.desc}</Text>
                </View>
                <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={active ? accent : p.fgFaint} />
              </Pressable>
            );
          })}

          {/* Expiry */}
          <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '700', marginTop: 18, marginBottom: 10 }}>EXPIRY</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {EXPIRY_OPTIONS.map((opt) => {
              const active = expiry === opt.value;
              return (
                <Pressable key={String(opt.value)} onPress={() => { h.selection(); setExpiry(opt.value); }}
                  style={({ pressed }) => ({
                    flex: 1, height: 38, borderRadius: 12,
                    backgroundColor: active ? `${accent}15` : p.bgElev,
                    borderWidth: 1, borderColor: active ? accent : p.border,
                    alignItems: 'center', justifyContent: 'center',
                    opacity: pressed ? 0.75 : 1,
                  })}>
                  <Text style={{ color: active ? accent : p.fgMuted, fontSize: 11.5, fontWeight: '700' }}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Submit */}
          <Pressable
            onPress={submit}
            disabled={!name.trim() || perms.size === 0 || loading}
            style={({ pressed }) => ({
              marginTop: 22, borderRadius: 26, overflow: 'hidden',
              opacity: (!name.trim() || perms.size === 0 || loading) ? 0.5 : pressed ? 0.85 : 1,
            })}>
            <LinearGradient
              colors={[brand.primaryDark, brand.deep]}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Create key</Text>}
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ── New key reveal modal ─────────────────────────────────────────── */

function NewKeyRevealModal({ apiKey, palette: p, accent, onDone }: {
  apiKey: ApiKeyCreateResponse; palette: ReturnType<typeof useThemedPalette>;
  accent: string; onDone: () => void;
}) {
  const h = useHaptics();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    Clipboard.setStringAsync(apiKey.rawKey);
    h.success();
    setCopied(true);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{
          backgroundColor: p.bg, borderRadius: 28,
          padding: 28, borderWidth: 1, borderColor: `${accent}44`,
        }}>
          {/* Icon */}
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: `${accent}18`, borderWidth: 1, borderColor: `${accent}44`,
            alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center',
          }}>
            <Ionicons name="key" size={26} color={accent} />
          </View>

          <Text style={{ color: p.fg, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 }}>
            Save your API key
          </Text>
          <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
            This is the only time you'll see this key. Copy it now — we don't store the raw value.
          </Text>

          {/* Key display */}
          <Pressable onPress={copy}
            style={({ pressed }) => ({
              padding: 16, borderRadius: 16,
              backgroundColor: p.bgElev, borderWidth: 1,
              borderColor: copied ? `${accent}66` : p.border,
              opacity: pressed ? 0.75 : 1,
            })}>
            <Text style={{ color: p.fgFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 }}>
              YOUR API KEY — TAP TO COPY
            </Text>
            <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 0.3 }}
              selectable numberOfLines={2}>
              {apiKey.rawKey}
            </Text>
          </Pressable>

          {/* Copy button */}
          <Pressable onPress={copy}
            style={({ pressed }) => ({
              marginTop: 12, height: 48, borderRadius: 24, overflow: 'hidden',
              opacity: pressed ? 0.85 : 1,
            })}>
            <LinearGradient
              colors={copied ? [p.greenFg, '#16a34a'] : [brand.primaryDark, brand.deep]}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onDone} disabled={!copied}
            style={({ pressed }) => ({
              marginTop: 10, height: 46, borderRadius: 23,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: p.border,
              opacity: copied ? (pressed ? 0.7 : 1) : 0.35,
            })}>
            <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '700' }}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
