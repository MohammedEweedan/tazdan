import { StackHeader, HeaderTextButton } from '@/components/ui/ScreenHeader';
/**
 * Business team management screen.
 *
 * Lists team members (active + pending invites). Allows:
 *   - Inviting by email + assigning a role
 *   - Changing a member's role
 *   - Removing a member
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
import { useRouter } from 'expo-router';

import { brand, useTheme, useThemedPalette } from '@/store/themeStore';
import { useHaptics } from '@/hooks';
import { businessService } from '@/services/business';
import type { TeamMember, TeamRole } from '@/types/business';
import { TopGradient } from '@/components/ui/ScreenShell';

import { BottomSheet } from '@/components/ui/BottomSheet';
const ACCENT = '#737373';

const ROLE_META: Record<TeamRole, { label: string; desc: string; color: string }> = {
  OWNER:     { label: 'Owner',     desc: 'Full access including billing',   color: '#f59e0b' },
  ADMIN:     { label: 'Admin',     desc: 'Manage team and API keys',        color: '#63a1db' },
  DEVELOPER: { label: 'Developer', desc: 'API key access, view payouts',    color: ACCENT },
  ANALYST:   { label: 'Analyst',   desc: 'View-only — stats and payouts',   color: '#a78bfa' },
};

const ASSIGNABLE_ROLES: TeamRole[] = ['ADMIN', 'DEVELOPER', 'ANALYST'];

export default function TeamScreen() {
  const router = useRouter();
  const p      = useThemedPalette();
  const h      = useHaptics();
  const mode   = useTheme((s) => s.mode);

  const [members,    setMembers]    = useState<TeamMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    try { setMembers(await businessService.listTeam()); }
    catch { /* network */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = (member: TeamMember) => {
    const name = member.user
      ? `${member.user.firstName} ${member.user.lastName}`.trim()
      : member.email;
    Alert.alert(
      'Remove team member?',
      `${name} will lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            h.warning();
            try {
              await businessService.removeMember(member.id);
              h.success();
              setMembers((prev) => prev.filter((m) => m.id !== member.id));
            } catch (e: any) {
              Alert.alert('Failed', e?.response?.data?.error ?? 'Try again.');
            }
          },
        },
      ]
    );
  };

  const changeRole = (member: TeamMember) => {
    if (member.role === 'OWNER') return; // can't change owner
    const opts = ASSIGNABLE_ROLES.filter((r) => r !== member.role);
    Alert.alert(
      'Change role',
      undefined,
      [
        ...opts.map((role) => ({
          text: ROLE_META[role].label,
          onPress: async () => {
            try {
              const updated = await businessService.updateMemberRole(member.id, role);
              setMembers((prev) => prev.map((m) => m.id === member.id ? updated : m));
              h.success();
            } catch (e: any) {
              Alert.alert('Failed', e?.response?.data?.error ?? 'Try again.');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const active  = members.filter((m) => m.status === 'ACTIVE');
  const pending = members.filter((m) => m.status === 'PENDING');

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <TopGradient />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StackHeader title="Team" right={<HeaderTextButton label="Invite" icon="person-add-outline" onPress={() => setInviteOpen(true)} />} />

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
              {/* Active members */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 8, marginBottom: 10 }}>
                ACTIVE ({active.length})
              </Text>
              <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev }}>
                {active.length > 0 ? active.map((m, i) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    palette={p}
                    accent={ACCENT}
                    isLast={i === active.length - 1}
                    onChangeRole={() => changeRole(m)}
                    onRemove={() => remove(m)}
                  />
                )) : (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: p.fgMuted, fontSize: 14, fontWeight: '600' }}>No active members</Text>
                  </View>
                )}
              </View>

              {/* Pending invites */}
              {pending.length > 0 && (
                <>
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                    PENDING INVITES ({pending.length})
                  </Text>
                  <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev, opacity: 0.75 }}>
                    {pending.map((m, i) => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        palette={p}
                        accent={ACCENT}
                        isLast={i === pending.length - 1}
                        onRemove={() => remove(m)}
                      />
                    ))}
                  </View>
                </>
              )}

              {/* Role legend */}
              <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.7, marginTop: 28, marginBottom: 10 }}>
                ROLE PERMISSIONS
              </Text>
              <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.bgElev }}>
                {(Object.entries(ROLE_META) as [TeamRole, typeof ROLE_META[TeamRole]][]).map(([role, meta], i, arr) => (
                  <View key={role} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: p.border,
                  }}>
                    <View style={{
                      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                      backgroundColor: `${meta.color}18`, minWidth: 76, alignItems: 'center',
                    }}>
                      <Text style={{ color: meta.color, fontSize: 11, fontWeight: '800' }}>{meta.label}</Text>
                    </View>
                    <Text style={{ color: p.fgMuted, fontSize: 12.5, flex: 1 }}>{meta.desc}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <InviteModal
        visible={inviteOpen}
        palette={p}
        accent={ACCENT}
        onClose={() => setInviteOpen(false)}
        onInvite={async (payload) => {
          const member = await businessService.inviteMember(payload);
          setMembers((prev) => [...prev, member]);
          setInviteOpen(false);
        }}
      />
    </View>
  );
}

function MemberRow({ member, palette: p, accent, isLast, onChangeRole, onRemove }: {
  member: TeamMember; palette: ReturnType<typeof useThemedPalette>; accent: string;
  isLast: boolean; onChangeRole?: () => void; onRemove?: () => void;
}) {
  const roleMeta  = ROLE_META[member.role];
  const name      = member.user
    ? `${member.user.firstName} ${member.user.lastName}`.trim()
    : member.email;
  const isOwner   = member.role === 'OWNER';
  const isPending = member.status === 'PENDING';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: p.border,
    }}>
      {/* Avatar */}
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: `${roleMeta.color}18`,
        borderWidth: 1, borderColor: `${roleMeta.color}44`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: roleMeta.color, fontSize: 17, fontWeight: '700' }}>
          {name.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
          {isPending && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: p.amberBg }}>
              <Text style={{ color: p.amberFg, fontSize: 9.5, fontWeight: '700' }}>PENDING</Text>
            </View>
          )}
        </View>
        <Text style={{ color: p.fgFaint, fontSize: 11.5, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>
          {member.user?.username ? `@${member.user.username} · ` : ''}{member.email}
        </Text>
      </View>

      {/* Role chip + actions */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Pressable
          onPress={!isOwner && onChangeRole ? onChangeRole : undefined}
          style={({ pressed }) => ({
            paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
            backgroundColor: `${roleMeta.color}18`,
            borderWidth: 1, borderColor: `${roleMeta.color}40`,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: roleMeta.color, fontSize: 11, fontWeight: '800' }}>
            {roleMeta.label}{!isOwner && onChangeRole ? ' ↓' : ''}
          </Text>
        </Pressable>
        {!isOwner && onRemove && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={{ color: p.redFg, fontSize: 10.5, fontWeight: '700' }}>Remove</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function InviteModal({ visible, palette: p, accent, onClose, onInvite }: {
  visible: boolean; palette: ReturnType<typeof useThemedPalette>; accent: string;
  onClose: () => void;
  onInvite: (payload: { email: string; role: TeamRole }) => Promise<void>;
}) {
  const h = useHaptics();
  const [email,   setEmail]   = useState('');
  const [role,    setRole]    = useState<TeamRole>('DEVELOPER');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !email.includes('@')) return;
    setLoading(true);
    try {
      await onInvite({ email: email.trim(), role });
      setEmail(''); setRole('DEVELOPER');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.error ?? 'Could not send invite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={"Invite team member"}>
          {/* Email */}
          <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '700', marginBottom: 6 }}>EMAIL</Text>
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="colleague@company.com"
            placeholderTextColor={p.fgFaint}
            keyboardType="email-address" autoCapitalize="none"
            style={{
              color: p.fg, backgroundColor: p.bgElev,
              borderWidth: 1, borderColor: p.border, borderRadius: 14,
              paddingHorizontal: 14, paddingVertical: 14,
              fontSize: 15, fontWeight: '600', marginBottom: 20,
            }}
          />

          {/* Role */}
          <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '700', marginBottom: 10 }}>ROLE</Text>
          <View style={{ gap: 6 }}>
            {ASSIGNABLE_ROLES.map((r) => {
              const meta   = ROLE_META[r];
              const active = role === r;
              return (
                <Pressable key={r} onPress={() => { h.selection(); setRole(r); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14,
                    backgroundColor: active ? `${meta.color}14` : pressed ? p.bgElev : 'transparent',
                    borderWidth: 1, borderColor: active ? `${meta.color}55` : p.border,
                  })}>
                  <Text style={{ color: meta.color, fontSize: 13.5, fontWeight: '800', minWidth: 72 }}>{meta.label}</Text>
                  <Text style={{ color: p.fgMuted, fontSize: 12, flex: 1 }}>{meta.desc}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={meta.color} />}
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={submit} disabled={!email.trim() || loading}
            style={({ pressed }) => ({
              marginTop: 22, borderRadius: 26, overflow: 'hidden',
              opacity: (!email.trim() || loading) ? 0.5 : pressed ? 0.85 : 1,
            })}>
            <LinearGradient
              colors={[brand.primaryDark, brand.deep]}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Send invite</Text>}
            </LinearGradient>
          </Pressable>
        </BottomSheet>
  );
}
