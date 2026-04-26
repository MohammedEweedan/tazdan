/**
 * Lightweight UI store. Holds ephemeral global state — toasts, the currently
 * selected wallet on the home screen, etc. Expand as the app grows; resist
 * putting domain data here (keep that in React Query cache).
 */

import { create } from 'zustand';
import type { Currency } from '@/types';

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
}));
