/**
 * Lightweight UI store. Holds ephemeral global state — toasts, the currently
 * selected wallet on the home screen, etc. Expand as the app grows; resist
 * putting domain data here (keep that in React Query cache).
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Currency } from '@/types';
import { CONFIRM_STYLE, type ConfirmStyle } from '@/constants/config';

const BALANCES_HIDDEN_KEY = 'ui.balancesHidden';
const CONFIRM_STYLE_KEY = 'ui.confirmStyle';
const CONFIRM_STYLES: ConfirmStyle[] = ['review', 'hold', 'slide'];

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info';
}

interface UiState {
  selectedCurrency: Currency;
  setSelectedCurrency: (c: Currency) => void;

  toasts: Toast[];
  pushToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;

  /** Privacy mode: masks balances on Home and Wallet. Persisted, so it
   *  survives restarts and applies everywhere at once. */
  balancesHidden: boolean;
  toggleBalancesHidden: () => void;

  /** How money flows confirm (Settings → Appearance). Defaults to
   *  `CONFIRM_STYLE`; a tester's pick is persisted on the device. */
  confirmStyle: ConfirmStyle;
  setConfirmStyle: (s: ConfirmStyle) => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedCurrency: 'USDT',
  setSelectedCurrency: (c) => set({ selectedCurrency: c }),

  toasts: [],
  pushToast: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  balancesHidden: false,
  toggleBalancesHidden: () => set((s) => {
    const next = !s.balancesHidden;
    AsyncStorage.setItem(BALANCES_HIDDEN_KEY, next ? '1' : '0').catch(() => {});
    return { balancesHidden: next };
  }),

  confirmStyle: CONFIRM_STYLE,
  setConfirmStyle: (confirmStyle) => {
    AsyncStorage.setItem(CONFIRM_STYLE_KEY, confirmStyle).catch(() => {});
    set({ confirmStyle });
  },
}));

AsyncStorage.getItem(BALANCES_HIDDEN_KEY)
  .then((v) => { if (v === '1') useUiStore.setState({ balancesHidden: true }); })
  .catch(() => {});

AsyncStorage.getItem(CONFIRM_STYLE_KEY)
  .then((v) => { if (v && (CONFIRM_STYLES as string[]).includes(v)) useUiStore.setState({ confirmStyle: v as ConfirmStyle }); })
  .catch(() => {});
