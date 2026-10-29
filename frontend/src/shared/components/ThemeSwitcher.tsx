import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/shared/providers/ThemeProvider';
import { Button } from '@/shared/components/ui/button';

export function ThemeSwitcher({ variant = 'ghost' }: { variant?: 'ghost' | 'outline' }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <Button
      variant={variant}
      size="icon"
      onClick={toggleTheme}
      className="size-9 rounded-full select-none"
      aria-label="تغییر تم / Toggle Theme"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="size-4 text-amber-400 transition-transform hover:rotate-45" />
      ) : (
        <Moon className="size-4 text-slate-700 transition-transform hover:-rotate-12" />
      )}
    </Button>
  );
}
