import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { queryClient } from '@/shared/lib/queryClient';
import { LanguageProvider, useLanguage } from '@/shared/providers/LanguageProvider';
import { ThemeProvider, useTheme } from '@/shared/providers/ThemeProvider';
import { router } from './router';
import '@/shared/lib/i18n';

function AppContent() {
  const { direction } = useLanguage();
  const { resolvedTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={200}>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        richColors
        closeButton
        dir={direction}
        theme={resolvedTheme}
        toastOptions={{
          style: {
            fontFamily: 'var(--font-sans)',
          },
        }}
      />
    </TooltipProvider>
  );
}

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
