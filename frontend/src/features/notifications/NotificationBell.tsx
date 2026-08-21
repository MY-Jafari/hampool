import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { formatDateTime, notifyText } from '@/shared/lib/formats';
import { useNotificationsStore } from './store';

export function NotificationBell() {
  const items = useNotificationsStore((s) => s.items);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const clear = useNotificationsStore((s) => s.clear);
  const unread = items.filter((i) => !i.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="اعلان‌ها">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -left-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? '۹+' : unread.toLocaleString('fa-IR')}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,26rem)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">اعلان‌ها</h4>
            {items.length > 0 && <Badge variant="secondary">{items.length.toLocaleString('fa-IR')}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" onClick={markAllRead} title="خواندن همه">
              <CheckCheck className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8" onClick={clear} title="پاک کردن">
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            هنوز اعلانی دریافت نشده است.
          </div>
        ) : (
          <ScrollArea className="h-80">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className={`px-4 py-3 text-sm ${item.read ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="leading-6">{notifyText(item.eventType, item.params)}</p>
                    {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.ts)}</p>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
