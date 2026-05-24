/**
 * useTransactionSound — Apple Pay-style success haptic + audible "ding".
 *
 * Plays a synthesized ascending-frequency "ding" WAV file via expo-av
 * alongside the iOS success haptic. This produces BOTH sound (speaker)
 * and vibration (Taptic Engine) — the full Apple Pay experience.
 */

import { useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { TRANSACTION_SOUND, type TransactionType } from '@/constants';
import { ensureSuccessSound } from '@/utils/soundGenerator';

const safe = (fn: () => Promise<unknown> | void) => {
  if (Platform.OS === 'web') return;
  try { fn(); } catch { /* noop */ }
};

export function useTransactionSound() {
  const soundRef = useRef<Audio.Sound | null>(null);

  const loadSound = useCallback(async (): Promise<Audio.Sound> => {
    if (soundRef.current) return soundRef.current;

    const uri = ensureSuccessSound();
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false, volume: 1.0 }
    );
    soundRef.current = sound;
    return sound;
  }, []);

  /**
   * Play the Apple Pay-style success ding + haptic.
   * Call this when a transaction completes successfully.
   * Fire-and-forget: no need to await.
   */
  const playSuccess = useCallback((type: TransactionType = 'buy') => {
    const config = TRANSACTION_SOUND[type];
    if (!config || config.type !== 'success') return;

    // Haptic vibration (Taptic Engine)
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

    // Actual audible "ding" from speaker (fire-and-forget)
    loadSound()
      .then((sound) => sound.setPositionAsync(0).then(() => sound.playAsync()))
      .catch(() => { /* haptic-only fallback */ });
  }, [loadSound]);

  /**
   * Play error haptic for failed transactions.
   */
  const playError = useCallback(() => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  }, []);

  /**
   * Play warning haptic for attention-needed states.
   */
  const playWarning = useCallback(() => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }, []);

  /**
   * Play light impact haptic for UI interactions.
   */
  const playLight = useCallback(() => {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, []);

  /**
   * Play medium impact haptic for confirmations.
   */
  const playMedium = useCallback(() => {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, []);

  return {
    playSuccess,
    playError,
    playWarning,
    playLight,
    playMedium,
  };
}
