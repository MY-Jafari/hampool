import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, RefreshCw } from 'lucide-react';
import { ErrorIllustration } from '@/assets/illustrations/Illustrations';
import { Button } from '@/shared/components/ui/button';

export function ServerErrorPage() {
  const { t } = useTranslation(['common']);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center animate-fade-in">
      <div className="mb-6">
        <ErrorIllustration size={160} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t('errors.serverErrorTitle')}
      </h1>
      <p className="mt-2 mb-8 max-w-md text-sm text-muted-foreground text-balance">
        {t('errors.serverErrorDesc')}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" variant="default" onClick={handleRetry} className="rounded-xl px-6">
          <RefreshCw className="me-2 size-4" />
          {t('errors.tryAgain')}
        </Button>
        <Button asChild size="lg" variant="outline" className="rounded-xl px-6">
          <Link to="/">
            <Home className="me-2 size-4" />
            {t('errors.backToDashboard')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
