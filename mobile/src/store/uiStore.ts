/**
 * Lightweight UI store. Holds ephemeral global state — toasts, the currently
 * selected wallet on the home screen, etc. Expand as the app grows; resist
 * putting domain data here (keep that in React Query cache).
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Currency } from '@/types';

const BALANCES_HIDDEN_KEY = 'ui.balancesHidden';

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
}));

AsyncStorage.getItem(BALANCES_HIDDEN_KEY)
  .then((v) => { if (v === '1') useUiStore.setState({ balancesHidden: true }); })
  .catch(() => {});
