/**
 * useTransactionSound — Apple Pay-style success haptic + audible "ding".
 *
 * Plays the confirmation or decline MP3 through expo-audio alongside the iOS
 * haptic. expo-av (the previous backend) was removed from the app, which left
 * every confirmation silent; expo-audio is its SDK 54+ replacement.
 *
 * The module is required at runtime: a build without the native audio module
 * degrades to haptics only and never throws inside a confirmation. Sounds
 * follow the device's silent switch.
 */

import { useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { TRANSACTION_SOUND, type TransactionType } from '@/constants';
import { SUCCESS_SOUND_ASSET, DECLINE_SOUND_ASSET } from '@/utils/soundGenerator';

let createAudioPlayer: ((source: number) => any) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  createAudioPlayer = require('expo-audio')?.createAudioPlayer;
} catch {
  createAudioPlayer = undefined;
}

const safe = (fn: () => Promise<unknown> | void) => {
  if (Platform.OS === 'web') return;
  try { fn(); } catch { /* noop */ }
};

function play(ref: { current: any }, asset: number) {
  if (!createAudioPlayer || Platform.OS === 'web') return;
  try {
    ref.current ??= createAudioPlayer(asset);
    ref.current.seekTo(0);
    ref.current.play();
  } catch { /* haptic-only fallback */ }
}

export function useTransactionSound() {
  const successRef = useRef<any>(null);
  const declineRef = useRef<any>(null);

  // Release the native players with the component.
  useEffect(() => () => {
    try { successRef.current?.release?.(); declineRef.current?.release?.(); } catch { /* noop */ }
  }, []);

  /**
   * Play the confirmation sound + success haptic.
   * Call this when a transaction completes successfully. Fire-and-forget.
   */
  const playSuccess = useCallback((type: TransactionType = 'buy') => {
    const config = TRANSACTION_SOUND[type];
    if (!config || config.type !== 'success') return;
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    play(successRef, SUCCESS_SOUND_ASSET);
  }, []);

  /** Play the decline sound + error haptic for failed transactions. */
  const playError = useCallback(() => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
    play(declineRef, DECLINE_SOUND_ASSET);
  }, []);

  /** Warning haptic for attention-needed states. */
  const playWarning = useCallback(() => {
    safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  }, []);

  /** Light impact haptic for UI interactions. */
  const playLight = useCallback(() => {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  }, []);

  /** Medium impact haptic for confirmations. */
  const playMedium = useCallback(() => {
    safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  }, []);

  return { playSuccess, playError, playWarning, playLight, playMedium };
}
