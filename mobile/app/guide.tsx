import { useRouter } from 'expo-router';
import { OnboardingTour } from '@/components/onboarding/OnboardingTour';

export default function Guide() {
  const router = useRouter();
  const close = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile');
  return <OnboardingTour onFinish={close} onClose={close} />;
}
