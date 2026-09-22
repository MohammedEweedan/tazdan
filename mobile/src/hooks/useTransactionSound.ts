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

// NOTE (corrected): expo-av is NOT gone on this SDK. `expo-av@16.0.8` is a
// declared dependency, is installed, and does export `Audio` — so sound plays
// today on SDK 54. (The earlier note here claimed it had been removed, which
// sent people looking for a bug that wasn't there; the original Buy/Sell crash
// was a static-access-at-import problem, which the runtime require below fixes.)
//
// It IS deprecated, and it is removed in SDK 55+. On the SDK 57 upgrade this
// defensive branch becomes the live one and the app silently drops to
// haptic-only. Migration target is `expo-audio`:
//   const player = createAudioPlayer(SUCCESS_SOUND_ASSET);
//   player.seekTo(0); player.play();
// Keep the runtime require either way — a missing audio backend should degrade
// to haptics, never throw inside a transaction confirmation.
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
