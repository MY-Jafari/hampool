import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { DateText } from '@/shared/components/ui/date-text';
import { formatNumber } from '@/shared/lib/format';
import { useNotificationsStore } from './store';
import { getLocalizedEventMessage } from './useGroupEvents';

export function NotificationBell() {
  const { t, i18n } = useTranslation(['groups', 'common']);
  const lang = (i18n.language?.startsWith('fa') ? 'fa' : 'en') as 'fa' | 'en';

  const items = useNotificationsStore((s) => s.items);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const clear = useNotificationsStore((s) => s.clear);
  const unread = items.filter((i) => !i.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={t('notifications.title')}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unread > 9 ? '۹+' : formatNumber(unread, lang)}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,24rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-foreground">{t('notifications.title')}</h4>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-xs py-0 px-1.5">
                {formatNumber(items.length, lang)}
              </Badge>
            )}
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={markAllRead}
                title={t('notifications.markAllRead')}
              >
                <CheckCheck className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={clear}
                title={t('notifications.clearAll')}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-muted-foreground">
            {t('notifications.empty')}
          </div>
        ) : (
          <ScrollArea className="h-80">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`px-4 py-3 text-xs transition-colors hover:bg-accent/40 ${
                    item.read ? 'opacity-65' : 'bg-primary/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-5 text-foreground font-medium">
                      {getLocalizedEventMessage(item.eventType, item.params, t, lang)}
                    </p>
                    {!item.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    <DateText date={item.ts} relative />
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
