import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { EmptyPoolIllustration } from '@/assets/illustrations/Illustrations';
import { cn } from '@/shared/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/30 px-6 py-12 text-center animate-fade-in',
        className,
      )}
    >
      <div className="mb-4">
        {illustration ?? (
          Icon ? (
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary/80 border border-border">
              <Icon className="size-7 text-muted-foreground" />
            </div>
          ) : (
            <EmptyPoolIllustration size={130} />
          )
        )}
      </div>
      <h3 className="mb-1 text-base font-bold text-foreground">{title}</h3>
      {description && (
        <p className="mb-5 max-w-sm text-sm text-muted-foreground text-balance">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
