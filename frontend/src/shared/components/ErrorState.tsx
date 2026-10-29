import { RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/components/ui/button';
import { getErrorMessage } from '@/shared/lib/errors';
import { ErrorIllustration } from '@/assets/illustrations/Illustrations';
import { cn } from '@/shared/lib/utils';

export interface ErrorStateProps {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  description?: string;
  className?: string;
}

export function ErrorState({ error, onRetry, title, description, className }: ErrorStateProps) {
  const { t } = useTranslation('common');
  const displayTitle = title ?? t('status.error', 'خطایی رخ داده است');
  const displayDesc = description ?? (error ? getErrorMessage(error) : '');

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center animate-fade-in',
        className,
      )}
    >
      <div className="mb-4">
        <ErrorIllustration size={110} />
      </div>
      <h3 className="mb-1 text-base font-bold text-foreground">{displayTitle}</h3>
      {displayDesc && (
        <p className="mb-5 max-w-sm text-sm text-muted-foreground text-balance">
          {displayDesc}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RotateCw className="size-4" />
          {t('actions.retry', 'تلاش مجدد')}
        </Button>
      )}
    </div>
  );
}
