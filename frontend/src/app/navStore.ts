import { create } from 'zustand';

interface NavState {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (val: boolean) => void;
  toggleMobile: () => void;
  setMobileOpen: (open: boolean) => void;
}

const STORAGE_KEY = 'hampool.sidebar.collapsed';

export const useNavStore = create<NavState>((set) => ({
  collapsed:
    typeof window !== 'undefined'
      ? window.localStorage.getItem(STORAGE_KEY) === 'true'
      : false,
  mobileOpen: false,

  toggleCollapsed: () =>
    set((state) => {
      const next = !state.collapsed;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return { collapsed: next };
    }),

  setCollapsed: (val: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(val));
    } catch {
      // ignore
    }
    set({ collapsed: val });
  },

  toggleMobile: () => set((state) => ({ mobileOpen: !state.mobileOpen })),
  setMobileOpen: (open: boolean) => set({ mobileOpen: open }),
}));
