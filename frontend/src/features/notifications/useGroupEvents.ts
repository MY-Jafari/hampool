import { useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useWebSocket } from '@/shared/hooks/useWebSocket';
import { formatMoney } from '@/shared/lib/format';
import type { GroupStateEvent } from '@/shared/types/api';
import { useNotificationsStore } from './store';

/**
 * Builds localized notification text for any of the 9 backend WebSocket event types.
 */
export function getLocalizedEventMessage(
  eventType: string,
  params: Record<string, unknown>,
  t: (key: string, options?: Record<string, unknown>) => string,
  lang: 'fa' | 'en' = 'fa',
): string {
  const p = params as Record<string, string | number | undefined>;
  const amountStr = p.amount !== undefined ? formatMoney(p.amount, { locale: lang }) : '';
  const who = (p.payer ?? p.phone_number ?? p.from_phone ?? '') as string;
  const description = p.description ? String(p.description) : '';

  switch (eventType) {
    case 'group_created':
      return t('notifications.events.group_created');
    case 'member_joined':
      return t('notifications.events.member_joined', { who: who || (lang === 'fa' ? 'عضو جدید' : 'A new member') });
    case 'member_left':
      return t('notifications.events.member_left', { who: who || (lang === 'fa' ? 'یکی از اعضا' : 'A member') });
    case 'member_role_changed':
      return t('notifications.events.member_role_changed');
    case 'expense_created':
      return t('notifications.events.expense_created', { description, amount: amountStr });
    case 'expense_confirmed':
      return t('notifications.events.expense_confirmed', { description, amount: amountStr });
    case 'expense_deleted':
      return t('notifications.events.expense_deleted', { description, amount: amountStr });
    case 'settlement_created':
      return t('notifications.events.settlement_created', { amount: amountStr });
    case 'settlement_confirmed':
      return t('notifications.events.settlement_confirmed', { amount: amountStr });
    case 'settlement_reversed':
      return t('notifications.events.settlement_reversed', { amount: amountStr });
    default:
      return t('common:status.update', { defaultValue: 'رویداد جدیدی در گروه ثبت شد.' });
  }
}

/**
 * Connects to the group's notification WebSocket and reacts to events:
 * - Event deduplication using a sliding window cache
 * - Session-based notification store
 * - Localized toasts
 * - Granular, per-event query cache invalidation per ANALYSIS.md
 */
export function useGroupEvents(groupId: number | undefined) {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';
  const queryClient = useQueryClient();
  const addNotification = useNotificationsStore((s) => s.add);

  // Sliding cache of recently processed fingerprints to avoid duplicates
  const seenEventsRef = useRef<Map<string, number>>(new Map());

  const handleMessage = useCallback(
    (event: MessageEvent<string>) => {
      let payload: GroupStateEvent;
      try {
        payload = JSON.parse(event.data) as GroupStateEvent;
      } catch {
        return;
      }

      if (!payload || payload.type !== 'group_state_changed' || !payload.event_type) {
        return;
      }

      // Deduplicate within 10-second window
      const now = Date.now();
      const fingerprint = `${payload.group_id}-${payload.event_type}-${payload.ts}-${JSON.stringify(payload.params)}`;

      // Prune old entries
      for (const [key, timestamp] of seenEventsRef.current.entries()) {
        if (now - timestamp > 10_000) seenEventsRef.current.delete(key);
      }

      if (seenEventsRef.current.has(fingerprint)) {
        return;
      }
      seenEventsRef.current.set(fingerprint, now);

      const msg = getLocalizedEventMessage(payload.event_type, payload.params ?? {}, t, lang);

      // Add to session notification center
      addNotification({
        groupId: payload.group_id,
        eventType: payload.event_type,
        params: payload.params ?? {},
        ts: payload.ts ?? new Date().toISOString(),
      });

      // Show toast
      toast.info(msg);

      // Invalidate specific query keys according to ANALYSIS.md Section 3 Table
      const gid = payload.group_id;
      switch (payload.event_type) {
        case 'group_created':
          void queryClient.invalidateQueries({ queryKey: ['groups'] });
          break;

        case 'member_joined':
          void queryClient.invalidateQueries({ queryKey: ['group', gid, 'members'] });
          void queryClient.invalidateQueries({ queryKey: ['group', gid] });
          void queryClient.invalidateQueries({ queryKey: ['groups'] });
          break;

        case 'member_left':
          void queryClient.invalidateQueries({ queryKey: ['group', gid, 'members'] });
          void queryClient.invalidateQueries({ queryKey: ['group-balances', gid] });
          void queryClient.invalidateQueries({ queryKey: ['group', gid] });
          void queryClient.invalidateQueries({ queryKey: ['groups'] });
          break;

        case 'expense_created':
          void queryClient.invalidateQueries({ queryKey: ['group-expenses', gid] });
          void queryClient.invalidateQueries({ queryKey: ['group', gid] });
          void queryClient.invalidateQueries({ queryKey: ['groups'] });
          break;

        case 'expense_confirmed':
        case 'expense_deleted':
          void queryClient.invalidateQueries({ queryKey: ['group-expenses', gid] });
          void queryClient.invalidateQueries({ queryKey: ['group-balances', gid] });
          void queryClient.invalidateQueries({ queryKey: ['group', gid] });
          void queryClient.invalidateQueries({ queryKey: ['groups'] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard-balances'] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard-expenses'] });
          break;

        case 'settlement_created':
          void queryClient.invalidateQueries({ queryKey: ['group-settlements', gid] });
          break;

        case 'settlement_confirmed':
        case 'settlement_reversed':
          void queryClient.invalidateQueries({ queryKey: ['group-settlements', gid] });
          void queryClient.invalidateQueries({ queryKey: ['group-balances', gid] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard-balances'] });
          break;

        default:
          void queryClient.invalidateQueries({ queryKey: ['group', gid] });
          break;
      }
    },
    [t, lang, addNotification, queryClient],
  );

  const socketPath = groupId ? `/ws/groups/${groupId}/` : null;
  const wsState = useWebSocket(socketPath, {
    enabled: Boolean(groupId),
    onMessage: handleMessage,
  });

  return wsState;
}
