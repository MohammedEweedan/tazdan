/**
 * Login screen with React Hook Form + Zod validation.
 * Uses Moti for staged entrance and the shared Input + Button components.
 */

import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';

import { GradientBackground } from '@/components/ui/GradientBackground';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';
import { useHaptics } from '@/hooks/useHaptics';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function Login() {
  const router = useRouter();
  const h = useHaptics();
  const login = useAuthStore((s) => s.login);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);
      await login(values.email, values.password);
      h.success();
    } catch (e) {
      h.error();
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}>
            <View className="pt-2 mb-6">
              <Pressable
                onPress={() => { h.selection(); router.back(); }}
                hitSlop={12}
                className="w-10 h-10 rounded-full items-center justify-center bg-white/[0.06] border border-white/[0.08]"
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>
            </View>

            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 400 }}>
              <Text className="text-ink-primary" style={{ fontSize: 34, fontWeight: '800', letterSpacing: -1 }}>
                Welcome back
              </Text>
              <Text className="text-ink-secondary mt-2" style={{ fontSize: 15, lineHeight: 22 }}>
                Log in to access your wallets, transfer funds, and trade across 120+ markets.
              </Text>
            </MotiView>

            <View className="mt-10" style={{ gap: 14 }}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.email?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Password"
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    right={
                      <Pressable onPress={() => { h.selection(); setShowPw((s) => !s); }} hitSlop={8}>
                        <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.55)" />
                      </Pressable>
                    }
                  />
                )}
              />

              <View className="items-end mt-1">
                <Pressable hitSlop={8}>
                  <Text className="text-brand-400 text-sm font-semibold">Forgot password?</Text>
                </Pressable>
              </View>
            </View>

            <View className="mt-8" style={{ gap: 14 }}>
              <Button
                label="Log in"
                size="lg"
                fullWidth
                loading={submitting}
                onPress={handleSubmit(onSubmit)}
              />
              <Button
                label="Sign in with Apple"
                variant="secondary"
                size="lg"
                fullWidth
                iconLeft={<Ionicons name="logo-apple" size={18} color="#fff" />}
              />
            </View>

            <View className="flex-row items-center justify-center mt-auto pt-10 pb-2">
              <Text className="text-ink-tertiary text-sm">New to {'\u00A0'}</Text>
              <Text className="text-ink-secondary text-sm font-semibold">Promrkts? </Text>
              <Pressable onPress={() => router.push('/(auth)/register')} hitSlop={6}>
                <Text className="text-brand-400 text-sm font-bold">Create account</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}
