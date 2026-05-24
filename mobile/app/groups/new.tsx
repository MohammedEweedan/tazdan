/**
 * Create-group screen.
 *
 * Three sections:
 *   1. Basics — name + description
 *   2. Members — type-ahead @handle search, tap to add
 *   3. Pool (optional) — toggle on; pick SHARED_WALLET or GOAL_BASED;
 *                        for goal-based add target USD + deadline.
 *
 * Submits via useCreateGroup() and navigates straight into the new
 * group's chat screen.
 */

import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';

import { ScreenShell } from '@/components/ui/ScreenShell';
import { brand, useTheme, useThemedPalette } from '@/store/themeStore';
import { useCreateGroup, useHaptics } from '@/hooks';
import { profileService } from '@/services';
import type { PoolKind } from '@/types/groups';

interface SelectedUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export default function NewGroup() {
  const router = useRouter();
  const h = useHaptics();
  const p = useThemedPalette();
  const themeMode = useTheme((s) => s.mode);
  const accent = themeMode === 'dark' ? brand.primaryDark : brand.primary;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<SelectedUser[]>([]);
  const [query, setQuery] = useState('');

  // Optional liquidity pool
  const [poolEnabled, setPoolEnabled] = useState(false);
  const [poolName, setPoolName] = useState('');
  const [poolKind, setPoolKind] = useState<PoolKind>('SHARED_WALLET');
  const [poolTarget, setPoolTarget] = useState('');
  const [poolDays, setPoolDays] = useState('30');

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['profile-search', query],
    queryFn:  () => profileService.search(query),
    enabled:  query.trim().length >= 2,
    staleTime: 5_000,
  });

  const create = useCreateGroup();

  const canSubmit =
    name.trim().length > 0 &&
    members.length >= 1 &&
    !create.isPending &&
    (!poolEnabled || (
      poolName.trim().length > 0 &&
      (poolKind === 'SHARED_WALLET' || Number(poolTarget) > 0)
    ));

  const addMember = (u: SelectedUser) => {
    if (members.find((m) => m.id === u.id)) return;
    h.selection();
    setMembers((prev) => [...prev, u]);
    setQuery('');
  };

  const removeMember = (id: string) => {
    h.light();
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const submit = async () => {
    if (!canSubmit) return;
    h.medium();
    try {
      const group = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: members.map((m) => m.id),
        pool: poolEnabled ? {
          name: poolName.trim(),
          kind: poolKind,
          targetAmountUsd: poolKind === 'GOAL_BASED' ? Number(poolTarget) : undefined,
          deadline: poolKind === 'GOAL_BASED'
            ? new Date(Date.now() + Math.max(1, Number(poolDays) || 30) * 86_400_000).toISOString()
            : undefined,
        } : undefined,
      });
      router.replace(`/groups/${group.id}`);
    } catch (e: any) {
      // Server errors surface here — leave the screen open so the user can retry.
      console.warn('Create group failed', e?.response?.data ?? e?.message);
    }
  };

  return (
    <ScreenShell title="New group" back>
      <View style={{ gap: 22 }}>
        {/* Basics */}
        <Section title="BASICS" accent={accent}>
          <Field label="Group name" palette={p}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Weekend trip"
              placeholderTextColor={p.fgFaint}
              maxLength={80}
              style={inputStyle(p)}
            />
          </Field>
          <Field label="Description (optional)" palette={p}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What's this group about?"
              placeholderTextColor={p.fgFaint}
              maxLength={500}
              multiline
              style={[inputStyle(p), { minHeight: 64, textAlignVertical: 'top' }]}
            />
          </Field>
        </Section>

        {/* Members */}
        <Section title={`MEMBERS · ${members.length}`} accent={accent}>
          {/* Selected pills */}
          {members.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {members.map((m) => (
                <Pressable
                  key={m.id}
                  onPress={() => removeMember(m.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingLeft: 10, paddingRight: 8, paddingVertical: 6, borderRadius: 14,
                    backgroundColor: `${accent}1A`,
                    borderWidth: 1, borderColor: `${accent}44`,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: accent, fontSize: 12, fontWeight: '700' }}>@{m.username}</Text>
                  <Ionicons name="close-circle" size={14} color={accent} />
                </Pressable>
              ))}
            </View>
          )}

          <Field label="Add by @handle" palette={p}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by username…"
              placeholderTextColor={p.fgFaint}
              autoCapitalize="none"
              style={inputStyle(p)}
            />
          </Field>

          {searching && <ActivityIndicator size="small" color={accent} style={{ marginTop: 8 }} />}
          {!searching && query.trim().length >= 2 && (searchResults ?? []).length === 0 && (
            <Text style={{ color: p.fgFaint, fontSize: 12, marginTop: 8 }}>No matches</Text>
          )}
          {(searchResults ?? []).map((u) => {
            const already = !!members.find((m) => m.id === u.id);
            return (
              <Pressable
                key={u.id}
                onPress={() => !already && addMember(u as SelectedUser)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 10, paddingHorizontal: 6,
                  opacity: already ? 0.4 : pressed ? 0.7 : 1,
                })}
              >
                <View style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: `${accent}1A`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: accent, fontSize: 14, fontWeight: '700' }}>
                    {(u.firstName?.[0] ?? u.username?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                    {u.firstName} {u.lastName}
                  </Text>
                  <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
                    @{u.username}
                  </Text>
                </View>
                <Ionicons name={already ? 'checkmark-circle' : 'add-circle-outline'} size={20} color={already ? p.greenFg : accent} />
              </Pressable>
            );
          })}
        </Section>

        {/* Pool */}
        <Section title="LIQUIDITY POOL · OPTIONAL" accent={accent}>
          <Pressable
            onPress={() => { h.selection(); setPoolEnabled(!poolEnabled); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 10,
            }}
          >
            <View style={{
              width: 44, height: 26, borderRadius: 13, padding: 2,
              backgroundColor: poolEnabled ? accent : p.pillBg,
              justifyContent: 'center',
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: '#fff',
                marginLeft: poolEnabled ? 18 : 0,
              }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 14, fontWeight: '700' }}>
                Add a liquidity pool
              </Text>
              <Text style={{ color: p.fgMuted, fontSize: 11.5, fontWeight: '500', marginTop: 2, lineHeight: 16 }}>
                Members can pool funds together. Pick a kind below.
              </Text>
            </View>
          </Pressable>

          {poolEnabled && (
            <View style={{ gap: 14, marginTop: 6 }}>
              <Field label="Pool name" palette={p}>
                <TextInput
                  value={poolName}
                  onChangeText={setPoolName}
                  placeholder={poolKind === 'GOAL_BASED' ? 'e.g. Weekend trip fund' : 'e.g. Shared wallet'}
                  placeholderTextColor={p.fgFaint}
                  maxLength={80}
                  style={inputStyle(p)}
                />
              </Field>

              {/* Kind picker */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <KindCard
                  active={poolKind === 'SHARED_WALLET'}
                  onPress={() => { h.selection(); setPoolKind('SHARED_WALLET'); }}
                  icon="wallet-outline"
                  title="Shared wallet"
                  subtitle="Deposit/withdraw any time. Tracks share %."
                  accent={accent}
                  palette={p}
                />
                <KindCard
                  active={poolKind === 'GOAL_BASED'}
                  onPress={() => { h.selection(); setPoolKind('GOAL_BASED'); }}
                  icon="flag-outline"
                  title="Savings goal"
                  subtitle="Target amount, locked until met."
                  accent={accent}
                  palette={p}
                />
              </View>

              {poolKind === 'GOAL_BASED' && (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Target (USD)" palette={p}>
                      <TextInput
                        value={poolTarget}
                        onChangeText={(t) => setPoolTarget(t.replace(/[^0-9.]/g, ''))}
                        keyboardType="decimal-pad"
                        placeholder="1000"
                        placeholderTextColor={p.fgFaint}
                        style={inputStyle(p)}
                      />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Deadline (days)" palette={p}>
                      <TextInput
                        value={poolDays}
                        onChangeText={(t) => setPoolDays(t.replace(/[^0-9]/g, ''))}
                        keyboardType="number-pad"
                        placeholder="30"
                        placeholderTextColor={p.fgFaint}
                        style={inputStyle(p)}
                      />
                    </Field>
                  </View>
                </View>
              )}
            </View>
          )}
        </Section>

        {/* Submit */}
        <Pressable
          onPress={submit}
          disabled={!canSubmit}
          style={({ pressed }) => ({
            marginTop: 8,
            borderRadius: 28, overflow: 'hidden',
            opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
            shadowColor: accent, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
          })}
        >
          <LinearGradient
            colors={[brand.primaryDark, brand.primary, brand.deep]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ height: 54, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
          >
            {create.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="people" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>
                  Create group
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

// ── Subcomponents ───────────────────────────────────────────────────

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: accent }} />
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, opacity: 0.7 }}>
          {title}
        </Text>
      </View>
      <View style={{ gap: 12 }}>{children}</View>
    </View>
  );
}

function Field({ label, palette: p, children }: { label: string; palette: any; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
      {children}
    </View>
  );
}

function inputStyle(p: any) {
  return {
    color: p.fg,
    backgroundColor: p.bgElev,
    borderWidth: 1, borderColor: p.border,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontWeight: '600' as const,
  };
}

function KindCard({
  active, onPress, icon, title, subtitle, accent, palette: p,
}: {
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  palette: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        padding: 12, borderRadius: 16,
        backgroundColor: active ? `${accent}1A` : p.bgElev,
        borderWidth: 1, borderColor: active ? accent : p.border,
        opacity: pressed ? 0.85 : 1,
        gap: 8,
      })}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: active ? accent : `${accent}1F`,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Ionicons name={icon} size={16} color={active ? '#fff' : accent} />
      </View>
      <Text style={{ color: p.fg, fontSize: 13, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: p.fgMuted, fontSize: 11, fontWeight: '500', lineHeight: 14 }}>
        {subtitle}
      </Text>
    </Pressable>
  );
}
