/**
 * Verification — your level, what it lets you do (live limits with reset
 * dates), and how to reach the next level.
 *
 *   Level 1  identity: an ID document and a selfie holding it
 *   Level 2  proof of address (utility bill or bank statement, last 3 months)
 *   Level 3  source of funds (payslip, bank statement or business papers)
 *
 * Submitting documents for a higher level never removes the limits you
 * already have; the server keeps your level while they are reviewed.
 */
import { useCallback, useMemo, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { ScreenShell, CTAButton } from '@/components/ui/ScreenShell';
import { FadeIn } from '@/components/ui/Motion';
import { useTheme, useThemedPalette, isMonochrome } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useT } from '@/store/i18nStore';
import { authService } from '@/services';
import { api } from '@/lib/api';
import { useHaptics, useTransactionSound } from '@/hooks';
import { useLimits, LIMITS_QUERY_KEY, type LimitedAction } from '@/hooks/useLimits';

type Level = 'IDENTITY' | 'ADDRESS' | 'SOURCE_OF_FUNDS';
type IdType = 'passport' | 'national_id' | 'driving_licence';
interface PickedFile { uri: string; name: string; type: string }
interface KycStatus { kycStatus: string; kycTier: string; pendingUpgrade: string | null; rejectionReason: string | null; documents: Array<{ id: string; documentType: string; status: string; createdAt: string }> }

const TIERS = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'] as const;
const LEVEL_FOR_TIER: Record<string, Level | null> = { TIER_0: 'IDENTITY', TIER_1: 'ADDRESS', TIER_2: 'SOURCE_OF_FUNDS', TIER_3: null };
const ACTIONS: Array<{ key: LimitedAction; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { key: 'ONRAMP_BUY', icon: 'trending-up', label: 'kyc.action.buy' },
  { key: 'OFFRAMP_SELL', icon: 'trending-down', label: 'kyc.action.sell' },
  { key: 'SEND', icon: 'arrow-up', label: 'kyc.action.send' },
  { key: 'WITHDRAW', icon: 'arrow-up-circle-outline', label: 'kyc.action.withdraw' },
];
const usd = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

async function submitDocs(level: Level, files: PickedFile[], idType: IdType) {
  const form = new FormData();
  form.append('level', level);
  form.append('documentType', level === 'IDENTITY' ? idType : level.toLowerCase());
  for (const f of files) form.append('documents', { uri: f.uri, name: f.name, type: f.type } as any);
  const { data } = await api.post('/users/kyc', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data ?? {};
}

export default function VerificationScreen() {
  const p = useThemedPalette();
  const t = useT();
  const h = useHaptics();
  const { playSuccess } = useTransactionSound();
  const qc = useQueryClient();
  const themeMode = useTheme((s) => s.mode);
  const updateUser = useAuthStore((s) => s.updateUser);

  const statusQ = useQuery<KycStatus>({ queryKey: ['kyc-status'], queryFn: async () => (await api.get('/users/kyc')).data });
  const limitsQ = useLimits();
  const [idType, setIdType] = useState<IdType>('passport');
  const [files, setFiles] = useState<Record<string, PickedFile | null>>({});

  const status = statusQ.data?.kycStatus ?? 'NOT_SUBMITTED';
  const tier = status === 'APPROVED' ? (statusQ.data?.kycTier === 'TIER_0' ? 'TIER_1' : statusQ.data?.kycTier ?? 'TIER_1') : 'TIER_0';
  const tierIdx = TIERS.indexOf(tier as any);
  const nextLevel: Level | null = status === 'PENDING' ? null : LEVEL_FOR_TIER[tier];
  const reviewing = status === 'PENDING' || Boolean(statusQ.data?.pendingUpgrade);
  const rejected = status === 'REJECTED';

  // Upload slots for the step the customer is on.
  const slots = useMemo(() => {
    if (nextLevel === 'IDENTITY') {
      return [
        { key: 'front', label: t(idType === 'passport' ? 'kyc.slot.passport' : 'kyc.slot.front'), icon: 'card-outline' as const, required: true },
        ...(idType === 'passport' ? [] : [{ key: 'back', label: t('kyc.slot.back'), icon: 'card-outline' as const, required: true }]),
        { key: 'selfie', label: t('kyc.slot.selfie'), icon: 'person-circle-outline' as const, required: true },
      ];
    }
    if (nextLevel === 'ADDRESS') return [{ key: 'address', label: t('kyc.slot.address'), icon: 'home-outline' as const, required: true }, { key: 'address2', label: t('kyc.slot.optionalPage'), icon: 'document-outline' as const, required: false }];
    if (nextLevel === 'SOURCE_OF_FUNDS') return [{ key: 'sof', label: t('kyc.slot.sof'), icon: 'briefcase-outline' as const, required: true }, { key: 'sof2', label: t('kyc.slot.optionalPage'), icon: 'document-outline' as const, required: false }];
    return [];
  }, [nextLevel, idType, t]);
  const ready = slots.every((s) => !s.required || files[s.key]);

  const submit = useMutation({
    mutationFn: () => submitDocs(nextLevel!, slots.map((s) => files[s.key]).filter((f): f is PickedFile => !!f), idType),
    onSuccess: async (res) => {
      playSuccess('deposit');
      setFiles({});
      qc.invalidateQueries({ queryKey: ['kyc-status'] });
      qc.invalidateQueries({ queryKey: LIMITS_QUERY_KEY });
      try { updateUser(await authService.me()); } catch { /* keep cached user */ }
      Alert.alert(res?.autoApproved ? t('kyc.doneVerified') : t('kyc.doneSubmitted'), res?.autoApproved ? t('kyc.doneVerifiedBody') : t('kyc.doneSubmittedBody'));
    },
    onError: (e: any) => { h.error(); Alert.alert(t('kyc.uploadFailed'), e?.response?.data?.error ?? t('common.retry')); },
  });

  const capture = useCallback(async (key: string, source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert(t('kyc.permission'), t(source === 'camera' ? 'kyc.permissionCamera' : 'kyc.permissionPhotos')); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: key !== 'selfie' };
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: key === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back }) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets[0]) return;
    const a = result.assets[0];
    const ext = (a.uri.split('.').pop() ?? 'jpg').toLowerCase();
    h.selection();
    setFiles((prev) => ({ ...prev, [key]: { uri: a.uri, name: `${key}_${Date.now()}.${ext}`, type: ext === 'png' ? 'image/png' : 'image/jpeg' } }));
  }, [h, t]);

  const chooseSource = (key: string) => {
    h.selection();
    const options = [t('kyc.takePhoto'), t('kyc.fromLibrary'), t('common.cancel')];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2 }, (i) => { if (i === 0) void capture(key, 'camera'); if (i === 1) void capture(key, 'library'); });
    } else {
      Alert.alert(t('kyc.addPhoto'), undefined, [
        { text: options[0], onPress: () => capture(key, 'camera') },
        { text: options[1], onPress: () => capture(key, 'library') },
        { text: options[2], style: 'cancel' },
      ]);
    }
  };

  const brand = p.balanceGradient;
  const levelTitle = tierIdx === 0 ? t('kyc.unverified') : t('kyc.level', { n: tierIdx });
  const levelSub = status === 'PENDING' ? t('kyc.sub.reviewing') : rejected ? t('kyc.sub.rejected') : tierIdx === 0 ? t('kyc.sub.start') : tierIdx === 3 ? t('kyc.sub.full') : t(tierIdx === 1 ? 'kyc.sub.l1' : 'kyc.sub.l2');
  const limits = limitsQ.data?.actions;
  const nextTierInfo = limits?.ONRAMP_BUY?.nextTier;

  return (
    <ScreenShell title={t('kyc.title')} onRefresh={() => { void statusQ.refetch(); void limitsQ.refetch(); }} refreshing={statusQ.isRefetching}>
      {statusQ.isLoading ? (
        <View style={{ paddingTop: 60, alignItems: 'center' }}><ActivityIndicator color={p.accent} /></View>
      ) : (
        <FadeIn>
          {/* ── Level card ── */}
          <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20, marginTop: 4, overflow: 'hidden' }}>
            <Ionicons name="shield-checkmark" size={120} color="rgba(255,255,255,0.08)" style={{ position: 'absolute', right: -18, top: -14 }} />
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600', letterSpacing: 0.6 }}>{t('kyc.yourLevel').toUpperCase()}</Text>
            <Text style={{ color: p.fg, fontSize: 30, fontWeight: '700', letterSpacing: -0.6, marginTop: 4 }}>{levelTitle}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 2 }}>{levelSub}</Text>
            {/* Three steps: identity, address, source of funds */}
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 18 }}>
              {[1, 2, 3].map((n) => {
                const done = tierIdx >= n;
                const active = !done && reviewing && n === tierIdx + 1;
                return <View key={n} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: done ? '#FFFFFF' : active ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)' }} />;
              })}
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              {['kyc.step.identity', 'kyc.step.address', 'kyc.step.funds'].map((k, i) => (
                <Text key={k} style={{ flex: 1, color: tierIdx > i ? '#FFFFFF' : 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', textAlign: i === 0 ? 'left' : i === 1 ? 'center' : 'right' }}>{t(k)}</Text>
              ))}
            </View>
            {reviewing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                <Ionicons name="time-outline" size={13} color="#FFFFFF" />
                <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600' }}>{t('kyc.inReview')}</Text>
              </View>
            ) : null}
          </LinearGradient>

          {/* ── Declined ── */}
          {rejected || (statusQ.data?.rejectionReason && !reviewing && nextLevel && nextLevel !== 'IDENTITY' && statusQ.data.documents[0]?.status === 'REJECTED') ? (
            <View style={{ flexDirection: 'row', gap: 10, backgroundColor: p.redBg, borderRadius: 16, padding: 14, marginTop: 14 }}>
              <Ionicons name="alert-circle-outline" size={18} color={p.redFg} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.fg, fontSize: 13, fontWeight: '600' }}>{t('kyc.declined')}</Text>
                <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2, lineHeight: 17 }}>{statusQ.data?.rejectionReason || t('kyc.declinedGeneric')}</Text>
              </View>
            </View>
          ) : null}

          {/* ── In review ── */}
          {reviewing ? (
            <View style={{ marginTop: 22 }}>
              {[
                { icon: 'cloud-done-outline' as const, title: t('kyc.timeline.submitted'), sub: statusQ.data?.documents[0] ? new Date(statusQ.data.documents[0].createdAt).toLocaleString() : '', state: 'done' },
                { icon: 'search-outline' as const, title: t('kyc.timeline.review'), sub: t('kyc.timeline.reviewSub'), state: 'current' },
                { icon: 'shield-checkmark-outline' as const, title: t('kyc.timeline.decision'), sub: t('kyc.timeline.decisionSub'), state: 'next' },
              ].map((s, i, all) => (
                <View key={s.title} style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: s.state === 'done' ? p.greenBg : s.state === 'current' ? p.accentSoft : p.bgElev }}>
                      <Ionicons name={s.icon} size={16} color={s.state === 'done' ? p.greenFg : s.state === 'current' ? p.accentText : p.fgFaint} />
                    </View>
                    {i < all.length - 1 ? <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: p.border, marginVertical: 2 }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 16 }}>
                    <Text style={{ color: s.state === 'next' ? p.fgMuted : p.fg, fontSize: 14, fontWeight: '600', marginTop: 6 }}>{s.title}</Text>
                    {s.sub ? <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>{s.sub}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Live limits at this level ── */}
          {limits && tierIdx > 0 ? (
            <View style={{ marginTop: 26 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 6 }}>{t('kyc.yourLimits').toUpperCase()}</Text>
              {ACTIONS.map((a, i) => {
                const st = limits[a.key];
                if (!st) return null;
                const used = st.monthly.limitUsd > 0 ? Math.min(1, st.monthly.usedUsd / st.monthly.limitUsd) : 0;
                return (
                  <View key={a.key} style={{ paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderColor: p.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={a.icon} size={16} color={p.fgMuted} />
                      <Text style={{ flex: 1, color: p.fg, fontSize: 14, fontWeight: '600' }}>{t(a.label)}</Text>
                      <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
                        {st.blocked ? t('kyc.notAvailable') : t('kyc.perMonth', { amount: usd(st.monthly.limitUsd) })}
                      </Text>
                    </View>
                    {!st.blocked ? (
                      <>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: p.border, marginTop: 9, marginLeft: 26, overflow: 'hidden' }}>
                          <View style={{ width: `${used * 100}%`, height: '100%', borderRadius: 2, backgroundColor: used >= 1 ? p.amberFg : p.accent }} />
                        </View>
                        <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 6, marginLeft: 26 }}>
                          {t('kyc.leftResets', { left: usd(st.monthly.remainingUsd), date: st.monthly.resetsOn, perTx: usd(st.perTxUsd) })}
                        </Text>
                      </>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* ── Next level ── */}
          {nextLevel && !reviewing ? (
            <View style={{ marginTop: 26 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, marginBottom: 8 }}>
                {(nextLevel === 'IDENTITY' ? t('kyc.getVerified') : t('kyc.raiseTo', { n: tierIdx + 1 })).toUpperCase()}
              </Text>
              {nextTierInfo ? (
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: t('kyc.action.buy'), value: usd(nextTierInfo.monthlyUsd) },
                    { label: t('kyc.action.withdraw'), value: limits?.WITHDRAW?.nextTier ? usd(limits.WITHDRAW.nextTier.monthlyUsd) : '—' },
                    { label: t('kyc.action.send'), value: limits?.SEND?.nextTier ? usd(limits.SEND.nextTier.monthlyUsd) : '—' },
                  ].map((b) => (
                    <View key={b.label} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: p.accentSoft }}>
                      <Text style={{ color: p.accentText, fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{b.value}</Text>
                      <Text style={{ color: p.fgMuted, fontSize: 11, marginTop: 2 }}>{t('kyc.monthTo', { action: b.label.toLowerCase() })}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={{ color: p.fg, fontSize: 14, lineHeight: 20 }}>
                {t(nextLevel === 'IDENTITY' ? 'kyc.need.identity' : nextLevel === 'ADDRESS' ? 'kyc.need.address' : 'kyc.need.funds')}
              </Text>

              {nextLevel === 'IDENTITY' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                  {(['passport', 'national_id', 'driving_licence'] as IdType[]).map((k) => {
                    const on = idType === k;
                    return (
                      <Pressable key={k} onPress={() => { h.selection(); setIdType(k); setFiles({}); }} style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: on ? p.accent : p.bgElev, borderWidth: on ? 0 : StyleSheet.hairlineWidth, borderColor: p.border, opacity: pressed ? 0.8 : 1 })}>
                        <Text style={{ color: on ? p.accentFg : p.fg, fontSize: 13, fontWeight: '600' }}>{t(`kyc.id.${k}`)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* Capture tiles */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                {slots.map((s) => {
                  const f = files[s.key];
                  return (
                    <Pressable key={s.key} onPress={() => chooseSource(s.key)} style={({ pressed }) => ({
                      width: slots.length === 3 ? '31.5%' : '48.5%', aspectRatio: s.key === 'selfie' ? 0.8 : 1.25, borderRadius: 16, overflow: 'hidden',
                      backgroundColor: p.bgElev, borderWidth: f ? 0 : 1.5, borderStyle: 'dashed', borderColor: p.border, opacity: pressed ? 0.8 : 1,
                      alignItems: 'center', justifyContent: 'center',
                    })}>
                      {f ? (
                        <>
                          <Image source={{ uri: f.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          <View style={{ position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: p.greenFg, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                          </View>
                          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.45)' }}>
                            <Text style={{ color: p.fg, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{t('kyc.retake')}</Text>
                          </View>
                        </>
                      ) : (
                        <>
                          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={s.icon} size={20} color={p.accentText} />
                          </View>
                          <Text style={{ color: p.fg, fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center', paddingHorizontal: 6 }} numberOfLines={2}>{s.label}</Text>
                          {!s.required ? <Text style={{ color: p.fgFaint, fontSize: 10, marginTop: 2 }}>{t('kyc.optional')}</Text> : null}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Tips */}
              <View style={{ marginTop: 16, gap: 8 }}>
                {['kyc.tip.light', 'kyc.tip.corners', 'kyc.tip.glare'].map((k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={p.greenFg} />
                    <Text style={{ color: p.fgMuted, fontSize: 12, flex: 1 }}>{t(k)}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 20 }} />
              <CTAButton label={t('kyc.submit')} icon="shield-checkmark-outline" onPress={() => { h.medium(); submit.mutate(); }} disabled={!ready || submit.isPending} loading={submit.isPending} />
              <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', marginTop: 12 }}>
                <Ionicons name="lock-closed-outline" size={12} color={p.fgFaint} />
                <Text style={{ color: p.fgFaint, fontSize: 11 }}>{t('kyc.privacy')}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Fully verified ── */}
          {tierIdx === 3 && !reviewing ? (
            <View style={{ alignItems: 'center', marginTop: 26, gap: 6 }}>
              <Ionicons name="ribbon-outline" size={28} color={p.accentText} />
              <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center' }}>{t('kyc.topLevel')}</Text>
            </View>
          ) : null}
          <View style={{ height: 28 }} />
        </FadeIn>
      )}
    </ScreenShell>
  );
}
