/**
 * Transaction Sound Design System
 * 
 * Uses iOS system haptics + notification sounds to create the Apple Pay
 * experience without bundling copyrighted audio files.
 * 
 * On iOS, `Haptics.notificationAsync(NotificationFeedbackType.Success)`
 * triggers the exact same system success sound + haptic used by Apple Pay.
 */

export const TRANSACTION_SOUND = {
  buy: {
    type: 'success',
    intensity: 'high',
    label: 'Purchase completed',
  },
  sell: {
    type: 'success',
    intensity: 'high',
    label: 'Sale completed',
  },
  deposit: {
    type: 'success',
    intensity: 'medium',
    label: 'Deposit submitted',
  },
  withdrawal: {
    type: 'success',
    intensity: 'medium',
    label: 'Withdrawal requested',
  },
  transfer: {
    type: 'success',
    intensity: 'high',
    label: 'Transfer sent',
  },
  error: {
    type: 'error',
    intensity: 'high',
    label: 'Transaction failed',
  },
  warning: {
    type: 'warning',
    intensity: 'medium',
    label: 'Attention needed',
  },
} as const;

export type TransactionType = keyof typeof TRANSACTION_SOUND;
