/**
 * useTransactionSound — Apple Pay-style success haptic + audible "ding".
 *
 * Plays the real Apple Pay confirmation or decline MP3 via expo-av
 * alongside the iOS haptic. This produces BOTH sound (speaker)
 * and vibration (Taptic Engine) — the full Apple Pay experience.
 */

import { useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TRANSACTION_SOUND, type TransactionType } from '@/constants';
import { SUCCESS_SOUND_ASSET, DECLINE_SOUND_ASSET } from '@/utils/soundGenerator';

// `expo-av` was removed in Expo SDK 54, so `import { Audio } from 'expo-av'`
// resolves to `undefined` and any static access (e.g. `Audio.Sound`) throws
// "Cannot read property 'prototype' of undefined" — which crashed the Buy/Sell
// widgets. Resolve the module defensively at runtime: if the audio backend is
// missing we silently degrade to haptic-only feedback. To restore sound,
// install `expo-audio` and swap the loaders below.
let Audio: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Audio = require('expo-av')?.Audio;
} catch {
  Audio = undefined;
}
const audioAvailable = !!Audio?.Sound?.createAsync;

const safe = (fn: () => Promise<unknown> | void) => {
  if (Platform.OS === 'web') return;
  try { fn(); } catch { /* noop */ }
};

export function useTransactionSound() {
  const successSoundRef = useRef<any>(null);
  const declineSoundRef = useRef<any>(null);

  const loadSuccessSound = useCallback(async (): Promise<any> => {
    if (!audioAvailable) return null;
    if (successSoundRef.current) return successSoundRef.current;
    const { sound } = await Audio.Sound.createAsync(
      SUCCESS_SOUND_ASSET,
      { shouldPlay: false, volume: 1.0 }
    );
    successSoundRef.current = sound;
    return sound;
  }, []);

  const loadDeclineSound = useCallback(async (): Promise<any> => {
    if (!audioAvailable) return null;
    if (declineSoundRef.current) return declineSoundRef.current;
    const { sound } = await Audio.Sound.createAsync(
      DECLINE_SOUND_ASSET,
      { shouldPlay: false, volume: 1.0 }
    );
    declineSoundRef.current = sound;
    return sound;
  }, []);

  /**
   * Play the Apple Pay confirmation sound + success haptic.
   * Call this when a transaction completes successfully.
   * Fire-and-forget: no need to await.
   */
  const playSuccess = useCallback((type: TransactionType = 'buy') => {
    const config = TRANSACTION_SOUND[type];
    if (!config || config.type !== 'success') return;

    // Haptic vibration (Taptic Engine)
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

    // Apple Pay confirmation sound (fire-and-forget)
    loadSuccessSound()
      .then((sound) => sound?.setPositionAsync(0).then(() => sound.playAsync()))
      .catch(() => { /* haptic-only fallback */ });
  }, [loadSuccessSound]);

  /**
   * Play the Apple Pay decline sound + error haptic for failed transactions.
   */
  const playError = useCallback(() => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

    // Apple Pay decline sound (fire-and-forget)
    loadDeclineSound()
      .then((sound) => sound?.setPositionAsync(0).then(() => sound.playAsync()))
      .catch(() => { /* haptic-only fallback */ });
  }, [loadDeclineSound]);

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
