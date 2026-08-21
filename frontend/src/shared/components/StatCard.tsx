import type { LucideIcon } from 'lucide-react';
import { Card } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'danger' | 'ai';
  loading?: boolean;
}

const toneText = {
  default: 'text-foreground',
  success: 'text-success',
  danger: 'text-danger',
  ai: 'text-ai',
} as const;

const toneIconBg = {
  default: 'bg-secondary text-foreground',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  ai: 'bg-ai/15 text-ai',
} as const;

export function StatCard({ icon: Icon, label, value, hint, tone = 'default', loading }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className={cn('mt-1 truncate text-xl font-bold sm:text-2xl', toneText[tone])}>{value}</p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg', toneIconBg[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
