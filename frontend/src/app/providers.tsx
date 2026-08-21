import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { queryClient } from '@/shared/lib/queryClient';
import { router } from './router';

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          richColors
          closeButton
          dir="rtl"
          toastOptions={{
            style: { fontFamily: 'Vazirmatn, sans-serif' },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
