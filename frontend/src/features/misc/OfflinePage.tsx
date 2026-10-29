import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Wifi } from 'lucide-react';
import { OfflineIllustration } from '@/assets/illustrations/Illustrations';
import { Button } from '@/shared/components/ui/button';

export function OfflinePage() {
  const { t } = useTranslation(['common']);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center animate-fade-in">
      <div className="mb-6">
        <OfflineIllustration size={160} />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t('errors.offlineTitle')}
      </h1>
      <p className="mt-2 mb-8 max-w-md text-sm text-muted-foreground text-balance">
        {t('errors.offlineDesc')}
      </p>
      {isOnline ? (
        <Button size="lg" onClick={handleRetry} className="rounded-xl px-6">
          <Wifi className="me-2 size-4" />
          {t('status.connected')} — {t('errors.tryAgain')}
        </Button>
      ) : (
        <Button size="lg" variant="outline" onClick={handleRetry} className="rounded-xl px-6">
          <RefreshCw className="me-2 size-4" />
          {t('errors.tryAgain')}
        </Button>
      )}
    </div>
  );
}
