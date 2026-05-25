'use client';

import { create } from 'zustand';
import { authAPI } from '@/lib/api';

export interface BusinessProfile {
  id: string;
  companyName: string;
  legalName?: string | null;
  country: string;
  industry?: string | null;
  employeeCount?: string | null;
  website?: string | null;
  billingEmail?: string | null;
  supportEmail?: string | null;
  kybStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  accountType?: 'PERSONAL' | 'BUSINESS';
  businessProfile?: BusinessProfile | null;
  kycStatus: string;
  twoFactorEnabled?: boolean;
  referralCode?: string;
  phone?: string;
  status?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string;
  profilePublic?: boolean;
  baseCurrency?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<any>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password, twoFactorCode) => {
    const res = await authAPI.login({ email, password, twoFactorCode });
    if (res.data.requires2FA) {
      return { requires2FA: true };
    }
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    return res.data;
  },

  register: async (data) => {
    const res = await authAPI.register(data);
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    set({ user: res.data.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false, isLoading: false });
    window.location.href = '/login';
  },

  fetchUser: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }
    // Hard timeout so the dashboard never hangs if the API is unreachable.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth_timeout')), 8000),
    );
    try {
      const res: any = await Promise.race([authAPI.me(), timeout]);
      set({ user: res.data.user, isAuthenticated: true, isLoading: false });
    } catch {
      // Network / 401 / timeout — clear creds and let the layout redirect to /login.
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user }),
}));
