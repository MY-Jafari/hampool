import { create } from 'zustand';
import type { User } from '@/shared/types/api';

const ACCESS_KEY = 'hampool.access';
const REFRESH_KEY = 'hampool.refresh';

interface AuthState {
  access: string | null;
  refresh: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string) => void;
  setUser: (user: User | null) => void;
  clear: () => void;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  access: readStored(ACCESS_KEY),
  refresh: readStored(REFRESH_KEY),
  user: null,
  isAuthenticated: Boolean(readStored(ACCESS_KEY)),
  setTokens: (access, refresh) => {
    try {
      localStorage.setItem(ACCESS_KEY, access);
      localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // storage unavailable — session-only auth
    }
    set({ access, refresh, isAuthenticated: true });
  },
  setUser: (user) => set({ user }),
  clear: () => {
    try {
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(REFRESH_KEY);
    } catch {
      // ignore
    }
    set({ access: null, refresh: null, user: null, isAuthenticated: false });
  },
}));
