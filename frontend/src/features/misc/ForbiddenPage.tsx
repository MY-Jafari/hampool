import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, ShieldAlert } from 'lucide-react';
import { ErrorIllustration } from '@/assets/illustrations/Illustrations';
import { Button } from '@/shared/components/ui/button';

export function ForbiddenPage() {
  const { t } = useTranslation(['common']);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center animate-fade-in">
      <div className="mb-6">
        <ErrorIllustration size={160} />
      </div>
      <div className="mb-2 flex items-center justify-center gap-2 text-destructive">
        <ShieldAlert className="size-6" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t('errors.forbiddenTitle')}
        </h1>
      </div>
      <p className="mt-2 mb-8 max-w-md text-sm text-muted-foreground text-balance">
        {t('errors.forbiddenDesc')}
      </p>
      <Button asChild size="lg" className="rounded-xl px-6">
        <Link to="/">
          <Home className="me-2 size-4" />
          {t('errors.backToDashboard')}
        </Link>
      </Button>
    </div>
  );
}
