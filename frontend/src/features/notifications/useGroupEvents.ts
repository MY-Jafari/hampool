import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { notifyText } from '@/shared/lib/formats';
import type { GroupStateEvent } from '@/shared/types/api';
import { useNotificationsStore } from './store';

const wsBase: string = import.meta.env.VITE_WS_BASE_URL ?? '';

/** Build the WS path for a group (same-origin by default → Vite proxies /ws). */
export function groupSocketPath(groupId: number): string {
  return `${wsBase}/ws/groups/${groupId}/`;
}

const INVALIDATE_KEYS = [
  ['group'],
  ['groups'],
  ['group-balances'],
  ['group-expenses'],
  ['group-settlements'],
  ['group-members'],
  ['group-activities'],
];

/**
 * Connects to the group's notification WebSocket and reacts to events:
 *  - stores the event in the notification center
 *  - shows a toast
 *  - invalidates all group queries so the UI re-fetches fresh data
 *    (WS messages are best-effort; the source of truth is the REST API).
 */
export function useGroupEvents(groupId: number | undefined): { status: ReturnType<typeof useWebSocket> } {
  const add = useNotificationsStore((s) => s.add);
  const queryClient = useQueryClient();

  const status = useWebSocket(groupId ? groupSocketPath(groupId) : null, {
    enabled: Boolean(groupId),
    onMessage: (event) => {
      let payload: GroupStateEvent;
      try {
        payload = JSON.parse(event.data) as GroupStateEvent;
      } catch {
        return;
      }
      if (!payload || payload.type !== 'group_state_changed' || !payload.event_type) return;

      add({
        groupId: payload.group_id,
        eventType: payload.event_type,
        params: payload.params ?? {},
        ts: payload.ts ?? new Date().toISOString(),
      });
      toast.info(notifyText(payload.event_type, payload.params ?? {}));

      for (const key of INVALIDATE_KEYS) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  return { status };
}
