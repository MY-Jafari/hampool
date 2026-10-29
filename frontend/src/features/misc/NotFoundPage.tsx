import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home } from 'lucide-react';
import { EmptyPoolIllustration } from '@/assets/illustrations/Illustrations';
import { Button } from '@/shared/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation(['common']);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center animate-fade-in">
      <div className="mb-6">
        <EmptyPoolIllustration size={160} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t('errors.notFoundTitle')}
      </h1>
      <p className="mt-2 mb-8 max-w-md text-sm text-muted-foreground text-balance">
        {t('errors.notFoundDesc')}
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
