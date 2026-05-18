/**
 * KYC (Identity Verification) screen.
 * Users upload a government-issued ID (front + back optional) and a selfie.
 * On submit, files are POSTed to /api/users/kyc via multipart/form-data.
 */

import { useState, useCallback } from 'react';
import {
  Alert, Image, Pressable, ScrollView, View, ActivityIndicator,
} from 'react-native';
import { Text } from '@/components/ui/Text';
import { ScreenShell, Panel } from '@/components/ui/ScreenShell';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useThemedPalette } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useRouter } from 'expo-router';
import { useHaptics } from '@/hooks';

type DocSlot = 'front' | 'back' | 'selfie';

interface PickedFile {
  uri: string;
  name: string;
  type: string;
}

const SLOT_META: Record<DocSlot, { label: string; hint: string; icon: keyof typeof Ionicons.glyphMap; required: boolean }> = {
  front:  { label: 'ID Front',   hint: 'Clear photo of the front of your ID / passport', icon: 'card-outline',          required: true },
  back:   { label: 'ID Back',    hint: 'Back side of your ID (skip for passports)',       icon: 'card-outline',          required: false },
  selfie: { label: 'Selfie',     hint: 'Hold your ID next to your face',                 icon: 'person-circle-outline', required: true },
};

const STATUS_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  NOT_SUBMITTED: { label: 'Not submitted', color: '#64748b', icon: 'ellipse-outline' },
  PENDING:       { label: 'Under review',  color: '#f59e0b', icon: 'time-outline' },
  APPROVED:      { label: 'Verified',      color: '#22c55e', icon: 'checkmark-circle' },
  REJECTED:      { label: 'Rejected',      color: '#ef4444', icon: 'close-circle' },
};

async function fetchKYCStatus(): Promise<{ kycStatus: string; documents: any[] }> {
  const { data } = await api.get('/users/kyc');
  return data;
}

async function submitKYC(files: Record<DocSlot, PickedFile | null>): Promise<void> {
  const form = new FormData();
  form.append('documentType', 'identity');
  for (const slot of Object.keys(files) as DocSlot[]) {
    const f = files[slot];
    if (f) form.append('documents', { uri: f.uri, name: f.name, type: f.type } as any);
  }
  await api.post('/users/kyc', form, { headers: { 'Content-Type': 'multipart/form-data' } });
}

export default function KYCScreen() {
  const p = useThemedPalette();
  const h = useHaptics();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [files, setFiles] = useState<Record<DocSlot, PickedFile | null>>({ front: null, back: null, selfie: null });

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-status'],
    queryFn: fetchKYCStatus,
  });

  const submit = useMutation({
    mutationFn: () => submitKYC(files),
    onSuccess: () => {
      h.success();
      qc.invalidateQueries({ queryKey: ['kyc-status'] });
      Alert.alert('Submitted', 'Your documents are under review. We\'ll notify you when verified.');
    },
    onError: (e: any) => {
      h.error();
      Alert.alert('Upload failed', e?.response?.data?.error ?? 'Please try again.');
    },
  });

  const pick = useCallback(async (slot: DocSlot) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    setFiles((prev) => ({
      ...prev,
      [slot]: { uri: asset.uri, name: `${slot}_${Date.now()}.${ext}`, type: `image/${ext}` },
    }));
  }, []);

  const takePhoto = useCallback(async (slot: DocSlot) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop() ?? 'jpg';
    setFiles((prev) => ({
      ...prev,
      [slot]: { uri: asset.uri, name: `${slot}_${Date.now()}.${ext}`, type: `image/${ext}` },
    }));
  }, []);

  const handleSlotPress = (slot: DocSlot) => {
    h.selection();
    Alert.alert(SLOT_META[slot].label, 'Choose source', [
      { text: 'Camera',        onPress: () => takePhoto(slot) },
      { text: 'Photo Library', onPress: () => pick(slot) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const status = data?.kycStatus ?? user?.kycStatus ?? 'NOT_SUBMITTED';
  const sm = STATUS_META[status] ?? STATUS_META.NOT_SUBMITTED;
  const canSubmit = !!files.front && !!files.selfie;
  const isPending = status === 'PENDING';
  const isApproved = status === 'APPROVED';

  return (
    <ScreenShell title="Identity Verification" subtitle="KYC">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Status card */}
        <Panel style={{ marginTop: 12, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: `${sm.color}18`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name={sm.icon} size={22} color={sm.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.fg, fontSize: 15, fontWeight: '700' }}>Verification status</Text>
              <Text style={{ color: sm.color, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{sm.label}</Text>
            </View>
          </View>

          {status === 'REJECTED' && (
            <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <Text style={{ color: p.fgMuted, fontSize: 12 }}>
                Your verification was rejected. Please re-upload clearer documents.
              </Text>
            </View>
          )}
        </Panel>

        {!isApproved && (
          <>
            {/* Info box */}
            <View style={{
              marginHorizontal: 16, marginTop: 8, marginBottom: 4,
              padding: 14, borderRadius: 14,
              backgroundColor: `${p.ctaBg}18`,
              borderWidth: 1, borderColor: `${p.ctaBg}40`,
              flexDirection: 'row', gap: 10,
            }}>
              <Ionicons name="information-circle-outline" size={18} color={p.ctaBg} />
              <Text style={{ flex: 1, color: p.fgMuted, fontSize: 12, lineHeight: 18 }}>
                Upload a government-issued ID (passport, national ID, or driving licence) and a selfie holding the same document. Verification usually completes within 5 minutes.
              </Text>
            </View>

            {/* Upload slots */}
            <Panel style={{ marginTop: 12 }}>
              {(Object.keys(SLOT_META) as DocSlot[]).map((slot, i, arr) => {
                const meta = SLOT_META[slot];
                const file = files[slot];
                return (
                  <Pressable
                    key={slot}
                    onPress={() => !isPending && handleSlotPress(slot)}
                    disabled={isPending}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      gap: 12,
                      backgroundColor: pressed ? p.border : 'transparent',
                      borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                      borderBottomColor: p.border,
                      opacity: isPending ? 0.6 : 1,
                    })}
                  >
                    {file ? (
                      <Image
                        source={{ uri: file.uri }}
                        style={{ width: 48, height: 48, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={{
                        width: 48, height: 48, borderRadius: 10,
                        backgroundColor: p.bgElev,
                        borderWidth: 1, borderColor: p.border,
                        borderStyle: 'dashed',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Ionicons name={meta.icon} size={20} color={p.fgFaint} />
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: p.fg, fontSize: 14, fontWeight: '600' }}>{meta.label}</Text>
                        {meta.required && (
                          <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>Required</Text>
                        )}
                      </View>
                      <Text style={{ color: p.fgMuted, fontSize: 12, marginTop: 2 }}>
                        {file ? file.name : meta.hint}
                      </Text>
                    </View>

                    {file ? (
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={p.fgFaint} />
                    )}
                  </Pressable>
                );
              })}
            </Panel>

            {/* Submit */}
            {!isPending && (
              <Pressable
                onPress={() => { h.medium(); submit.mutate(); }}
                disabled={!canSubmit || submit.isPending}
                style={({ pressed }) => ({
                  marginHorizontal: 16, marginTop: 24,
                  height: 52, borderRadius: 16,
                  backgroundColor: canSubmit ? p.ctaBg : p.bgElev,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: pressed ? 0.8 : 1,
                  flexDirection: 'row', gap: 8,
                })}
              >
                {submit.isPending ? (
                  <ActivityIndicator color={p.ctaFg} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={canSubmit ? p.ctaFg : p.fgFaint} />
                    <Text style={{ color: canSubmit ? p.ctaFg : p.fgFaint, fontSize: 15, fontWeight: '700' }}>
                      Submit for Verification
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {isPending && (
              <View style={{
                marginHorizontal: 16, marginTop: 24,
                padding: 16, borderRadius: 14,
                backgroundColor: `#f59e0b18`,
                borderWidth: 1, borderColor: '#f59e0b40',
                flexDirection: 'row', alignItems: 'center', gap: 10,
              }}>
                <Ionicons name="time-outline" size={20} color="#f59e0b" />
                <Text style={{ flex: 1, color: p.fgMuted, fontSize: 13, fontWeight: '500' }}>
                  Documents submitted. Our team is reviewing them — you'll be notified when done.
                </Text>
              </View>
            )}
          </>
        )}

        {isApproved && (
          <View style={{
            marginHorizontal: 16, marginTop: 24,
            padding: 20, borderRadius: 16,
            backgroundColor: '#22c55e18',
            borderWidth: 1, borderColor: '#22c55e40',
            alignItems: 'center', gap: 10,
          }}>
            <Ionicons name="shield-checkmark" size={40} color="#22c55e" />
            <Text style={{ color: p.fg, fontSize: 16, fontWeight: '700' }}>Identity Verified</Text>
            <Text style={{ color: p.fgMuted, fontSize: 13, textAlign: 'center' }}>
              Your identity has been verified. You have full access to all platform features.
            </Text>
          </View>
        )}

        {isLoading && (
          <View style={{ marginTop: 48, alignItems: 'center' }}>
            <ActivityIndicator color={p.ctaBg} />
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}
