import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  groupId: number;
  eventType: string;
  params: Record<string, unknown>;
  ts: string;
  read: boolean;
}

interface NotificationsState {
  items: NotificationItem[];
  add: (item: Omit<NotificationItem, 'id' | 'read'>) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  items: [],
  add: (item) =>
    set((state) => ({
      items: [{ ...item, id: makeId(), read: false }, ...state.items].slice(0, 100),
    })),
  markAllRead: () =>
    set((state) => ({ items: state.items.map((i) => ({ ...i, read: true })) })),
  remove: (id) => set((state) => ({ items: state.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
