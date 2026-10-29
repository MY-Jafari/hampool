import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { Button } from '@/shared/components/ui/button';

export function ThemeSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { t } = useTranslation('common');
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={toggleTheme}
      className="size-9 rounded-full select-none"
      aria-label={t('theme.toggle', 'تغییر تم')}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="size-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-slate-700 transition-transform hover:-rotate-12" />
      )}
    </Button>
  );
}
