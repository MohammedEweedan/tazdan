import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const safe = (fn: () => Promise<unknown> | void) => {
  if (Platform.OS === 'web') return;
  try { fn(); } catch { /* noop */ }
};

export const useHaptics = () => ({
  light:    () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium:   () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy:    () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  selection:() => safe(() => Haptics.selectionAsync()),
  success:  () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning:  () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error:    () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
});
