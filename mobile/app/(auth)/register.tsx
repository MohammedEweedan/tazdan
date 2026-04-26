/**
 * Multi-step register flow.
 *  Step 1: Name + email + password (RHF + Zod)
 *  Step 2: Phone + country (one form, simple)
 *  Step 3: @handle pick (live availability check)
 *
 * On submit, calls authStore.register and the AuthGate redirects to (tabs).
 */

import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks';

const stepOneSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName:  z.string().min(1, 'Required'),
  email:     z.string().email('Enter a valid email'),
  password:  z.string().min(8, 'At least 8 characters'),
});
type StepOne = z.infer<typeof stepOneSchema>;

const stepTwoSchema = z.object({
  phone:   z.string().min(6, 'Required'),
  country: z.string().min(2, 'Required'),
});
type StepTwo = z.infer<typeof stepTwoSchema>;

export default function Register() {
  const router = useRouter();
  const h = useHaptics();
  const register = useAuthStore((s) => s.register);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [one, setOne]   = useState<StepOne | null>(null);
  const [two, setTwo]   = useState<StepTwo | null>(null);
  const [handle, setHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const formOne = useForm<StepOne>({
    resolver: zodResolver(stepOneSchema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });
  const formTwo = useForm<StepTwo>({
    resolver: zodResolver(stepTwoSchema),
    defaultValues: { phone: '', country: 'AE' },
  });

  const handleAvailable = handle.length >= 3 && !/[^a-z0-9._]/i.test(handle);

  const submitAll = async () => {
    if (!one || !two || !handleAvailable) return;
    try {
      setSubmitting(true);
      await register({
        email: one.email, password: one.password,
        firstName: one.firstName, lastName: one.lastName,
      });
      h.success();
    } catch (e) {
      h.error();
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}>
            {/* Progress */}
            <View className="flex-row items-center mt-2 mb-6">
              <Pressable
                onPress={() => { h.selection(); step === 1 ? router.back() : setStep((step - 1) as 1 | 2); }}
                hitSlop={12}
                className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>
              <View className="flex-row" style={{ gap: 6, marginLeft: 14 }}>
                {[1, 2, 3].map((n) => (
                  <View
                    key={n}
                    style={{
                      height: 6,
                      width: step === n ? 28 : 18,
                      borderRadius: 3,
                      backgroundColor: step >= n ? '#4A8FE0' : 'rgba(255,255,255,0.18)',
                    }}
                  />
                ))}
              </View>
              <Text className="text-ink-tertiary text-xs ml-auto font-semibold">Step {step} of 3</Text>
            </View>

            {step === 1 && (
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
                <Text className="text-ink-primary" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1 }}>Create your account</Text>
                <Text className="text-ink-secondary mt-2 mb-7" style={{ fontSize: 15, lineHeight: 22 }}>
                  All money. One place. Apple-grade UX.
                </Text>
                <View style={{ gap: 14 }}>
                  <Controller control={formOne.control} name="firstName" render={({ field: { onChange, value } }) => (
                    <Input label="First name" value={value} onChangeText={onChange} error={formOne.formState.errors.firstName?.message} />
                  )} />
                  <Controller control={formOne.control} name="lastName" render={({ field: { onChange, value } }) => (
                    <Input label="Last name" value={value} onChangeText={onChange} error={formOne.formState.errors.lastName?.message} />
                  )} />
                  <Controller control={formOne.control} name="email" render={({ field: { onChange, value } }) => (
                    <Input
                      label="Email"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      value={value} onChangeText={onChange}
                      error={formOne.formState.errors.email?.message}
                    />
                  )} />
                  <Controller control={formOne.control} name="password" render={({ field: { onChange, value } }) => (
                    <Input
                      label="Password"
                      secureTextEntry={!showPw}
                      autoCapitalize="none"
                      value={value} onChangeText={onChange}
                      error={formOne.formState.errors.password?.message}
                      right={
                        <Pressable hitSlop={8} onPress={() => { h.selection(); setShowPw((s) => !s); }}>
                          <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.55)" />
                        </Pressable>
                      }
                    />
                  )} />
                </View>
                <View className="mt-7">
                  <Button
                    label="Continue"
                    size="lg" fullWidth
                    onPress={formOne.handleSubmit((v) => { h.medium(); setOne(v); setStep(2); })}
                    iconRight={<Ionicons name="arrow-forward" size={18} color="#fff" />}
                  />
                </View>
              </MotiView>
            )}

            {step === 2 && (
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
                <Text className="text-ink-primary" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1 }}>A bit about you</Text>
                <Text className="text-ink-secondary mt-2 mb-7" style={{ fontSize: 15, lineHeight: 22 }}>
                  We need this to comply with local regulations.
                </Text>
                <View style={{ gap: 14 }}>
                  <Controller control={formTwo.control} name="phone" render={({ field: { onChange, value } }) => (
                    <Input label="Phone number" keyboardType="phone-pad" value={value} onChangeText={onChange} error={formTwo.formState.errors.phone?.message} />
                  )} />
                  <Controller control={formTwo.control} name="country" render={({ field: { onChange, value } }) => (
                    <Input label="Country (ISO)" autoCapitalize="characters" maxLength={2} value={value} onChangeText={onChange} error={formTwo.formState.errors.country?.message} />
                  )} />
                </View>
                <View className="mt-7">
                  <Button
                    label="Continue"
                    size="lg" fullWidth
                    onPress={formTwo.handleSubmit((v) => { h.medium(); setTwo(v); setStep(3); })}
                    iconRight={<Ionicons name="arrow-forward" size={18} color="#fff" />}
                  />
                </View>
              </MotiView>
            )}

            {step === 3 && (
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
                <Text className="text-ink-primary" style={{ fontSize: 32, fontWeight: '800', letterSpacing: -1 }}>Pick your @handle</Text>
                <Text className="text-ink-secondary mt-2 mb-7" style={{ fontSize: 15, lineHeight: 22 }}>
                  Friends will pay you with this. Letters, numbers, dot, underscore.
                </Text>
                <Input
                  label="Handle"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={handle}
                  onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                  right={
                    handle.length >= 3 ? (
                      <Ionicons
                        name={handleAvailable ? 'checkmark-circle' : 'close-circle'}
                        size={18}
                        color={handleAvailable ? '#22c55e' : '#ef4444'}
                      />
                    ) : undefined
                  }
                />
                <Text className="text-ink-tertiary text-xs mt-2 ml-1">
                  Preview: <Text className="text-brand-400 font-bold">@{handle || 'yourname'}</Text>
                </Text>
                <View className="mt-7">
                  <Button
                    label={submitting ? 'Creating account…' : 'Finish'}
                    size="lg" fullWidth
                    loading={submitting}
                    disabled={!handleAvailable}
                    onPress={submitAll}
                    haptic="medium"
                  />
                </View>
              </MotiView>
            )}

            <View className="flex-row items-center justify-center mt-auto pt-10 pb-2">
              <Text className="text-ink-tertiary text-sm">Have an account? </Text>
              <Pressable onPress={() => router.replace('/(auth)/login')} hitSlop={6}>
                <Text className="text-brand-400 text-sm font-bold">Log in</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
